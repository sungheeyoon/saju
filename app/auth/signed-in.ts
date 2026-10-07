import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { after } from 'next/server';
import { cache } from 'react';

import type { Database } from '@/src/lib/db';

import { LIVE_REDRAW_COOKIE } from '../live/redraw-mark';

type SignedInUser = { id: string; email: string | undefined };

/**
 * 화면이 **스스로 묻는** 로그인 — 쿠키의 JWT 서명을 이 서버에서 확인한다(ADR 0117).
 *
 * 이 자리는 스물둘이 저마다 `auth.getUser()` 를 부르던 것이다. `getUser` 는 부를 때마다 Auth 서버로
 * 가는 왕복이라, 관문(`proxy.ts`)이 이미 한 확인을 화면이 같은 요청 안에서 한 번 더 했다 — 탭을
 * 한 번 누를 때 네트워크 확인이 둘이었다(ADR 0116 「잠그지 않은 것」, 로컬에서도 한 번에 25~40ms).
 *
 * `getClaims()` 는 프로젝트가 비대칭 키로 서명하면(운영 · 로컬 스택 둘 다 ES256, 2026-09-27 에 잼)
 * 공개 키(JWKS — 프로세스마다 10분 붙든다)로 서명과 만료를 확인하고, 대칭 키로 서명된 토큰이면
 * 알아서 `getUser` 로 물러난다. **화면은 관문이 붙인 것을 믿지 않는다** — 받는 것은 쿠키뿐이고,
 * 서명이 맞지 않으면 아무도 아니다. DB(PostgREST)가 요청마다 하는 확인도 이 서명 확인이다.
 *
 * 서명만으로는 **서버에서 막 끊은 세션**(다른 기기에서 나감 · 계정 삭제)을 못 알아챈다. 그것은
 * 같은 요청에서 먼저 도는 관문의 `getUser` 가 알아채고 그 세션의 쿠키를 걷는다 — 그래서 여기에
 * 도착하는 쿠키에는 그 세션이 없다. 이 둘은 한 벌이고, 이 함수는 `proxy.ts` 의 matcher 안에서만 부른다 — 주소의 입구에서
 * import 를 따라가 이 파일에 닿는 주소가 matcher 안인지를 `app/auth/signed-in.boundary.test.ts` 가 잰다(현관 `/` 은 액션만
 * 관문을 지난다, ADR 0137).
 * 정지 · 탈퇴 대기는 Auth 가 아니라 `app_user.status` 라 DB 가 판정한다 — 여기와 무관하다.
 *
 * **활동도 여기서 적는다**(ADR 0118) — 아래 `noteActivity`.
 */
export async function signedInUser(supabase: SupabaseClient<Database>): Promise<SignedInUser | null> {
  const { data } = await supabase.auth.getClaims();
  if (data === null) return null;
  if (!(await redrawnByTheApp())) noteActivity(supabase);
  return { id: data.claims.sub, email: data.claims.email };
}

/**
 * **활동은 로그인한 사람의 화면이 실제로 그려진 것이다**(ADR 0118) — 앱이 스스로 다시 그린 것은 빼고(위 `redrawnByTheApp`).
 *
 * 관문(`proxy.ts`)에서 적던 동안 미리 받기(prefetch)도 활동이 됐다 — Next 가 미리 받기의 표식
 * (`next-router-prefetch`)을 관문에 넘기기 전에 지우므로(`server/web/adapter.js` 의 `FLIGHT_HEADERS`)
 * 가를 수가 없었다. 2026-09-27 에 재니 홈에서 탭 넷을 두 바퀴(여덟 번) 누르는 동안 미리 받기가 열일곱 번
 * 갔고 그때마다 적는 문이 불렸다. 미리 받기는 화면을 안 그린다(관문만 돌거나 뼈대까지) — 그래서 화면이
 * 부르는 이 자리에서는 가를 것이 없다.
 *
 * 응답을 붙들지 않는다 — 부름은 지금 떠나고 `after` 가 그것이 끝날 때까지 함수를 살려 둔다.
 * 한 그림 안에서 레이아웃과 화면이 둘 다 부르면 `cache` 가 한 번으로 묶는다. 1분에 한 번만 실제로
 * 적히고(ADR 0092) 답은 안 쓴다 — 부속 정보라 실패는 기록에만 남긴다.
 */
function noteActivity(supabase: SupabaseClient<Database>): void {
  const once = thisRender();
  if (once.noted) return;
  once.noted = true;
  after(
    Promise.resolve(supabase.rpc('touch_activity')).then(({ error }) => {
      if (error !== null) console.error('touch_activity', error.code);
    }),
  );
}

/**
 * 라이브 층이 스스로 다시 그린 요청인가 — 그 표지 쿠키를 실었나(`app/live/redraw-mark.ts`, G-76). 사람이 연 화면이 아니라
 * 상대의 메시지 · 대체 조회가 일으킨 그리기라 활동이 아니다.
 */
async function redrawnByTheApp(): Promise<boolean> {
  return (await cookies()).has(LIVE_REDRAW_COOKIE);
}

/** 한 그림 안에서 하나 — 서버 컴포넌트 밖(서버 액션)에서는 부를 때마다 새것이다 */
const thisRender = cache(() => ({ noted: false }));
