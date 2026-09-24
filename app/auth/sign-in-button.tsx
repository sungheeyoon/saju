'use client';

import { useState } from 'react';
import { supabaseInBrowser } from './browser-client';
import { userFacingDbMessage } from '../db-error';
import { BUTTON_PRIMARY } from '../ui/buttons';

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
      setFailure(userFacingDbMessage(error, 'sign_in'));
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-start">
      <button
        type="button"
        onClick={signIn}
        disabled={going}
        className={`${BUTTON_PRIMARY} w-full sm:w-auto`}
      >
        {going ? '구글로 이동하는 중…' : '구글로 로그인'}
      </button>
      {failure !== null && (
        <p role="alert" className="text-[13px] font-medium text-danger">로그인을 시작하지 못했습니다 — {failure}</p>
      )}
    </div>
  );
}
