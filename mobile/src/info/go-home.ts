import { router } from 'expo-router';

import { supabase } from '@/auth/client';
import { settled } from '@/ui/settled';

/** 처음으로 — 웹의 `HomeLink` 다: 로그인 전이면 `/`, 회원이면 `/me`. 스택에 있으면 거기까지 돌아가 같은 화면이 겹쳐 쌓이지 않는다. 세션을 못 읽으면 `/` 다 — 입구가 다시 본다 */
export async function goHome(): Promise<void> {
  const answer = supabase === null ? null : await settled(supabase.auth.getSession(), 'goHome', () => null);
  router.dismissTo(((answer?.data.session ?? null) === null ? '/' : '/me') as never);
}
