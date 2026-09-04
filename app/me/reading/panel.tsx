'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  READING_ALREADY_RUNNING_NOTE,
  READING_LEAVE_SAFE_NOTE,
  READING_FAILED_NOTE,
  READING_NONE_NOTE,
  READING_PINNED_NOTE,
  READING_REDACTION_NOTE,
  READING_REPLACES_NOTE,
  READING_SCORE_NOTE,
  READING_STALE_NOTE,
  isScored,
  readingCreditsNote,
  readingOrderNote,
  readingWaitNote,
} from '@/src/lib/reading';

import { generateReading, readingRunState } from './actions';
import { announceCreditsMoved } from './credits-signal';
import { GENERATION } from './generation';
import type { CurrentReading, ReadingCredits } from './current';
import { ReadingFeedback } from './feedback';
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
  credits,
  consented,
  heading,
  allowMockFallback,
  layout = 'card',
  automatic = false,
  ask,
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
  /**
   * 남은 풀이권 — **못 물었으면 `null`.**
   *
   * 모르면 그 줄을 아예 안 세운다. 「알 수 없음」을 세우면 사용자가 있지도 않은 숫자를
   * 세어 보게 되고, 만들지 말지를 그 값으로 정하게 된다.
   */
  credits: ReadingCredits | null;
  /**
   * 설문을 세울 수 있는가 — 개선 활용에 **동의한 사람만.**
   *
   * `improvementConsented()` 가 `null`(아직 안 물었다)과 `false`(거절했다)를 이미 하나로
   * 좁혀 준다. 여기서 다시 `?? false` 를 적으면 좁히는 자리가 둘이 된다.
   *
   * 점수와 태그도 이 뒤에 있다. 설문은 서비스 제공에 필요한 처리가 아니라 우리가 더
   * 나은 것을 만들려고 받는 것이라, 자유로운 선택 동의 뒤에 서야 한다. 거절해도
   * 사주는 하나도 안 좁아진다 — 위의 모든 칸이 이 값을 묻지 않는다.
   */
  consented: boolean;
  /**
   * 이 칸의 제목 — **부르는 쪽이 정한다.**
   *
   * kind 로 지어내던 자리다(`self` 면 「나의 사주풀이」, 아니면 「두 사람의 사주풀이」).
   * 저장한 사람의 풀이가 생기면서 그 방식이 끝났다 — 「{이름}의 사주풀이」는 이 칸이
   * 알 수 없는 값이고, 이름을 여기서 또 읽어 오면 화면이 이미 들고 있는 것을 한 번 더
   * 묻는 일이 된다.
   */
  heading: string;
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
  /**
   * **다음 풀이를 위해 먼저 정할 것.**
   *
   * 만드는 버튼과 같은 덩어리에 선다. 이 자리에 있는 물음은 지금 서 있는 글이 아니라
   * **다음 글**을 바꾸는 것이라, 글 위도 아래도 아닌 **버튼 옆**이 답이다 — 무엇을 안
   * 넘겼는지를 여기 세운 것과 같은 까닭이다(`notes.ts`).
   *
   * 지금은 비공개 궁합의 「무슨 사이인가」 하나뿐이다. 자기 풀이에는 상대가 없고 공유
   * 궁합은 성립 방식이 사이를 정한다.
   */
  /**
   * 이 글을 **동의가 만드는가** (ADR 0038).
   *
   * 공유 궁합이 그렇다. 요청할 때 풀이권을 예약하고 동의가 그것을 쓰므로, 성공 경로에는
   * **누를 것이 아무것도 없다** — 「먼저 누른 사람」이 사라지는 것은 누를 것이 없어져서다.
   *
   * **실패 경로에서까지 없애지는 않는다.** 글도 없고 도는 시도도 없으면 그 자리는 막다른
   * 골목이 되고, 그것은 이 ADR 이 없애려던 바로 그 자리다. 그때는 「다시 만들기」가 서고,
   * 누른 사람이 한 번을 쓴다(ADR 0017 — 드물고 눈에 보이는 자리다).
   */
  automatic?: boolean;
  ask?: ReactNode;
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
      score: isScored(target.kind) ? 78 : null,
      output: MOCK_OUTPUT,
      model: 'development-preview',
      viewedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      viewerIsFirst: true,
      fromCurrentRevision: true,
      /* 예시 결과에는 만든 시도가 없다 — 그래서 설문도 안 붙는다 */
      sourceRunId: null,
      myFeedback: null,
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
        끝난 자리에서 외친다. 성공이면 잡고 있던 자리가 쓴 자리로 옮겨 가고 실패면
        그 자리가 풀린다 — 어느 쪽이든 헤더가 들고 있는 숫자는 낡았다.
      */
      announceCreditsMoved();
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
      /* 시도가 열렸으면 그 자리를 이미 잡았다 — 성공을 기다리지 않고 알린다 */
      announceCreditsMoved();
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

  /**
   * 되돌릴 수 없는 누름 앞의 확인 창 — **경고를 읽는 시점을 누름에 붙인다.**
   *
   * 새로 만들면 지금 글과 점수는 사라진다(ADR 0013: 통째로 교체). 그 사실은 한동안
   * 버튼 옆에 늘 적혀 있었는데, 늘 적혀 있는 문장은 누르려는 사람에게 **읽히지 않는
   * 시점**에 서 있는 것과 같다. 여기서는 누른 사람만, 누른 그때 읽는다.
   *
   * **처음 만들 때는 안 묻는다.** 사라질 것이 없으면 확인은 걸음 하나를 늘리는 일일
   * 뿐이다 — 확인 창은 잃는 것이 있을 때만 값을 한다.
   *
   * 상태를 안 든다. `<dialog>` 가 열림·닫힘을 스스로 들고, Esc 와 초점 가둠도 브라우저가
   * 한다 — 그 셋을 손으로 다시 만들면 세 자리가 더 생긴다.
   */
  const confirming = useRef<HTMLDialogElement>(null);

  const press = () => {
    if (reading === null) {
      void generate();
      return;
    }
    confirming.current?.showModal();
  };

  const replace = () => {
    confirming.current?.close();
    void generate();
  };

  const onPage = layout === 'page';

  /*
    **다 쓴 것과 기다리는 것을 가른다.** 도는 시도가 자리를 잡고 있는 동안에는 버튼을
    닫지 않는다 — 그 사람이 누르면 DB 가 「끝나면 다시 눌러 주세요」로 답하고, 그것이
    이 화면이 대신 말해 줄 수 없는 사실이다(다른 대상을 만들고 있을 수도 있다).
  */
  const spent = credits !== null && credits.available === 0 && credits.reserved === 0;
  const creditsNote = credits === null ? null : readingCreditsNote(credits);

  /**
   * **누를 것이 있는가.**
   *
   * 동의가 만드는 글은 성공 경로에 버튼이 없다 — 이미 있는 글도, 지금 만들고 있는 것도
   * 누를 일이 아니다. 남는 자리는 **아무것도 없는 자리** 하나이고, 그때만 버튼이 선다.
   */
  const hideMake = automatic && (reading !== null || phase === 'loading');

  const makeBlock = hideMake ? null : (
    <div
      className={`flex flex-col gap-3 ${onPage ? 'rounded-2xl border border-border bg-surface px-5 py-4' : 'border-t border-border pt-5'}`}
    >
      {/* 먼저 정할 것이 있으면 버튼보다 앞에 선다 — 정하고 나서 누르는 차례다 */}
      {ask}
      {/*
        **버튼 옆에 남는 것은 한 줄뿐이다.**

        여기에 넉 줄이 서 있었다 — 「지금 풀이를 새로 받을 수 있어요」·「새로 만들면 지금
        것을 대신합니다」·「언어 모델이 씁니다」·「넘기지 않습니다」. 앞 둘은 각각 버튼을
        한국어로 옮겨 적은 것과 **누르지 않을 사람에게 하는 경고**였고, 그 둘을 걷고 나니
        남은 둘도 한 덩어리로 읽히지 않았다.

        남긴 것은 **무엇을 안 넘기는가** 하나다. 누를지 정하는 시점에 사용자가 실제로
        알아야 하는 사실이고, 그 자리가 여기다. 아직 글이 없을 때만 권하는 말이 위에
        붙는다.
      */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          {reading === null && (
            <>
              <p className="text-sm font-semibold">명식 근거로 풀이를 받아 보세요</p>
              <p className="text-xs leading-5 text-muted">{READING_NONE_NOTE}</p>
            </>
          )}
          <p className="text-xs leading-5 text-muted">{READING_REDACTION_NOTE}</p>
        </div>
        {/*
          **숫자는 여기 없다 — 머리글에 있다.**

          한동안 이 버튼 아래에 세웠다. 「누를지 정할 때 눈이 가 있는 곳」이라는 이유였고
          그건 지금도 맞다. 그런데 풀이권은 **이 글의 성질이 아니라 계정의 성질**이다.
          화면마다 세우면 자기 풀이·저장한 사람·비공개 궁합·공유 궁합 넷에 같은 숫자가
          네 번 서고, 그중 하나를 안 고치는 날이 온다.

          대신 **말할 것이 있을 때는 여기서 말한다**(`creditsNote`). 「지금 만들고 있는
          하나가 한 번을 쓰고 있어요」와 「새로 만들 수는 없지만…」은 이 누름에 대한
          말이라 누르는 자리에 있어야 한다.
        */}
        <button
          type="button"
          onClick={press}
          disabled={phase === 'loading' || spent}
          className="h-11 w-full shrink-0 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent shadow-sm hover:-translate-y-0.5 hover:bg-accent-strong disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 sm:w-auto"
        >
          {phase === 'loading'
            ? '풀이 만드는 중…'
            : automatic
              ? '다시 만들기'
              : reading === null
                ? '사주풀이 받기'
                : '다시 풀이받기'}
        </button>
      </div>
      {/* 풀이권에 대해 말할 것이 있을 때만 한 줄 더 선다 — 이 누름에 대한 말이라 여기다 */}
      {creditsNote !== null && <p className="text-xs leading-5 text-muted">{creditsNote}</p>}
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
          <h2 className="mt-1 text-xl font-bold tracking-tight">{heading}</h2>
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

      {/*
        **읽고 나서 곧바로 묻는다 — 글 바로 아래다.**

        시점이 값을 정한다. 다 읽은 직후가 기억이 가장 선명하고, 여기를 떠난 뒤에 묻는
        설문은 「대체로 괜찮았다」를 받는다.

        **예시 결과에는 안 붙는다.** 그 글은 모델이 쓴 것이 아니라 개발용으로 박아 둔
        문자열이라, 그것에 대한 답을 세면 프롬프트 판본별 값이 조용히 오염된다.

        `sourceRunId` 가 없는 글에도 안 붙는다. 이 값이 생기기 전에 저장된 글들이고,
        어느 시도가 만들었는지 지어 넣지 않았다 — 매달 자리가 없으면 안 묻는다.

        그리고 **동의하지 않았으면 통째로 안 선다.** 「동의하면 더 답할 수 있어요」
        같은 줄도 세우지 않는다 — 거절한 사람에게 거절을 다시 보여 주는 자리가 된다.
      */}
      {consented && phase !== 'loading' && reading !== null && !isMock
        && reading.sourceRunId !== null && (
        <ReadingFeedback target={target} runId={reading.sourceRunId} given={reading.myFeedback} />
      )}

      {!onPage && alert}
      {!onPage && makeBlock}

      {/*
        **글이 있을 때만 그린다.** 없으면 이 창이 물을 것도 없고, 화면 어디에서도
        열리지 않는다.
      */}
      {reading !== null && (
        <dialog
          ref={confirming}
          aria-labelledby="reading-replace-title"
          /*
            **`m-auto` 는 장식이 아니다.** 브라우저 기본 스타일은 열린 `<dialog>` 를
            `margin: auto` 로 가운데에 놓는데, Tailwind 의 preflight 이 모든 요소의
            여백을 0 으로 되돌린다 — 그대로 두면 이 창이 화면 왼쪽 위 구석에 붙는다.
          */
          className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl border border-border bg-surface p-6 text-foreground shadow-[var(--shadow-float)] backdrop:bg-black/40"
        >
          <h3 id="reading-replace-title" className="text-base font-bold">
            지금 풀이를 대신합니다
          </h3>
          <p className="mt-2 text-sm leading-6 text-secondary">{READING_REPLACES_NOTE}</p>
          {/*
            **누르는 쪽이 오른쪽이다.** 좁은 화면에서는 위아래로 서고, 그때도 확인이
            위에 온다(`flex-col-reverse` 가 아니라 순서를 그대로 뒤집는다).
          */}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              onClick={replace}
              className="h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent shadow-sm hover:bg-accent-strong sm:h-10"
            >
              다시 풀이받습니다
            </button>
            <button
              type="button"
              onClick={() => confirming.current?.close()}
              className="h-11 rounded-xl border border-border px-5 text-sm text-secondary hover:border-border-strong hover:text-foreground sm:h-10"
            >
              그만두기
            </button>
          </div>
        </dialog>
      )}
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
          <div><p className="text-xs font-semibold text-accent">현재 궁합 풀이 점수</p><p className="mt-1 text-4xl font-bold tabular-nums">{reading.score}<span className="ml-1 text-base font-medium text-secondary">/ 100</span></p></div>
          <p className="max-w-md text-xs leading-5 text-muted">{READING_SCORE_NOTE}</p>
        </div>
      )}
      {/*
        **늘 참인 사실은 여기 안 적는다.**

        「화면을 다시 열어도 이 풀이는 그대로입니다」가 이 줄에 있었다. 참이지만 이
        화면에서 **한 번도 틀린 적이 없는** 사실이라, 읽는 사람에게는 늘 서 있는 배경이
        된다. 그 배경이 두꺼워질수록 옆에 선 「이전 출생 정보로 썼습니다」처럼 **실제로
        갈리는** 한 줄이 같이 안 읽힌다.

        새로 만들면 지금 것이 사라진다는 경고도 이 자리를 떠났다 — 그것은 되돌릴 수
        없는 누름 **직전**에 필요한 말이라, 확인 창이 든다.
      */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-muted">
        {target.kind === 'match' && <p>{readingOrderNote(reading.viewerIsFirst)}</p>}
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
