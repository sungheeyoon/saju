import { NextResponse } from 'next/server';

import { isPhotoObjectKey, variantKey, type PhotoVariant } from '@/src/lib/profile';

import { supabaseOnServer } from '../../auth/server-client';
import { recordDbFailure } from '../../db-error';
import { photoStoreIfReady } from './s3-store';
import { storeErrorClassOf } from './store';

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
 * ## 캐시는 **사람마다** 든다
 *
 * `private` 이다. 중간 캐시가 한 사람에게 내준 얼굴을 다음 사람에게 주면, 「볼 수 있는
 * 사람에게만」이 캐시 한 겹으로 무너진다. 짧게 잡는 것은 사진을 바꾸거나 상대를 감췄을
 * 때 그만큼만 늦게 반영되게 하려는 것이다. 순서를 바꿔도 같다 — 남의 카드의 2번 장은 길어야
 * 1분 옛 장이다.
 */
export async function photoResponse(userId: string, position: number, variant: PhotoVariant = 'large'): Promise<NextResponse> {
  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc('photo_at', { p_user_id: userId, p_position: position });

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

  if (row.base64) return photoBytes(new Uint8Array(Buffer.from(row.base64, 'base64')), row.content_type);

  /*
    **저장소에 사는 장 — 판정을 지난 줄의 열쇠로 읽어 낸다**(G-120 의 안 A, 결정 전 draft). 판정은 위의 `photo_at` 이 이미 했다 —
    여기는 그 줄이 든 열쇠만 쓴다(주소의 값으로 열쇠를 짓지 않는다). 저장소가 꺼졌는데 열쇠 줄이 있으면 우리가 고장 난 것이라 500,
    객체가 없으면(지운 뒤 DB 를 되돌림 등) 없는 장과 같은 404 다.
  */
  if (!row.object_key || !isPhotoObjectKey(row.object_key)) return new NextResponse(null, { status: 404 });
  const store = photoStoreIfReady();
  if (store === null) {
    console.error('photo-store: 열쇠 줄이 있는데 저장소가 꺼졌다');
    return new NextResponse(null, { status: 500 });
  }
  try {
    const stored = await store.get(variantKey(row.object_key, variant));
    if (stored === null) return new NextResponse(null, { status: 404 });
    return photoBytes(stored.body, row.content_type);
  } catch (thrown) {
    console.error('photo-store: 사진을 읽지 못했다', storeErrorClassOf('get', thrown));
    return new NextResponse(null, { status: 500 });
  }
}

function photoBytes(body: Uint8Array, contentType: string): NextResponse {
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=60',
    },
  });
}

/** 주소의 `?s=card` — 작은 자리(아바타 · 편집 칸)가 작은 벌을 받는다. 그 밖은 큰 벌 */
export const photoVariantOf = (request: Request): PhotoVariant =>
  new URL(request.url).searchParams.get('s') === 'card' ? 'card' : 'large';

/** 편집 칸이 여섯이다 — DB 의 `profile_photo_position_check` 와 같은 수 */
const PHOTO_POSITION = /^[1-6]$/;

/** 주소의 자리 번호 — 1..6 이 아니면 `null`(없는 자리와 같은 404) */
export const photoPositionOf = (segment: string): number | null =>
  PHOTO_POSITION.test(segment) ? Number(segment) : null;
