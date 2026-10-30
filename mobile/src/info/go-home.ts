import { router } from 'expo-router';

import { supabase } from '@/auth/client';

/** 처음으로 — 웹의 `HomeLink` 다: 로그인 전이면 `/`, 회원이면 `/me`. 스택에 있으면 거기까지 돌아가 같은 화면이 겹쳐 쌓이지 않는다 */
export async function goHome(): Promise<void> {
  const session = supabase === null ? null : (await supabase.auth.getSession()).data.session;
  router.dismissTo((session === null ? '/' : '/me') as never);
}
