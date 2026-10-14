'use client';

import { useEffect, useReducer, useRef, useState, useTransition } from 'react';

import type { RunProgress } from '@/src/lib/reading';
import { READING_NOUN, readingCreditsNote } from '@/src/lib/reading/notes';

import { generateReading, markReadingReadyRead, readingRunState, skipTasteCarry } from './actions';
import type { CurrentReading } from './current';
import { progressSoFar } from './outline';
import { panelChrome } from './panel-chrome';
import { watchRun, type PageVisibility } from './watch-run';
import { markAndAnnounce, newsKeyOf, readNewsWhenSeen } from './news-read';
import { announceNotificationsUnreadMoved } from '../requests/unread-signal';
import { skipCarriedTaste, takeTasteArrival } from '../../taste/carried-taste';
import {
  afterAsking,
  afterPress,
  answerOf,
  asksOnArrival,
  offersPlainReading,
  initialFlow,
  previewReading,
  readingFlow,
  type FlowDecision,
  type PressOutcome,
  type ReadingEvent,
  type RunAnswer,
} from './reading-state';
import type { ReadingTarget } from './target';
import type { TasteCarryView } from '../../taste/taste-carry';
import { useBuyCredits } from '../credits/buy-credits';
import { announceCreditsMoved } from '../credits/credits-signal';
import type { ReadingCredits } from '../credits/remaining';

/** 이 탭이 보이는가 — 지켜보는 고리(`watchRun`)가 숨긴 탭에서 쉬게 */
const documentVisibility: PageVisibility = {
  hidden: () => document.visibilityState === 'hidden',
  onChange: (listener) => {
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
  },
};

/**
 * 흐름이 정한 것을 **실제로 한다** — 여기에는 판단이 없다.
 *
 * 무엇을 할지는 `afterPress` · `afterAsking` 이 이미 값으로 답했고, 이 함수가 하는 일은
 * 그 둘을 순서대로 집행하는 것뿐이다. **칸 밖에 두는 까닭**은 지켜보는 고리의 의존성에
 * 들지 않게 하려는 것이다 — 칸 안에서 새로 지어지면 그림마다 고리가 다시 선다.
 */
function apply(decision: FlowDecision, dispatch: (event: ReadingEvent) => void): void {
  if (decision.event !== null) dispatch(decision.event);
  if (decision.announcesCredits) announceCreditsMoved();
}

/**
 * **결과 칸의 상태와 누름** — 흐름 · 진행 · 소식 읽음 · 지켜보는 고리 · 만들기 · 확인 창 · 도착 때 여는 창 · 「전체 풀이만 보기」.
 * 무엇이 서는지는 `panelChrome` 이 값으로 답하고, 칸(`ReadingPanel`)은 받은 것을 그리기만 한다.
 */
export function useReadingPanel({
  target,
  initialReading,
  initialFailed,
  initialRunning,
  initialProgress,
  lastFailureCode,
  credits,
  consented,
  allowMockFallback,
  automatic,
  carry,
}: {
  target: ReadingTarget;
  initialReading: CurrentReading | null;
  initialFailed: boolean;
  initialRunning: boolean;
  initialProgress: RunProgress | null;
  lastFailureCode: string | null;
  credits: ReadingCredits | null;
  consented: boolean;
  allowMockFallback: boolean;
  automatic: boolean;
  carry: TasteCarryView | null;
}) {
  /** 이 화면에서 만드는 버튼을 눌렀나 — 이어 쓴 글을 새로 받으면 「아까 보던 내용」을 내린다 */
  const [pressed, setPressed] = useState(false);
  const showsCarry = carry !== null && !(carry.state === 'shown' && pressed);
  const [flow, dispatch] = useReducer(
    readingFlow,
    { running: initialRunning, failed: initialFailed, hasReading: initialReading !== null },
    initialFlow,
  );
  /**
   * 서버가 적은 진행 — **물을 때마다 지나온 값에 접는다**(`progressSoFar`, 한 번 앞선 줄은 뒤로 가지 않는다). 흐름
   * (`readingFlow`)에 안 넣는 것은 이 값이 무엇이 서는지(글 · 빈 칸 · 기다림)를 안 바꾸고 기다리는 칸 안의 줄만 바꾸기 때문이다.
   */
  const [progress, setProgress] = useState(initialProgress);

  /**
   * **기다리기 전에 서 있던 글** — 끝난 뒤 이것과 다른 글이 서야 기다림을 내린다(`ReadingFlow.arriving`). 열 때 도는 시도가
   * 있었으면 그때의 글, 누르면 누를 때의 글이다. 지금 선 글은 물음의 답이 오는 자리에서 읽으므로 참조로 든다.
   */
  const shownKey = newsKeyOf(initialReading);
  const keyBeforeWait = useRef(shownKey);
  const keyNow = useRef(shownKey);
  useEffect(() => {
    keyNow.current = shownKey;
    if (shownKey !== keyBeforeWait.current) dispatch({ type: 'arrived' });
  }, [shownKey]);

  const { phase, failure } = flow;
  /* 예시 글이 서 있는 것과 `mock !== null` 은 같은 말이다 — 따로 들면 한쪽만 지운다 */
  const isMock = flow.mock !== null;
  const reading = flow.mock ?? initialReading;

  /**
   * **이 글의 완성 소식을 읽음으로 바꾼다**(ADR 0157 「2026-10-10 덧」) — 서버가 준 글이 보일 때 한 번. 예시 글은 서버에
   * 없는 글이라 안 부른다. 다시 받아 새 글이 서면(만든 시각이 바뀐다) 그 글의 소식도 한 번 — 기다리며 본 사람의 종이 남지 않는다.
   * 개발 모드의 두 번 도는 effect 와 같은 글의 다시 그림은 열쇠가 막는다.
   */
  const newsKey = isMock ? null : newsKeyOf(initialReading);
  const newsReadingId = isMock ? null : (initialReading?.id ?? null);
  const newsSentFor = useRef<string | null>(null);
  useEffect(() => {
    if (newsKey === null || newsReadingId === null || newsSentFor.current === newsKey) return;
    return readNewsWhenSeen({
      visibility: documentVisibility,
      send: () => {
        newsSentFor.current = newsKey;
        void markAndAnnounce(newsReadingId, markReadingReadyRead, announceNotificationsUnreadMoved);
      },
    });
  }, [newsKey, newsReadingId]);

  /**
   * **도는 시도를 지켜본다.** 끝난 것을 본 그 물음의 응답이 이 화면을 다시 그려 싣는다(`readingRunState` 의 `refreshPaths`).
   *
   * 누른 그 화면에서만 도는 것이 아니다. 새로고침하고 돌아오거나 다른 기기에서 열어도
   * 서버에는 도는 시도가 있으므로(`initialRunning`), 이 고리는 **마운트될 때부터**
   * 돈다. 만드는 일이 요청에서 떨어져 나온 뒤로 그것이 가능해졌다. 언제 묻는가 — 답이 온 뒤 · 숨긴 탭은 쉼 — 는
   * `watchRun` 이 든다.
   */
  useEffect(() => {
    if (phase !== 'loading') return;

    let alive = true;
    const ask = async () => {
      let answer: RunAnswer;
      let seen: RunProgress | null | undefined;
      try {
        const run = await readingRunState(target);
        answer = answerOf(run);
        seen = run?.progress ?? null;
      } catch {
        // 한 번 못 물은 것으로 끝났다고 하지 않는다. 다음 물음에서 다시 본다.
        answer = { kind: 'unreachable' };
      }
      /* 떠난 칸에는 아무것도 안 세운다 — 답이 오는 사이에 화면이 바뀔 수 있다 */
      if (!alive) return;

      /* 못 물었으면 앞서 본 진행을 그대로 둔다 — 한 번 끊긴 것으로 목차를 비우지 않는다 */
      if (seen !== undefined) setProgress((before) => progressSoFar(before, seen));

      apply(afterAsking(answer, keyNow.current !== keyBeforeWait.current, keyNow.current !== null), dispatch);
    };

    const stop = watchRun({ ask, visibility: documentVisibility });

    return () => {
      alive = false;
      stop();
    };
  }, [phase, target]);

  /* 풀이권 창 — 0개일 때의 누름과, 누른 뒤 서버가 풀이권이 없어 막은 때(ADR 0171 「덧」) */
  const buy = useBuyCredits();

  const generate = async () => {
    dispatch({ type: 'press' });
    setPressed(true);
    /* 새 시도다 — 지난 시도의 진행을 들고 가지 않는다 */
    setProgress(null);
    keyBeforeWait.current = keyNow.current;

    /*
      **예시 글은 누르는 자리에서 짓는다.** 지을 수 있는가는 이 화면이 알고
      (`allowMockFallback`), 세울 것인가는 흐름이 답한다 — 여기서 `null` 이면 그 갈래가
      아예 없다는 뜻이고, 그것이 프로덕션에서 실패가 실패로 서는 까닭이다.

      **`NODE_ENV` 를 여기서 한 번 더 묻는 것은 묶음 때문이다.** `allowMockFallback` 은
      서버가 넘기는 실행 값이라 빌드가 못 접는다 — 이 자리의 상수가 접혀야 예시 글이
      운영 클라이언트 묶음에서 빠진다(ADR 0080 「값으로 남은 것 넷」 1).
    */
    const preview =
      process.env.NODE_ENV !== 'production' && allowMockFallback
        ? previewReading(target.kind, new Date())
        : null;

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
        : 'outOfCredits' in result
          ? { kind: 'out-of-credits' }
          : { kind: 'refused', message: result.message };
    } catch {
      outcome = { kind: 'threw' };
    }

    const decision = afterPress(outcome, preview);
    apply(decision, dispatch);
    if (decision.opensCredits) buy.offer(0);
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
  const [asking, setAsking] = useState(false);


  const confirmGenerate = () => {
    setAsking(false);
    void generate();
  };

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
    consented,
  });
  /*
    글이 있으면 첫 초점은 「취소」다 — 아래 창이 정한다(`ConfirmDialog` 의 `firstFocus`, B5). 풀이권이 0개면 확인 창 대신 풀이권 창이다 —
    만들기 요청이 나가지 않는다
  */
  const press = () => {
    if (chrome.buysCredits) buy.offer(0);
    else setAsking(true);
  };

  /**
   * **로그인 전 사주 문단을 막 붙이고 도착했으면 확인창을 스스로 연다**(ADR 0143 「덧」) — 뒤에는 「아까 보던 내용」이 그대로
   * 보인다. 여는 것까지이고 누름은 사용자가 한다. 「막 도착했다」는 탭의 한 번짜리 표(`takeTasteArrival`)로 판단한다 — 귀속
   * 표 쿠키는 첫 누름까지 남아 있어서 쿠키로 보면 새로고침 · 뒤로가기마다 다시 열린다. 표는 처음 그릴 때 읽고 곧바로 지우므로
   * 한 번 닫으면 그 방문에서 다시 안 열린다. 여는가의 판단은 `asksOnArrival` 이 든다.
   */
  const arrivalSeen = useRef(false);
  useEffect(() => {
    if (arrivalSeen.current || target.kind !== 'self') return;
    arrivalSeen.current = true;
    const arrived = takeTasteArrival(() => sessionStorage);
    const opens = asksOnArrival({
      arrived,
      carry,
      loading: phase === 'loading',
      makeDisabled: chrome.makeDisabled || chrome.buysCredits,
      hideMake: chrome.hideMake,
    });
    /* 탭의 표(밖의 저장소)를 읽은 답을 다음 차례에 싣는다 — 그리는 도중에 창을 여는 값을 바꾸지 않는다 */
    if (opens) queueMicrotask(() => setAsking(true));
  }, [target.kind, carry, phase, chrome.makeDisabled, chrome.buysCredits, chrome.hideMake]);

  /**
   * **「전체 풀이만 보기」** — 잇기가 막혀 실패한 자리의 탈출구(ADR 0143 「덧」). 귀속 표를 걷고 화면을 다시 읽는다 — 「아까 보던
   * 내용」이 내려가고 다음 누름은 보통 풀이다. 누르는 것은 풀이권이 아니라 이어 보기를 그만두는 것이라 확인창을 안 연다.
   */
  const [skipping, startSkipping] = useTransition();
  const offersPlain =
    target.kind === 'self' &&
    offersPlainReading({ carry: showsCarry ? carry : null, lastFailureCode, loading: phase === 'loading' });
  const skipCarry = () => {
    startSkipping(async () => {
      await skipCarriedTaste(() => sessionStorage, skipTasteCarry);
    });
  };

  return {
    phase,
    failure,
    reading,
    isMock,
    progress,
    noun,
    creditsNote,
    chrome,
    showsCarry,
    asking,
    closeAsking: () => setAsking(false),
    confirmGenerate,
    generate,
    press,
    buy,
    offersPlain,
    skipping,
    skipCarry,
  };
}
