import { router } from 'expo-router';
import { useState } from 'react';

import { signInWithGoogle } from '@/auth/sign-in';

/**
 * 로그인을 지나 앱 안으로 — 첫 화면의 입구 · 공유본의 초대가 쓴다. 앱에는 로그인 화면이 따로 없고 구글 창이 그 자리다.
 * 가입이 안 끝났으면 가입 화면으로 가고, 끝나면 입구(`/`)가 홈으로 보낸다.
 */
export function useStart(destination: string) {
  const [going, setGoing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const start = async () => {
    setFailure(null);
    setGoing(true);
    const signIn = await signInWithGoogle();
    setGoing(false);
    if (signIn.kind === 'failed') setFailure(signIn.message);
    if (signIn.kind === 'needs-signup') router.push('/signup');
    if (signIn.kind === 'signed-in') router.replace(destination as never);
  };

  return { start, going, failure };
}
