'use client';

import { useState } from 'react';
import { supabaseInBrowser } from './browser-client';

/**
 * 구글 로그인 — 여기서 브라우저가 통째로 이동한다.
 *
 * 돌아오는 자리는 `redirectTo` 에 적은 `/auth/callback` 이고, 그 주소는 구글 콘솔에도
 * 등록돼 있어야 한다. 등록 안 된 주소면 구글이 `redirect_uri_mismatch` 로 대놓고
 * 거절하므로 조용히 실패하지는 않는다.
 */
export function SignInButton({ returnTo = '/me' }: { returnTo?: string }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [going, setGoing] = useState(false);

  const signIn = async () => {
    setGoing(true);
    setFailure(null);

    const callback = new URL('/auth/callback', window.location.origin);
    callback.searchParams.set('next', returnTo);

    const { error } = await supabaseInBrowser().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback.toString() },
    });

    // 성공하면 이 줄에 닿기 전에 화면이 떠난다. 여기 왔다면 못 떠난 것이다.
    if (error) {
      setGoing(false);
      setFailure(error.message);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={signIn}
        disabled={going}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent disabled:opacity-60"
      >
        {going ? '구글로 이동합니다…' : '구글로 로그인'}
      </button>
      {failure !== null && (
        <p className="text-xs text-muted">로그인을 시작하지 못했습니다 — {failure}</p>
      )}
    </div>
  );
}
