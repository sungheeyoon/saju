import { NextResponse } from 'next/server';

import { supabaseOnServer } from '../../auth/server-client';
import { recordDbFailure } from '../../db-error';

/**
 * 사진 한 장을 내주는 자리 — **판정은 여기 없다.** 주소 둘(`/me/photo/{id}` · `/me/photo/{id}/{n}`)이 이것을 부른다.
 *
 * `photo_at` 이 「이 사람의 사진을 볼 수 있나」를 답하고(`may_see_photo`), 못 보면 행이
 * 안 나온다. 여기서 조건을 다시 적으면 답하는 자리가 둘이 되고, 둘은 언젠가 어긋난다.
 * 볼 수 있는가는 **사람 단위**다 — 자리 번호는 어느 장인가만 고른다(G-60).
 *
 * ## 관문(`proxy.ts`)을 안 지난다
 *
 * 사진 주소는 관문의 matcher 밖이다(ADR 0200) — 한 장에 DB 왕복 하나다. 정지 · 탈퇴 신청 · 베타 종료는 `may_see_photo` 의
 * `is_active_account` 가, 로그인하지 않은 사람은 문의 grant 가 닫는다. 토큰이 만료됐으면 이 클라이언트가 `photo_at` 을 부르기
 * 전에 스스로 갱신하고 새 쿠키를 응답에 싣는다 — 라우트는 화면과 달리 쿠키를 쓸 수 있다. 여기서 `signedInUser` 를 부르면
 * 안 된다 — 서명만 보는 그 확인은 관문과 한 벌이다(`app/auth/signed-in.boundary.test.ts`).
 *
 * ## 왜 `<img src>` 로 나가나
 *
 * 바이트를 화면에 직접 실을 수도 있다(data URI). 그러면 후보 카드 여덟 장이 한 HTML 에
 * 통째로 들어가 첫 화면이 몇 배로 무거워진다. 주소로 내주면 브라우저가 필요한 것만
 * 받아 가고 캐시도 브라우저가 든다.
 *
 * ## 캐시는 **사람마다** 들고, 쓸 때마다 묻는다 (G-119 안 C)
 *
 * `private` 이다. 중간 캐시가 한 사람에게 내준 얼굴을 다음 사람에게 주면, 「볼 수 있는
 * 사람에게만」이 캐시 한 겹으로 무너진다. `no-cache` 라 브라우저는 든 장을 쓰기 전에 매번 묻는다 —
 * `ETag` 는 그 장의 판본이고, 브라우저가 `If-None-Match` 로 돌려주면 `photo_at` 에 넘긴다. 판본이
 * 같으면 DB 가 바이트 없이 판본만 내고 여기서 304 를 낸다. **304 도 `photo_at` 의 판정을 지난 뒤에만
 * 나간다** — 못 보게 된 사람은 판본을 맞혀도 0행이라 404 다(ADR 0040). 사진을 바꾸거나 다른 장이
 * 그 자리에 앉으면 판본이 달라 새 바이트가 바로 나간다. 줄어드는 것은 바이트뿐이고 DB 왕복은 장마다 하나 그대로다.
 */
export async function photoResponse(request: Request, userId: string, position: number): Promise<NextResponse> {
  const held = heldVersionOf(request.headers.get('if-none-match'));
  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc('photo_at', {
    p_user_id: userId,
    p_position: position,
    ...(held === null ? {} : { p_version: held }),
  });

  /*
    **못 여는 것과 고장 난 것을 가른다.**

    로그인하지 않은 사람에게는 이 문 자체가 닫혀 있어 함수가 「권한이 없다」로 거절한다
    (`28000` · `42501`). 그것을 500 으로 내보내면 「우리가 고장 났다」는 말이 되고, 실제로
    고장 났을 때 그 말이 아무것도 못 가리킨다. 못 보는 사람은 **없는 사람과 같은 답**을
    받는다 — 갈라서 말하면 사람을 세는 문이 된다. 고장 난 것만 기록에 남긴다 — 답에는 원문을 안 싣는다.
  */
  if (error) {
    if (error.code === '42501' || error.code === '28000') return new NextResponse(null, { status: 404 });
    recordDbFailure(error, `photo_at ${position}`);
    return new NextResponse(null, { status: 500 });
  }

  const row = (data ?? [])[0];
  if (row === undefined) return new NextResponse(null, { status: 404 });

  const cache = { ETag: etagOf(row.version), 'Cache-Control': PHOTO_CACHE };
  // 생성 타입은 SQL 함수의 반환 칸을 늘 값으로 적는다 — 판본이 같으면 `base64` 는 `null` 이다(`20261225090000`)
  if (row.base64 === null) return new NextResponse(null, { status: 304, headers: cache });

  return new NextResponse(new Uint8Array(Buffer.from(row.base64, 'base64')), {
    headers: { ...cache, 'Content-Type': row.content_type },
  });
}

/** 브라우저는 든 장을 쓰기 전에 매번 묻는다 — 판정이 매번 DB 에 닿는다 */
export const PHOTO_CACHE = 'private, no-cache';

/** 판본(그 장을 올린 시각의 마이크로초, `profile_photo_version`)을 강한 ETag 로 — 같은 판본은 같은 바이트다 */
export const etagOf = (version: number): string => `"${version}"`;

/** 우리가 단 꼴(`"판본"`, 약한 표지 `W/` 도 받는다) 하나만 판본으로 읽는다. 목록 · `*` · 다른 꼴은 `null` — 바이트를 보낸다 */
const HELD_ETAG = /^\s*(?:W\/)?"(\d{1,16})"\s*$/;

export const heldVersionOf = (ifNoneMatch: string | null): number | null => {
  const match = ifNoneMatch === null ? null : HELD_ETAG.exec(ifNoneMatch);
  if (match === null) return null;
  const version = Number(match[1]);
  return Number.isSafeInteger(version) ? version : null;
};

/** 편집 칸이 여섯이다 — DB 의 `profile_photo_position_check` 와 같은 수 */
const PHOTO_POSITION = /^[1-6]$/;

/** 주소의 자리 번호 — 1..6 이 아니면 `null`(없는 자리와 같은 404) */
export const photoPositionOf = (segment: string): number | null =>
  PHOTO_POSITION.test(segment) ? Number(segment) : null;
