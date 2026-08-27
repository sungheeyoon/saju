'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  READING_AUTHORSHIP_NOTE,
  READING_FAILED_NOTE,
  READING_NONE_NOTE,
  READING_ON_REQUEST_NOTE,
  READING_PINNED_NOTE,
  READING_REDACTION_NOTE,
  READING_REPLACES_NOTE,
  READING_SCORE_NOTE,
  READING_STALE_NOTE,
  readingOrderNote,
} from '@/src/lib/reading';

import { generateReading } from './actions';
import type { CurrentReading } from './current';
import { Markdown } from './markdown';
import type { ReadingTarget } from './pipeline';

const MOCK_OUTPUT = `## 지금의 핵심

당신의 명식은 **한 방향으로 빠르게 밀어붙이기보다, 주변의 흐름을 읽고 자신의 기준을 세울 때 힘이 나는 구조**로 보입니다. 겉으로는 차분하게 상황을 정리하지만, 납득할 만한 이유가 생기면 생각보다 결단이 빠른 편입니다.

## 강점이 드러나는 방식

목과 수의 흐름은 새로운 정보를 받아들이고 연결하는 힘으로 이어집니다. 처음부터 정답을 내기보다 여러 가능성을 살핀 뒤 공통점을 찾는 일에 강점이 있습니다. 사람 사이에서는 말의 표면보다 맥락을 읽으려는 태도로 나타날 수 있습니다.

- 복잡한 일을 순서와 기준으로 정리할 때 집중력이 좋아집니다.
- 혼자 결론을 품고 있기보다 믿을 만한 사람과 대화할 때 생각이 선명해집니다.
- 변화가 필요한 순간에도 준비할 시간을 확보하면 훨씬 안정적으로 움직입니다.

## 균형을 위한 제안

생각이 충분히 정리될 때까지 행동을 미루면 좋은 타이밍을 놓칠 수 있습니다. 모든 변수를 확인하려 하기보다 **지금 확인된 사실과 나중에 보완할 부분을 나누는 방식**이 도움이 됩니다. 중요한 선택에서는 완벽한 확신보다 작은 실행으로 반응을 확인해 보세요.

## 관계에서 기억할 점

상대의 상황을 먼저 헤아리는 태도는 장점이지만, 내 기준을 늦게 말하면 상대는 동의한 것으로 오해할 수 있습니다. 불편함이 커진 뒤 설명하기보다 초반에 “나는 이 부분이 중요하다”라고 짧게 경계를 알려주는 편이 관계의 피로를 줄입니다.

---

이 해석은 저장된 명식 근거를 바탕으로 현재 확인 가능한 경향을 설명합니다. 출생 시각이 없거나 계산 근거가 제한된 부분은 단정하지 않았으며, 중요한 결정을 대신하는 판단으로 사용하지 마세요.`;

type Phase = 'idle' | 'loading' | 'error';

export function ReadingPanel({
  target,
  initialReading,
  initialFailed,
  allowMockFallback,
}: {
  target: ReadingTarget;
  initialReading: CurrentReading | null;
  initialFailed: boolean;
  allowMockFallback: boolean;
}) {
  const router = useRouter();
  const [mockReading, setMockReading] = useState<CurrentReading | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [failure, setFailure] = useState(initialFailed ? READING_FAILED_NOTE : null);
  const [isMock, setIsMock] = useState(false);
  const reading = mockReading ?? initialReading;

  const showMock = () => {
    setMockReading({
      id: 'development-preview',
      score: target.kind === 'self' ? null : 78,
      output: MOCK_OUTPUT,
      model: 'development-preview',
      viewedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      viewerIsFirst: true,
      fromCurrentRevision: true,
    });
    setIsMock(true);
    setFailure('풀이를 만드는 연결을 지금 쓸 수 없어, 화면 검토용 예시 글을 대신 보이고 있습니다.');
    setPhase('idle');
  };

  const generate = async () => {
    setPhase('loading');
    setFailure(null);
    setMockReading(null);
    setIsMock(false);

    let result: Awaited<ReturnType<typeof generateReading>>;
    try {
      [result] = await Promise.all([
        generateReading(target, crypto.randomUUID()),
        new Promise((resolve) => setTimeout(resolve, 900)),
      ]);
    } catch {
      if (allowMockFallback) {
        showMock();
        return;
      }
      setFailure('예상하지 못한 오류로 풀이를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
      setPhase('error');
      return;
    }

    if (result.ok) {
      setPhase('idle');
      // 성공한 저장은 Server Action 응답에 새 RSC 화면이 함께 오고, 중복 요청은 저장을
      // 하지 않으므로 그때만 현재 결과를 한 번 다시 읽는다.
      if (!result.replaced) router.refresh();
      return;
    }

    if (allowMockFallback) {
      showMock();
      return;
    }

    setFailure(result.message);
    setPhase('error');
  };

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">사주풀이</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">
            {target.kind === 'self' ? '나의 사주풀이' : '두 사람의 사주풀이'}
          </h2>
        </div>
        {reading !== null && (
          <div className="flex items-center gap-2">
            {isMock && <span className="rounded-full bg-warning-wash px-2.5 py-1 text-[11px] font-semibold text-warning">예시 결과</span>}
            <span className="text-xs text-muted">{when(reading.createdAt)} 생성</span>
          </div>
        )}
      </header>

      {phase === 'loading' ? (
        <LoadingState />
      ) : reading === null ? (
        <EmptyState />
      ) : (
        <Result reading={reading} target={target} />
      )}

      {failure !== null && (
        <div role={phase === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-3 text-sm leading-6 ${phase === 'error' ? 'bg-danger-wash text-danger' : 'bg-warning-wash text-warning'}`}>
          <p>{failure}</p>
          {phase === 'error' && (
            <button type="button" onClick={generate} className="mt-2 font-semibold underline underline-offset-4">다시 시도하기</button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">{reading === null ? '명식 근거로 풀이를 받아 보세요' : '지금 풀이를 새로 받을 수 있어요'}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted">{reading === null ? READING_NONE_NOTE : READING_REPLACES_NOTE}</p>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={phase === 'loading'}
            className="h-11 shrink-0 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent shadow-sm hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-wait disabled:opacity-60 sm:h-10"
          >
            {phase === 'loading' ? '풀이를 쓰고 있어요…' : reading === null ? '사주풀이 받기' : '다시 풀이받기'}
          </button>
        </div>
        {/*
          누가 썼는지와 무엇을 안 넘겼는지는 **만드는 버튼 옆**에 선다(`notes.ts`).
          제목이 아니라 여기인 이유는, 이 두 사실이 필요한 시점이 글을 읽을 때가
          아니라 만들지 말지를 정할 때이기 때문이다.
        */}
        <p className="text-xs leading-5 text-muted">{READING_AUTHORSHIP_NOTE}</p>
        <p className="text-xs leading-5 text-muted">{READING_REDACTION_NOTE}</p>
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-border-strong bg-surface-soft px-5 py-10 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-wash text-xl text-accent" aria-hidden="true">✦</span>
        <h3 className="mt-4 text-base font-bold">아직 받아 둔 풀이가 없어요</h3>
        <p className="mt-2 text-sm leading-6 text-secondary">복잡한 명식 정보를 핵심 성향, 강점, 균형을 위한 제안으로 나누어 읽기 쉽게 정리합니다.</p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div role="status" aria-live="polite" className="rounded-2xl bg-accent-wash p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 animate-pulse place-items-center rounded-full bg-accent text-on-accent" aria-hidden="true">✦</span>
        <div>
          <p className="font-semibold">명식의 흐름을 이어 읽고 있어요</p>
          <p className="text-xs text-secondary">근거를 확인하고, 단정하지 않는 문장으로 옮깁니다.</p>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-3" aria-hidden="true">
        <div className="reading-skeleton h-4 w-2/5 rounded-full" />
        <div className="reading-skeleton h-3 w-full rounded-full" />
        <div className="reading-skeleton h-3 w-11/12 rounded-full" />
        <div className="reading-skeleton h-3 w-4/5 rounded-full" />
      </div>
      <p className="mt-5 text-xs text-muted">보통 1분 안에 완성됩니다. 이 화면을 그대로 두어 주세요.</p>
    </div>
  );
}

function Result({ reading, target }: { reading: CurrentReading; target: ReadingTarget }) {
  return (
    <div className="flex flex-col gap-5">
      {reading.score !== null && (
        <div className="flex flex-col gap-2 rounded-2xl bg-accent-wash p-5 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-semibold text-accent">현재 관계 해석 점수</p><p className="mt-1 text-4xl font-bold tabular-nums">{reading.score}<span className="ml-1 text-base font-medium text-secondary">/ 100</span></p></div>
          <p className="max-w-md text-xs leading-5 text-muted">{READING_SCORE_NOTE}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-muted">
        {target.kind === 'match' && <p>{readingOrderNote(reading.viewerIsFirst)}</p>}
        <p>{READING_ON_REQUEST_NOTE}</p>
        {target.kind === 'match' ? <p>{READING_PINNED_NOTE}</p> : !reading.fromCurrentRevision && <p className="text-danger">{READING_STALE_NOTE}</p>}
      </div>
      <article className="rounded-2xl border border-border bg-surface-raised p-5 shadow-[var(--shadow-card)] sm:p-7 lg:p-8">
        <Markdown source={reading.output} />
      </article>
    </div>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}
