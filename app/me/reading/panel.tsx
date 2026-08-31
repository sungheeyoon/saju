'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  READING_ALREADY_RUNNING_NOTE,
  READING_AUTHORSHIP_NOTE,
  READING_LEAVE_SAFE_NOTE,
  READING_FAILED_NOTE,
  READING_NONE_NOTE,
  READING_ON_REQUEST_NOTE,
  READING_PINNED_NOTE,
  READING_REDACTION_NOTE,
  READING_REPLACES_NOTE,
  READING_SCORE_NOTE,
  READING_STALE_NOTE,
  readingOrderNote,
  readingWaitNote,
} from '@/src/lib/reading';

import { generateReading, readingRunState } from './actions';
import { GENERATION } from './generation';
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
  initialRunning,
  allowMockFallback,
  layout = 'card',
}: {
  target: ReadingTarget;
  initialReading: CurrentReading | null;
  initialFailed: boolean;
  /**
   * 이 화면을 여는 지금 **서버에 도는 시도가 있는가.**
   *
   * 만드는 일이 누름의 요청에서 떨어져 나온 뒤로 생긴 값이다. 새로고침하고 돌아오거나
   * 다른 기기에서 열어도 만들던 것은 계속 돌고 있으므로, 화면은 그 사실을 알고 기다리는
   * 모습으로 열려야 한다. 모르면 「아무것도 안 하고 있다」고 말하게 된다.
   */
  initialRunning: boolean;
  allowMockFallback: boolean;
  /**
   * 이 칸이 **카드인가 페이지인가.**
   *
   * `card` 는 다른 것들 사이에 끼어 있는 자리다(`/me` 의 자기 풀이). 긴 글을 접어
   * 두고 만드는 버튼을 아래에 둔다.
   *
   * `page` 는 그 글을 읽으러 온 자리다. **이미 상세 화면인데 또 펼쳐 보라고 하지
   * 않는다** — 한 번 더 누르게 하는 것은 아무것도 아끼지 않는다. 그리고 다시 받는
   * 버튼은 위로 간다. 그것은 글을 읽기 **전에** 정하는 일이라 8천 자 뒤에 있으면
   * 없는 것과 같다.
   */
  layout?: 'card' | 'page';
}) {
  const router = useRouter();
  const [mockReading, setMockReading] = useState<CurrentReading | null>(null);
  const [phase, setPhase] = useState<Phase>(initialRunning ? 'loading' : 'idle');
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

  /**
   * **도는 시도를 지켜본다.** 끝나면 화면을 다시 읽는다.
   *
   * 누른 그 화면에서만 도는 것이 아니다. 새로고침하고 돌아오거나 다른 기기에서 열어도
   * 서버에는 도는 시도가 있으므로(`initialRunning`), 이 고리는 **마운트될 때부터**
   * 돈다. 만드는 일이 요청에서 떨어져 나온 뒤로 그것이 가능해졌다.
   */
  useEffect(() => {
    if (phase !== 'loading') return;

    let alive = true;
    const ask = async () => {
      let run: Awaited<ReturnType<typeof readingRunState>>;
      try {
        run = await readingRunState(target);
      } catch {
        // 한 번 못 물은 것으로 끝났다고 하지 않는다. 다음 물음에서 다시 본다.
        return;
      }
      if (!alive || run === null || run.status === 'running') return;

      setPhase('idle');
      if (run.status === 'failed') setFailure(READING_FAILED_NOTE);
      /*
        끝난 것을 보면 **언제나 다시 읽는다.** 결과는 서버에만 있고, 이 칸이 들고 있는
        것은 마지막으로 그린 화면이다. 다시 안 읽으면 교체로 사라진 옛 글을 계속 세운다.
      */
      router.refresh();
    };

    // 물어보는 간격은 짧게 잡지 않는다 — 4분짜리 일에 1초짜리 왕복은 값만 쓴다.
    const tick = setInterval(ask, 3000);

    return () => {
      alive = false;
      clearInterval(tick);
    };
  }, [phase, target, router]);

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
      /*
        **답이 결과가 아니라 시작 여부다.** 열었으면 기다리는 화면에 그대로 머문다 —
        만드는 일은 응답 뒤에 돌고, 위의 고리가 끝나는 것을 본다.

        열지 못했으면(이미 도는 시도가 있다) 그것도 기다릴 일이다. 남이 열었든 내가
        아까 열었든 그 시도가 끝나면 새 글이 선다. 다만 **내가 방금 연 것이 아니라는
        사실**은 말해 준다 — 안 그러면 「눌렀는데 그대로」로 보인다.
      */
      if (!result.started) setFailure(READING_ALREADY_RUNNING_NOTE);
      return;
    }

    if (allowMockFallback) {
      showMock();
      return;
    }

    setFailure(result.message);
    setPhase('error');
  };

  const onPage = layout === 'page';

  const makeBlock = (
    <div
      className={`flex flex-col gap-3 ${onPage ? 'rounded-2xl border border-border bg-surface px-5 py-4' : 'border-t border-border pt-5'}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">
            {reading === null ? '명식 근거로 풀이를 받아 보세요' : '지금 풀이를 새로 받을 수 있어요'}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted">
            {reading === null ? READING_NONE_NOTE : READING_REPLACES_NOTE}
          </p>
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
  );

  const alert = failure === null ? null : (
    <div
      role={phase === 'error' ? 'alert' : 'status'}
      className={`rounded-xl px-4 py-3 text-sm leading-6 ${phase === 'error' ? 'bg-danger-wash text-danger' : 'bg-warning-wash text-warning'}`}
    >
      <p>{failure}</p>
      {phase === 'error' && (
        <button type="button" onClick={generate} className="mt-2 font-semibold underline underline-offset-4">
          다시 시도하기
        </button>
      )}
    </div>
  );

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
            {isMock && (
              <span className="rounded-full bg-warning-wash px-2.5 py-1 text-[11px] font-semibold text-warning">
                예시 결과
              </span>
            )}
            <span className="text-xs text-muted">{when(reading.createdAt)} 생성</span>
          </div>
        )}
      </header>

      {/*
        **다시 받는 버튼이 글 위에 선다.** 그것은 글을 읽기 전에 정하는 일이라, 8천 자
        뒤에 있으면 없는 것과 같다. 카드로 설 때는 반대다 — 거기서는 이 칸이 다른 것들
        사이에 끼어 있어서, 먼저 무엇이 있는지 보이고 나서 만들지 말지를 정한다.
      */}
      {onPage && makeBlock}
      {onPage && alert}

      {phase === 'loading' ? (
        <LoadingState />
      ) : reading === null ? (
        <EmptyState />
      ) : (
        <Result reading={reading} target={target} alwaysOpen={onPage} />
      )}

      {!onPage && alert}
      {!onPage && makeBlock}
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

/**
 * **멈춘 화면이 아니라는 것을 무엇이 말하는가.**
 *
 * 스피너는 서버가 죽어도 계속 돈다. 그래서 오래 걸리는 일에서 스피너는 「살아 있다」를
 * 말하지 못한다 — 30초쯤 지나면 사용자는 고장으로 읽는다.
 *
 * 올라가는 숫자는 다르다. 초가 늘어나는 것은 **브라우저가 이 화면을 아직 붙들고
 * 있다**는 증거이고, 사람은 그것을 그렇게 읽는다. 그래서 여기서 세는 것을 「진행률」이라
 * 부르지 않는다 — 서버가 지금 어느 단계인지 우리는 모르고, 시간만 보고 단계를 지어
 * 보이면 그건 꾸며 낸 진행이다. 이 저장소가 값에 대고 지켜 온 규율을 화면에서 깰 이유가 없다.
 */
function LoadingState() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    /**
     * **틱을 세지 않고 시각을 뺀다.** 배경 탭에서는 `setInterval` 이 눌려서 늦게 돌고,
     * 틱을 세면 그만큼 적게 센다 — 다른 탭을 보다 돌아온 사람에게 「10초째」라고 말하게 된다.
     */
    const startedAt = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);

    return () => clearInterval(tick);
  }, []);

  return (
    <div role="status" aria-live="polite" className="rounded-2xl bg-accent-wash p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 animate-pulse place-items-center rounded-full bg-accent text-on-accent" aria-hidden="true">✦</span>
        <div className="min-w-0">
          <p className="font-semibold">명식의 흐름을 이어 읽고 있어요</p>
          <p className="text-xs text-secondary">근거를 확인하고, 단정하지 않는 문장으로 옮깁니다.</p>
        </div>
        {/*
          **읽어 주지 않는다.** 바깥이 `aria-live` 라 이 숫자가 매초 낭독되면 화면
          낭독기를 쓰는 사람에게는 글을 읽을 수 없는 칸이 된다. 살아 있다는 신호는
          눈으로 보는 사람에게 필요한 것이고, 낭독되는 문장은 위의 한 줄로 족하다.
        */}
        <p aria-hidden="true" className="ml-auto shrink-0 text-sm font-semibold tabular-nums text-accent">
          {elapsed}초
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-3" aria-hidden="true">
        <div className="reading-skeleton h-4 w-2/5 rounded-full" />
        <div className="reading-skeleton h-3 w-full rounded-full" />
        <div className="reading-skeleton h-3 w-11/12 rounded-full" />
        <div className="reading-skeleton h-3 w-4/5 rounded-full" />
      </div>
      <p className="mt-5 text-xs leading-5 text-muted">
        {readingWaitNote(GENERATION.settings.timeout)} {READING_LEAVE_SAFE_NOTE}
      </p>
    </div>
  );
}

function Result({
  reading,
  target,
  alwaysOpen,
}: {
  reading: CurrentReading;
  target: ReadingTarget;
  /** 상세 화면에서는 접지 않는다 — 그 글을 읽으러 온 자리다 */
  alwaysOpen: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const open = alwaysOpen || expanded;

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
      <div className="overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-[var(--shadow-card)]">
        {/* 상세 화면에는 여는 버튼이 없다 — 이미 그 글을 읽으러 온 자리다 */}
        {!alwaysOpen && (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-controls={`reading-${reading.id}`}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-surface-soft sm:px-7"
          >
            <span>
              <span className="block text-sm font-bold">사주풀이 전문</span>
              <span className="mt-0.5 block text-xs text-muted">
                {expanded ? '긴 풀이를 접어 화면을 간단히 볼 수 있어요.' : '핵심 성향부터 관계 조언까지 이어서 읽어보세요.'}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-accent">
              {expanded ? '접기 ↑' : '펼쳐보기 ↓'}
            </span>
          </button>
        )}
        {open && (
          <article
            id={`reading-${reading.id}`}
            className={`p-5 sm:p-7 lg:p-8 ${alwaysOpen ? '' : 'border-t border-border'}`}
          >
            <Markdown source={reading.output} />
          </article>
        )}
      </div>
    </div>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}
