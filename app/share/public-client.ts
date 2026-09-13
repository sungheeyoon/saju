import { createClient } from '@supabase/supabase-js';

import { supabaseEnv } from '../auth/config';

/**
 * 공유본 화면이 드는 Supabase — **세션을 아예 안 든다.**
 *
 * 다른 화면은 `supabaseOnServer()` 로 사용자 JWT 를 싣는다. 여기서는 싣지 않는다.
 *
 * 이 화면이 내주는 것은 **누가 보든 같은 한 덩어리**이고, 여는 열쇠는 주소의 토큰
 * 하나다. 쿠키를 읽으면 두 가지가 따라온다 — 만료된 세션을 든 방문자의 요청이
 * 갱신을 시도하다 실패하는 길이 생기고(여기는 `proxy.ts` 가 안 지나가므로 갱신해
 * 줄 자리도 없다), 로그인한 사람과 안 한 사람이 **다른 길로 같은 글**을 읽게 된다.
 *
 * 열쇠(`service_role`)도 아니다. 여는 문은 `shared_reading(token)` 하나이고 그것은
 * `anon` 에게 열려 있다 — 이 저장소에서 로그인 없는 역할에게 연 첫 함수다.
 */
export function supabaseForShared() {
  const { url, publishableKey } = supabaseEnv();

  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
