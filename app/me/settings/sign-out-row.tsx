'use client';

import { useSignOut } from '../../auth/sign-out';
import { SETTINGS_QUIET, SettingsRow } from './card';

/**
 * 계정 관리의 로그아웃 — 톱니 판과 같은 `useSignOut` 한 벌이다.
 *
 * 서버 액션이던 동안에는 `signOut()` 의 오류를 버리고 첫 화면으로 보냈다. 세션이 그대로 남아도 나간 것처럼 보였다.
 */
export function SignOutRow({ email }: { email: string | undefined }) {
  const { leaving, failure, signOut } = useSignOut();

  return (
    <SettingsRow help={email}>
      <button type="button" onClick={signOut} disabled={leaving} className={SETTINGS_QUIET}>
        {leaving ? '로그아웃하는 중…' : '로그아웃'}
      </button>
      {failure !== null && (
        <p role="alert" className="w-full text-sm text-danger">
          {failure}
        </p>
      )}
    </SettingsRow>
  );
}
