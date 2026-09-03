'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { DELETION_IRREVERSIBLE_NOTE, DELETION_NOTE } from '@/src/lib/account';

import { requestAccountDeletion } from './requests/actions';

/**
 * 떠나는 자리 — **한 번 더 묻고, 무엇이 지워지지 않는지 먼저 말한다.**
 *
 * 「삭제」라고만 적으면 누른 사람은 모든 것이 그 자리에서 사라진다고 읽는다. 실제로는
 * 요청이 접수되는 것이고, 이미 공유된 결과처럼 두 사람의 것인 자료는 한쪽이 지울 수
 * 없다(ADR 0014·0023: 무조건 연쇄 삭제하지 않는다). 그 차이를 누르기 전에 읽힌다.
 *
 * 계정 관리 화면 안에서도 접힌 채로 시작한다. 되돌리기 어려운 작업이므로 설명과
 * 실행 버튼을 처음부터 같은 무게로 세우지 않는다.
 */
export function RequestDeletion() {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  const leave = () => {
    setFailure(null);
    startWorking(async () => {
      const result = await requestAccountDeletion();
      // 성공하면 이 화면이 통째로 「삭제를 요청한 계정입니다」로 바뀐다(`Halted`).
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="self-start text-sm text-secondary underline underline-offset-2"
      >
        계정 삭제 요청
      </button>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-base font-semibold">계정 삭제 요청</h2>
      <p className="text-sm text-secondary">{DELETION_NOTE}</p>
      <p className="text-xs text-muted">{DELETION_IRREVERSIBLE_NOTE}</p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={leave}
          disabled={working}
          className="h-11 rounded-lg border border-border px-4 text-sm text-secondary transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-60 sm:h-10"
        >
          {working ? '보내는 중…' : '삭제를 요청합니다'}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={working}
          className="text-sm text-secondary underline underline-offset-2"
        >
          그만두기
        </button>
        {failure !== null && <span className="text-xs text-muted">{failure}</span>}
      </div>
    </section>
  );
}
