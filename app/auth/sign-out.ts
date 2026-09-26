'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { supabaseInBrowser } from './browser-client';

/**
 * 로그아웃 한 벌 — 머리글의 톱니 판 · 계정 관리 · 가입 화면의 나가는 길이 같이 부른다.
 *
 * **실패하면 그 자리에서 말한다.** 세 자리가 저마다 `signOut()` 을 부르던 동안 둘은 오류를 버리고 첫 화면으로
 * 보냈다 — 세션이 그대로인데 나간 것처럼 보였다(2026-09-26). 실패 문장은 부른 자리가 `role="alert"` 로 세운다.
 */
export function useSignOut(): { leaving: boolean; failure: string | null; signOut: () => Promise<void> } {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const signOut = async () => {
    setLeaving(true);
    setFailure(null);
    const { error } = await supabaseInBrowser().auth.signOut();
    if (error) {
      setLeaving(false);
      setFailure('로그아웃하지 못했습니다. 다시 시도해 주세요.');
      return;
    }
    router.replace('/');
    router.refresh();
  };

  return { leaving, failure, signOut };
}
