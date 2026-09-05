'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { supabaseInBrowser } from '../auth/browser-client';

/**
 * 가입 화면에서 나가는 길.
 *
 * 헤더의 설정 메뉴는 `/me` 안에서만 선다(`memberNavigation`). 이 화면은 그 밖이라
 * 로그아웃할 자리가 한 곳도 없었다 — 코드를 못 받은 사람이나 다른 구글 계정으로
 * 들어와야 하는 사람이 주소를 직접 쳐야 했다.
 */
export function SignOutLink() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  return (
    <button
      type="button"
      disabled={leaving}
      onClick={async () => {
        setLeaving(true);
        await supabaseInBrowser().auth.signOut();
        router.replace('/');
        router.refresh();
      }}
      className="self-start text-sm text-secondary underline underline-offset-4 hover:text-foreground disabled:opacity-60"
    >
      {leaving ? '로그아웃하는 중…' : '다른 계정으로 로그인하기'}
    </button>
  );
}
