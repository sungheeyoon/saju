'use client';

import { useSignOut } from '../auth/sign-out';

/**
 * 가입 화면에서 나가는 길 — 코드를 못 받은 사람이나 다른 구글 계정으로 들어와야 하는 사람의 자리.
 *
 * 머리글의 톱니 판도 이 화면에 서고 거기에도 로그아웃이 있다. 그래도 이 길을 본문에 둔다 — 톱니는 「다른 계정으로
 * 들어온다」는 뜻을 말하지 않는다. 둘 다 `useSignOut` 한 벌을 부르고, 실패하면 그 자리에서 말한다.
 */
export function SignOutLink() {
  const { leaving, failure, signOut } = useSignOut();

  return (
    <div className="flex flex-col items-center gap-1 self-center sm:items-start sm:self-start">
      <button
        type="button"
        disabled={leaving}
        onClick={signOut}
        className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-secondary underline decoration-border-strong decoration-2 underline-offset-[6px] hover:text-foreground hover:decoration-foreground disabled:opacity-55"
      >
        {leaving ? '로그아웃하는 중…' : '다른 계정으로 로그인하기'}
      </button>
      {failure && (
        <p role="alert" className="px-1 text-[13px] text-danger">
          {failure}
        </p>
      )}
    </div>
  );
}
