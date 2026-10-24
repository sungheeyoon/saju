'use client';

import { SIGN_OUT_PENDING } from '@/src/lib/account/copy';

import { useSignOut } from '../../auth/sign-out';
import { SETTINGS_TEXT_ROW } from './card';
import { FailureLine } from '../../ui/failure-line';

/**
 * 계정 관리의 로그아웃 — 톱니 판과 같은 `useSignOut` 한 벌이다.
 *
 * **알약이 아니라 글자 줄이다**(2026-10-25 설정 목록 재배치) — 로그인 정보 무리의 마지막 줄로, 줄 전체가 누를 자리다. 이메일은 그
 * 위 줄이 든다(`page.tsx`).
 *
 * 서버 액션이던 동안에는 `signOut()` 의 오류를 버리고 첫 화면으로 보냈다. 세션이 그대로 남아도 나간 것처럼 보였다.
 */
export function SignOutRow() {
  const { leaving, failure, signOut } = useSignOut();

  return (
    <div className="flex flex-col border-t border-border first:border-0">
      <button
        type="button"
        onClick={() => {
          if (!leaving) void signOut();
        }}
        aria-disabled={leaving || undefined}
        className={SETTINGS_TEXT_ROW}
      >
        {leaving ? SIGN_OUT_PENDING : '로그아웃'}
      </button>
      {failure !== null && <FailureLine className="pb-4">{failure}</FailureLine>}
    </div>
  );
}
