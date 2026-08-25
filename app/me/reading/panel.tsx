'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { READING_REPLACES_NOTE } from '@/src/lib/reading';

import { generateReading } from './actions';
import type { ReadingTarget } from './pipeline';

const PRIMARY =
  'h-11 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-60 sm:h-10';

/**
 * **AI 를 부르는 유일한 버튼.**
 *
 * 화면을 여는 것으로는 아무 일도 일어나지 않는다(ADR 0001). 그 규율이 화면에서도
 * 눈에 보이도록, 만드는 일은 사용자가 누르는 자리 하나에만 있다.
 *
 * 누르기 전에 **새로 만들면 지금 것이 사라진다**는 말이 서 있다. 이력을 쌓지 않기로
 * 했으므로 그 사실을 누른 뒤에 알게 하면 안 된다.
 */
export function GenerateButton({
  target,
  hasCurrent,
}: {
  target: ReadingTarget;
  hasCurrent: boolean;
}) {
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={PRIMARY}
          disabled={working}
          onClick={() =>
            startWorking(async () => {
              setFailure(null);
              /**
               * **누름 하나에 열쇠 하나.** 같은 누름이 두 번 실려 가도 서버는 그것을
               * 알아본다. 창이 둘이면 열쇠가 다르지만, 그때는 DB 의 대상별 잠금이 막는다.
               */
              const result = await generateReading(target, crypto.randomUUID());

              if (!result.ok) {
                setFailure(result.message);
                return;
              }
              router.refresh();
            })
          }
        >
          {working ? '만드는 중…' : hasCurrent ? '새로 만들기' : 'AI 해석 만들기'}
        </button>

        {/* 오래 걸리는 일이라 무엇을 기다리는지 말한다 */}
        {working && <span className="text-xs text-muted">한 번에 한 편을 씁니다. 조금 걸립니다.</span>}
      </div>

      {hasCurrent && <p className="text-xs text-muted">{READING_REPLACES_NOTE}</p>}

      {failure !== null && (
        <p role="alert" className="text-sm text-danger">
          {failure}
        </p>
      )}
    </div>
  );
}
