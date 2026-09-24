'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';

import {
  READING_LEAVE_SAFE_NOTE,
  READING_NOUN,
  readingNoneNote,
  READING_REPLACES_NOTE,
  READING_STALE_NOTE,
  READING_USES_TICKET_NOTE,
  readingCreditsNote,
  readingWaitNote,
} from '@/src/lib/reading';
import { ELEMENTS, type Element } from '@/src/lib/saju';

import { elementScope } from '../../element-tone';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../../ui/buttons';
import { ElementSymbol } from '../../ui/element-symbol';
import { Icon } from '../../ui/icons';
import { EMPTY_SLOT } from '../../ui/surfaces';
import { generateReading, readingRunState } from './actions';
import { announceCreditsMoved } from './credits-signal';
import { GENERATION } from './generation';
import type { CurrentReading, ReadingCredits } from './current';
import { namedMatchBody } from '@/src/lib/reading/display';
import { ReadingFeedback } from './feedback';
import { ShareReadingButton } from './share-button';
import { Markdown } from './markdown';
import { coverFace, readingMinutes } from './essay';
import flow from './flow.module.css';
import {
  afterAsking,
  afterPress,
  answerOf,
  initialFlow,
  previewReading,
  readingFlow,
  type FlowDecision,
  type PressOutcome,
  type ReadingEvent,
  type RunAnswer,
} from './reading-state';
import type { ReadingTarget } from './target';

/**
 * **글 둘레에 무엇이 서는가.**
 *
 * 결과 칸의 판단 여섯이 여기 모였다. 칸 안에 흩어져 있을 때 이 여섯은 「`.tsx` 라서
 * 시험이 못 닿는다」고 적혀 있었지만, 못 닿게 한 것은 확장자가 아니라 **뽑아내지 않은
 * 순수 함수**였다 — 뽑고 나니 시험이 그냥 부른다(`fitsCalendar` · `isNavigationActive`
 * 가 같은 자리에 먼저 서 있다).
 *
 * 부수효과도 JSX 도 안 든다. 들어오는 것은 이 화면이 이미 아는 값뿐이고, 나가는 것은
 * 「무엇이 서고 무엇이 닫히는가」뿐이다.
 */
type PanelChrome = {
  /** 만드는 버튼이 닫혀 있는가 */
  readonly makeDisabled: boolean;
  /** 만드는 버튼이 아예 안 서는가 */
  readonly hideMake: boolean;
  /** 그 버튼이 칸 안이 아니라 머리에 서는가 */
  readonly makeInHeader: boolean;
  readonly makeLabel: string;
  readonly canShare: boolean;
  /** 다 읽은 글 아래에 설문이 붙는가 */
  readonly asksFeedback: boolean;
};

export function panelChrome({
  kind,
  noun,
  loading,
  reading,
  isMock,
  credits,
  automatic,
  onPage,
  expanded,
  consented,
}: {
  kind: ReadingTarget['kind'];
  /** 이 대상을 부르는 말 — 두 사람짜리 화면은 「궁합풀이」다 */
  noun: string;
  loading: boolean;
  reading: CurrentReading | null;
  isMock: boolean;
  credits: ReadingCredits | null;
  automatic: boolean;
  onPage: boolean;
  expanded: boolean;
  consented: boolean;
}): PanelChrome {
  /*
    **다 쓴 것과 기다리는 것을 가른다.** 도는 시도가 자리를 잡고 있는 동안에는 버튼을
    닫지 않는다 — 그 사람이 누르면 DB 가 「끝나면 다시 눌러 주세요」로 답하고, 그것이
    이 화면이 대신 말해 줄 수 없는 사실이다(다른 대상을 만들고 있을 수도 있다).
  */
  const spent = credits !== null && credits.available === 0 && credits.reserved === 0;

  /**
   * **누를 것이 있는가.**
   *
   * 동의가 만드는 글은 성공 경로에 버튼이 없다 — 이미 있는 글도, 지금 만들고 있는 것도
   * 누를 일이 아니다. 남는 자리는 **아무것도 없는 자리** 하나이고, 그때만 버튼이 선다.
   */
  const hideMake = automatic && (reading !== null || loading);

  return {
    makeDisabled: loading || spent,
    hideMake,

    /**
     * 글을 읽으러 온 화면에 **이미 글이 있으면** 만드는 버튼은 머리로 올라간다.
     *
     * 전에는 글 위에 칸 하나가 통째로 서 있었다 — 권하는 말·안 넘기는 것·버튼. 그런데
     * 글이 이미 있는 사람에게 그 칸이 하는 말은 버튼 하나뿐이고, 나머지 줄은 **읽을
     * 이유가 없는 자리**를 차지하고 있었다.
     */
    makeInHeader: onPage && reading !== null && !hideMake,

    makeLabel: loading
      ? `${noun} 받는 중…`
      : reading === null
        ? `${noun} 받기`
        : `${noun} 다시 받기`,

    /**
     * **공유는 다 된 내 사주풀이에만 붙는다.**
     *
     * 없는 글과 지금 만들고 있는 글에는 보낼 것이 없다 — 그 자리에 버튼을 세우면 누른
     * 사람이 빈 링크를 받는다. 예시 결과에도 안 붙는다. 그것은 모델이 쓴 글이 아니라
     * 개발용으로 박아 둔 문자열이고, DB 의 문도 저장된 원문에 없는 글은 안 받는다 —
     * 화면에서 먼저 막지 않으면 사용자는 이유를 모르는 실패를 본다.
     *
     * **인연 궁합만 빠진다.** 거기 있는 상대는 실재하는 계정이고, 그 사람이 동의한
     * 것은 「이 사람에게 내 여덟 글자를 연다」이지 「누구에게든 연다」가 아니다
     * (ADR 0012). 나머지 셋은 다 **내가 넣은 자료**라 내보낼지 말지를 넣은 사람이 정한다.
     */
    canShare: kind !== 'match' && reading !== null && !loading && !isMock,

    /**
     * **읽고 나서 곧바로 묻는다.** 시점이 값을 정한다 — 다 읽은 직후가 기억이 가장
     * 선명하고, 여기를 떠난 뒤에 묻는 설문은 「대체로 괜찮았다」를 받는다. 그래서 글이
     * 실제로 펼쳐져 있을 때만 선다.
     *
     * **예시 결과에는 안 붙는다.** 그 글은 모델이 쓴 것이 아니라 개발용으로 박아 둔
     * 문자열이라, 그것에 대한 답을 세면 프롬프트 판본별 값이 조용히 오염된다.
     *
     * `sourceRunId` 가 없는 글에도 안 붙는다. 이 값이 생기기 전에 저장된 글들이고,
     * 어느 시도가 만들었는지 지어 넣지 않았다 — 매달 자리가 없으면 안 묻는다.
     *
     * 그리고 **동의하지 않았으면 통째로 안 선다.** 「동의하면 더 답할 수 있어요」
     * 같은 줄도 세우지 않는다 — 거절한 사람에게 거절을 다시 보여 주는 자리가 된다.
     */
    asksFeedback:
      (onPage || expanded)
      && consented
      && !loading
      && reading !== null
      && !isMock
      && reading.sourceRunId !== null,
  };
}

/**
 * 흐름이 정한 것을 **실제로 한다** — 여기에는 판단이 없다.
 *
 * 무엇을 할지는 `afterPress` · `afterAsking` 이 이미 값으로 답했고, 이 함수가 하는 일은
 * 그 셋을 순서대로 집행하는 것뿐이다. **칸 밖에 두는 까닭**은 지켜보는 고리의 의존성에
 * 들지 않게 하려는 것이다 — 칸 안에서 새로 지어지면 그림마다 고리가 다시 선다.
 */
function apply(
  decision: FlowDecision,
  dispatch: (event: ReadingEvent) => void,
  reread: () => void,
): void {
  if (decision.event !== null) dispatch(decision.event);
  if (decision.announcesCredits) announceCreditsMoved();
  if (decision.rereads) reread();
}

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
  betweenSummaryAndBody,
  matchNames,
  tones,
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
   * 골목이 되고, 그것은 이 ADR 이 없애려던 바로 그 자리다. 그때는 아무것도 없는 자리에
   * 서는 버튼 그대로 「궁합풀이 받기」가 서고, 누른 사람이 한 번을 쓴다
   * (ADR 0017 — 드물고 눈에 보이는 자리다).
   */
  automatic?: boolean;
  ask?: ReactNode;
  betweenSummaryAndBody?: ReactNode;
  matchNames?: { readonly me: string; readonly partner: string };
  /**
   * 표지의 색 — 대상의 일간 오행. 한 사람이면 하나, 두 사람이면 둘이고 못 읽은 사람은 `null`(회색).
   * 안 넘기면 크림 한 장이다(`Result`).
   */
  tones?: readonly (Element | null)[];
}) {
  const router = useRouter();
  const [flow, dispatch] = useReducer(
    readingFlow,
    { running: initialRunning, failed: initialFailed },
    initialFlow,
  );
  /* 접힘은 이 화면만의 것이라 흐름에 안 든다 — 서버에도 다른 기기에도 뜻이 없다 */
  const [readingExpanded, setReadingExpanded] = useState(false);

  const { phase, failure } = flow;
  /* 예시 글이 서 있는 것과 `mock !== null` 은 같은 말이다 — 따로 들면 한쪽만 지운다 */
  const isMock = flow.mock !== null;
  const reading = flow.mock ?? initialReading;

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
      let answer: RunAnswer;
      try {
        answer = answerOf(await readingRunState(target));
      } catch {
        // 한 번 못 물은 것으로 끝났다고 하지 않는다. 다음 물음에서 다시 본다.
        answer = { kind: 'unreachable' };
      }
      /* 떠난 칸에는 아무것도 안 세운다 — 답이 오는 사이에 화면이 바뀔 수 있다 */
      if (!alive) return;

      apply(afterAsking(answer), dispatch, () => router.refresh());
    };

    // 물어보는 간격은 짧게 잡지 않는다 — 4분짜리 일에 1초짜리 왕복은 값만 쓴다.
    const tick = setInterval(ask, 3000);

    return () => {
      alive = false;
      clearInterval(tick);
    };
  }, [phase, target, router]);

  const generate = async () => {
    dispatch({ type: 'press' });
    setReadingExpanded(false);

    /*
      **예시 글은 누르는 자리에서 짓는다.** 지을 수 있는가는 이 화면이 알고
      (`allowMockFallback`), 세울 것인가는 흐름이 답한다 — 여기서 `null` 이면 그 갈래가
      아예 없다는 뜻이고, 그것이 프로덕션에서 실패가 실패로 서는 까닭이다.
    */
    const preview = allowMockFallback ? previewReading(target.kind, new Date()) : null;

    let outcome: PressOutcome;
    try {
      /*
        **답을 너무 빨리 돌려주지 않는다.** 누르자마자 제자리로 돌아온 화면은 눌린
        것으로 안 보인다 — 기다리는 모습이 설 시간을 준다.
      */
      const [result] = await Promise.all([
        generateReading(target, crypto.randomUUID()),
        new Promise((resolve) => setTimeout(resolve, 900)),
      ]);

      /*
        **답이 결과가 아니라 시작 여부다.** 열었으면 기다리는 화면에 그대로 머물고,
        열지 못했어도(이미 도는 시도가 있다) 기다릴 일인 것은 같다 — 그 시도가 끝나면
        새 글이 선다. 어느 쪽에 무엇이 서는지는 `afterPress` 가 든다.
      */
      outcome = result.ok
        ? { kind: 'opened', started: result.started }
        : { kind: 'refused', message: result.message };
    } catch {
      outcome = { kind: 'threw' };
    }

    apply(afterPress(outcome, preview), dispatch, () => router.refresh());
  };

  /**
   * 되돌릴 수 없는 누름 앞의 확인 창 — **경고를 읽는 시점을 누름에 붙인다.**
   *
   * 새로 만들면 지금 글과 점수는 사라진다(ADR 0013: 통째로 교체). 그 사실은 한동안
   * 버튼 옆에 늘 적혀 있었는데, 늘 적혀 있는 문장은 누르려는 사람에게 **읽히지 않는
   * 시점**에 서 있는 것과 같다. 여기서는 누른 사람만, 누른 그때 읽는다.
   *
   * 처음 만드는 때에도 묻는다. 풀이권은 한정된 자원이라, 사라질 글이 없더라도 실제로
   * 한 번을 쓰기 직전에는 사용자가 그 사실을 확인할 수 있어야 한다. 이미 글이 있으면
   * 같은 창에서 기존 글과 점수가 교체된다는 사실까지 함께 말한다.
   *
   * 상태를 안 든다. `<dialog>` 가 열림·닫힘을 스스로 들고, Esc 와 초점 가둠도 브라우저가
   * 한다 — 그 셋을 손으로 다시 만들면 세 자리가 더 생긴다.
   */
  const confirming = useRef<HTMLDialogElement>(null);

  const press = () => {
    confirming.current?.showModal();
  };

  const confirmGenerate = () => {
    confirming.current?.close();
    void generate();
  };

  const onPage = layout === 'page';

  /** 이 대상을 부르는 말 — 두 사람짜리 화면은 「궁합풀이」라고 적는다 */
  const noun = READING_NOUN[target.kind];
  const creditsNote = credits === null ? null : readingCreditsNote(credits);

  const chrome = panelChrome({
    kind: target.kind,
    noun,
    loading: phase === 'loading',
    reading,
    isMock,
    credits,
    automatic,
    onPage,
    expanded: readingExpanded,
    consented,
  });

  /**
   * 만드는 버튼 — **두 자리에 같은 버튼이 선다.**
   *
   * 글이 아직 없으면 권하는 말과 함께 칸 안에(`block`), 글이 이미 있으면 **머리의 공유
   * 버튼 옆에**(`pill`) 선다. 뒤엣것이 이 화면에서 사용자가 글을 읽고 나서 하는 두
   * 가지 — 보내기와 다시 받기 — 이고, 그 둘은 나란히 있어야 고르기가 된다.
   */
  const makeButton = (shape: 'block' | 'pill', emphasis: 'primary' | 'secondary') => (
    <button
      type="button"
      onClick={press}
      disabled={chrome.makeDisabled}
      className={`${emphasis === 'primary' ? BUTTON_PRIMARY : BUTTON_SECONDARY} ${
        shape === 'pill' ? 'w-full whitespace-nowrap px-3 sm:w-auto sm:px-5' : 'w-full shrink-0 sm:w-auto'
      }`}
    >
      <Icon name="spark" className="size-[18px]" />
      {chrome.makeLabel}
    </button>
  );

  /**
   * **이전 명식으로 만든 글이면 다시 받기가 주 단추가 된다.** 평소 글을 다 읽은 사람이 먼저 하는 일은
   * 보내기지만, 지금 명식과 다른 글을 들고 있는 사람에게는 새로 받는 것이 먼저다(시안 3차 warm).
   * 한 영역에 주 단추는 하나다.
   */
  const stale = reading !== null && target.kind !== 'match' && !reading.fromCurrentChart;

  const makeBlock = chrome.hideMake ? null : (
    <div
      className={`flex flex-col gap-3 ${onPage ? 'rounded-[1.75rem] border border-border bg-surface px-5 py-5 sm:px-6' : 'border-t border-border pt-5'}`}
    >
      {/* 먼저 정할 것이 있으면 버튼보다 앞에 선다 — 정하고 나서 누르는 차례다 */}
      {ask}
      {/*
        **버튼 옆에 남는 것은 한 줄뿐이다** — 무엇을 안 넘기는가. 누를지 정하는 시점에 사용자가 실제로
        알아야 하는 사실이고, 그 자리가 여기다. 아직 글이 없을 때만 권하는 말이 위에 붙는다.
      */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          {reading === null && (
            <>
              <p className="text-[17px] font-semibold text-foreground">사주를 바탕으로 {noun}를 받아 보세요</p>
              <p className="text-[13px] leading-5 text-secondary">{readingNoneNote(noun)}</p>
            </>
          )}
        </div>

        {/*
          **숫자는 여기 없다 — 머리글에 있다.** 풀이권은 이 글의 성질이 아니라 계정의 성질이라, 화면마다
          세우면 같은 숫자가 네 번 선다. 대신 이 누름에 대해 **말할 것이 있을 때는** 여기서 말한다.
        */}
        {makeButton('block', 'primary')}
      </div>
      {creditsNote !== null && <p className="text-[13px] leading-5 text-secondary">{creditsNote}</p>}
    </div>
  );

  const alert = failure === null ? null : (
    <div
      role={phase === 'error' ? 'alert' : 'status'}
      className={`flex gap-2.5 rounded-[1.25rem] px-4 py-3.5 text-[14px] leading-6 ${phase === 'error' ? 'bg-danger-wash text-danger' : 'bg-warning-wash text-warning'}`}
    >
      <Icon name="alert" className="mt-0.5 size-5" />
      <div className="min-w-0">
        <p>{failure}</p>
        {phase === 'error' && (
          <button
            type="button"
            onClick={generate}
            className="-ml-1 mt-1 inline-flex min-h-11 items-center px-1 font-semibold underline underline-offset-4"
          >
            다시 시도하기
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <header className="flex flex-col gap-3">
        {/*
          **왼쪽은 이름, 오른쪽은 이 글에 대해 할 수 있는 것.** 좁은 화면에서는 위에서 아래로 쌓이고, 그때
          버튼 둘은 **줄을 반씩 나눠 쓴다** — 가운데에 모아 두면 누르는 자리가 화면마다 옮겨 다닌다. 400px 아래
          폰에서는 반쪽에 「사주풀이 다시 받기」가 두 줄로 꺾이므로 위아래로 쌓는다.
        */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <h2 className="font-rounded text-[1.3rem] leading-7 text-foreground">{heading}</h2>

          {/*
            **보내기와 다시 받기가 나란히 선다.** 글을 다 읽은 사람이 하는 일이 그 둘이고, 같은 일에
            손잡이가 여럿이면 어느 것이 무엇인지 세어 봐야 한다.
          */}
          {(chrome.canShare || chrome.makeInHeader) && (
            <div
              className={
                chrome.canShare && chrome.makeInHeader
                  ? 'grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:flex sm:shrink-0'
                  : 'flex sm:shrink-0'
              }
            >
              {chrome.canShare && (
                <ShareReadingButton target={target} emphasis={stale ? 'secondary' : 'primary'} />
              )}
              {chrome.makeInHeader && makeButton('pill', stale || !chrome.canShare ? 'primary' : 'secondary')}
            </div>
          )}
        </div>

        {/* 다음 글에 대한 말은 그 버튼 아래다 — 사이 물음과 풀이권 이야기 */}
        {chrome.makeInHeader && ask}
        {chrome.makeInHeader && creditsNote !== null && (
          <p className="text-[13px] leading-5 text-secondary">{creditsNote}</p>
        )}
      </header>

      {/*
        **다시 받는 버튼이 글 위에 선다.** 그것은 글을 읽기 전에 정하는 일이라, 8천 자 뒤에 있으면 없는
        것과 같다. 카드로 설 때는 반대다 — 먼저 무엇이 있는지 보이고 나서 만들지 말지를 정한다.
      */}
      {onPage && !chrome.makeInHeader && makeBlock}
      {onPage && alert}

      {phase === 'loading' ? (
        <>
          {betweenSummaryAndBody}
          <LoadingState />
        </>
      ) : reading === null ? (
        <>
          {betweenSummaryAndBody}
          <EmptyState />
        </>
      ) : (
        <Result
          reading={reading}
          target={target}
          isMock={isMock}
          tones={tones}
          alwaysOpen={onPage}
          expanded={readingExpanded}
          onExpandedChange={setReadingExpanded}
          betweenSummaryAndBody={betweenSummaryAndBody}
          matchNames={matchNames}
        />
      )}

      {/*
        **읽고 나서 곧바로 묻는다 — 글 바로 아래다.** 시점이 값을 정한다. 무엇이 이 자리를 막는지는
        `panelChrome` 의 `asksFeedback` 이 든다 — 규칙을 여기 한 벌 더 적으면 두 벌이 언젠가 갈린다.
        본문 끝에 공유 칸을 한 번 더 세우지 않는다 — 같은 문 앞의 손잡이가 둘이 된다.
      */}
      {/* `reading` 을 한 번 더 보는 것은 타입 검사기 때문이다 — 판단은 위에서 끝났다 */}
      {chrome.asksFeedback && reading !== null && reading.sourceRunId !== null && (
        <div className="mx-auto w-full max-w-[40rem]">
          <ReadingFeedback target={target} runId={reading.sourceRunId} given={reading.myFeedback} />
        </div>
      )}

      {!onPage && alert}
      {!onPage && makeBlock}

      {/*
        **누를 수 없는 자리에는 창도 없다.** 이 창은 만드는 버튼이 여는 것이라, 버튼이 없는 화면(동의가
        만드는 글의 성공 경로)에서는 열릴 길이 없다. 닫힌 채 실려 오면 버튼 글자가 화면에 두 벌 남고,
        검사가 그 글자를 세어 「만드는 버튼이 있나」를 늘 참으로 만든다.
      */}
      {chrome.hideMake ? null : (
      <dialog
        ref={confirming}
        aria-labelledby="reading-confirm-title"
        /*
          **`m-auto` 는 장식이 아니다.** 브라우저 기본 스타일은 열린 `<dialog>` 를 `margin: auto` 로
          가운데에 놓는데, Tailwind 의 preflight 이 모든 요소의 여백을 0 으로 되돌린다.
        */
        className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-[1.75rem] border border-border bg-surface p-6 text-foreground shadow-[var(--shadow-float)] backdrop:bg-black/40"
      >
        <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-cream text-cream-ink">
          <Icon name="ticket" className="size-5" />
        </span>
        <h3 id="reading-confirm-title" className="mt-4 font-rounded text-[1.3rem] leading-7">
          풀이권 1회를 사용하시겠어요?
        </h3>
        <p className="mt-2 text-[15px] leading-6 text-secondary">{READING_USES_TICKET_NOTE}</p>
        {reading !== null && (
          <p className="mt-2 text-[15px] font-medium leading-6 text-danger">{READING_REPLACES_NOTE}</p>
        )}
        {/*
          **누르는 쪽이 오른쪽이다.** 좁은 화면에서는 위아래로 서고, 그때도 확인이 위에 온다.
        */}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" onClick={confirmGenerate} className={BUTTON_PRIMARY}>
            {reading === null ? `${noun} 받기` : `${noun} 다시 받기`}
          </button>
          <button type="button" onClick={() => confirming.current?.close()} className={BUTTON_SECONDARY}>
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
    <div className={`${EMPTY_SLOT} grid min-h-56 place-items-center text-center`}>
      <div className="max-w-sm">
        <span aria-hidden="true" className="mx-auto flex justify-center gap-1.5">
          {ELEMENTS.map((element) => (
            <ElementSymbol key={element} element={element} className="size-6" />
          ))}
        </span>
        <h3 className="mt-4 font-rounded text-[1.3rem] leading-7">아직 받아 둔 풀이가 없어요</h3>
        <p className="mt-2 text-[15px] leading-6 text-secondary">복잡한 사주 정보를 핵심 성향, 강점, 균형을 위한 제안으로 나누어 읽기 쉽게 정리합니다.</p>
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
 * 보이면 그건 꾸며 낸 진행이다. 흐르는 띠(`flow.module.css`)도 차오르지 않는다 — 끝을 모른다는 말이다.
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
    <div role="status" aria-live="polite" className="rounded-[1.75rem] bg-cream p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-cream-ink" aria-hidden="true">
          <Icon name="spark" className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-semibold text-foreground">사주의 흐름을 이어 읽고 있어요</p>
          <p className="text-[13px] leading-5 text-cream-ink">근거를 확인하고, 단정하지 않는 문장으로 옮깁니다.</p>
        </div>
        {/*
          **읽어 주지 않는다.** 바깥이 `aria-live` 라 이 숫자가 매초 낭독되면 화면
          낭독기를 쓰는 사람에게는 글을 읽을 수 없는 칸이 된다. 살아 있다는 신호는
          눈으로 보는 사람에게 필요한 것이고, 낭독되는 문장은 위의 한 줄로 족하다.
        */}
        <p aria-hidden="true" className="ml-auto shrink-0 text-[15px] font-semibold tabular-nums text-cream-ink">
          {elapsed}초
        </p>
      </div>
      <div aria-hidden="true" className="mt-5 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--cream-ink)_14%,transparent)]">
        <div className={`${flow.flow} h-full w-full rounded-full`} />
      </div>
      <div className="mt-6 flex max-w-[36rem] flex-col gap-3" aria-hidden="true">
        <div className="reading-skeleton h-4 w-2/5 rounded-full" />
        <div className="reading-skeleton h-3 w-full rounded-full" />
        <div className="reading-skeleton h-3 w-11/12 rounded-full" />
        <div className="reading-skeleton h-3 w-4/5 rounded-full" />
      </div>
      <p className="mt-5 text-[13px] leading-5 text-cream-ink">
        {readingWaitNote(GENERATION.settings.timeout)} {READING_LEAVE_SAFE_NOTE}
      </p>
    </div>
  );
}

function Result({
  reading,
  target,
  isMock,
  tones,
  alwaysOpen,
  expanded,
  onExpandedChange,
  betweenSummaryAndBody,
  matchNames,
}: {
  reading: CurrentReading;
  target: ReadingTarget;
  isMock: boolean;
  tones: readonly (Element | null)[] | undefined;
  /** 상세 화면에서는 접지 않는다 — 그 글을 읽으러 온 자리다 */
  alwaysOpen: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  betweenSummaryAndBody?: ReactNode;
  matchNames?: { readonly me: string; readonly partner: string };
}) {
  const open = alwaysOpen || expanded;
  const body =
    target.kind === 'match' && matchNames !== undefined
      ? namedMatchBody(reading.output, reading.viewerIsFirst, matchNames)
      : reading.output;

  /*
    **표지의 색은 부르는 화면이 정한다** — 대상의 일간이다. 모르면(부르는 화면이 안 넘기면) 크림 한 장이다:
    회색 표지는 「못 읽은 명식」의 뜻이라, 몰라서 안 넘긴 자리에 쓰면 거짓말이 된다.
  */
  const face = tones === undefined ? null : coverFace(tones);
  const firstTone = tones?.[0] ?? null;

  const detailButton = !alwaysOpen && (
    <button
      type="button"
      onClick={() => onExpandedChange(!expanded)}
      aria-expanded={expanded}
      aria-controls={`reading-${reading.id}`}
      className={`${BUTTON_SECONDARY} self-start`}
    >
      {expanded ? '접기' : '자세히 보기'}
      <Icon name="chevron" className={`size-4 ${expanded ? '-rotate-90' : 'rotate-90'}`} />
    </button>
  );

  const meta = (
    <>
      {isMock && (
        <span className="rounded-full bg-warning-wash px-2.5 py-1 text-[11px] font-semibold text-warning">
          예시 결과
        </span>
      )}
      <time dateTime={reading.createdAt} className="tabular-nums">
        {when(reading.createdAt)} 생성
      </time>
      <span aria-hidden="true">·</span>
      <span>읽는 데 약 {readingMinutes(body)}분</span>
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      {/*
        **비유 한 줄이 이 글의 표지다** — 에세이 앱의 표지처럼 가장 크게 세운다(시안 3차 warm). 점수는 표지의
        오른쪽 아래, 비유가 흐르는 자리를 밀어내지 않는 곳에 선다. 비유는 길이가 들쭉날쭉하다(마흔 자 안팎을
        시키지만 막는 자리는 120자) — 한 줄을 전제하지 않고 `text-pretty` 로 고르게 나눈다.
      */}
      {reading.score !== null || reading.metaphor !== null ? (
        <figure
          className={`${elementScope(firstTone)} relative overflow-hidden rounded-[2rem] px-6 pb-6 pt-7 sm:px-10 sm:pb-8 sm:pt-10 ${face === null ? 'bg-cream' : ''}`}
          style={face === null ? undefined : { background: face.background }}
        >
          {tones !== undefined && tones.length === 1 && (
            <ElementSymbol
              element={firstTone}
              className="pointer-events-none absolute -right-10 -top-10 size-48 opacity-20 sm:size-64"
            />
          )}
          {reading.metaphor !== null ? (
            <>
              <span aria-hidden="true" className="relative block h-10 font-rounded text-[5rem] leading-none text-[var(--ink)] opacity-70">
                “
              </span>
              <blockquote className="relative mt-2 max-w-[18em] text-pretty font-rounded text-[1.75rem] leading-[1.4] tracking-[-0.02em] text-foreground sm:text-[2.5rem]">
                {reading.metaphor}
              </blockquote>
            </>
          ) : (
            <p className="relative text-[13px] font-semibold text-secondary">풀이 결과</p>
          )}
          <figcaption className="relative mt-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-t border-[color-mix(in_srgb,var(--foreground)_12%,transparent)] pt-4">
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] text-secondary">{meta}</span>
            {reading.score !== null && (
              <span className="flex flex-col items-end">
                <span className="text-[13px] font-semibold text-secondary">궁합풀이 점수</span>
                <span className="flex items-baseline gap-1">
                  <span className="text-[2.5rem] font-bold leading-none tabular-nums text-foreground">{reading.score}</span>
                  <span className="text-[13px] font-semibold text-secondary">/ 100</span>
                </span>
              </span>
            )}
          </figcaption>
        </figure>
      ) : (
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] text-secondary">{meta}</p>
      )}
      {detailButton}
      {/*
        **늘 참인 사실은 여기 안 적는다.** 여기 서는 것은 **실제로 갈리는** 한 줄뿐이다 — 지금과 다른
        명식으로 만든 글. 새로 만들면 지금 것이 사라진다는 경고는 되돌릴 수 없는 누름 **직전**에 필요한
        말이라 확인 창이 든다. 색만으로 말하지 않는다 — 「이전 명식」 낱말이 함께 선다.
      */}
      {target.kind !== 'match' && !reading.fromCurrentChart && (
        <p className="flex gap-2.5 rounded-[1.25rem] bg-warning-wash px-4 py-3.5 text-[14px] leading-6 text-foreground">
          <Icon name="alert" className="mt-0.5 size-5 text-warning" />
          <span>
            <span className="mr-1.5 font-semibold text-warning">이전 명식</span>
            {READING_STALE_NOTE}
          </span>
        </p>
      )}
      {betweenSummaryAndBody}
      {open && (
        <div className={`${elementScope(firstTone)} flex flex-col gap-2 pt-4 sm:pt-8`}>
          {target.kind === 'match' && (
            <header className="mx-auto w-full max-w-[36rem]">
              <p className="text-[13px] font-semibold text-secondary">두 사람의 풀이</p>
              <h2 className="mt-1 font-rounded text-[1.5rem] leading-8">궁합풀이 결과</h2>
            </header>
          )}
          <article id={`reading-${reading.id}`}>
            <Markdown source={body} />
          </article>
          {/* 글의 끝 — 다섯 상징이 마침표 자리에 선다 */}
          <span aria-hidden="true" className="mt-12 flex justify-center gap-3 opacity-80">
            {ELEMENTS.map((element) => (
              <ElementSymbol key={element} element={element} className="size-5" />
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}
