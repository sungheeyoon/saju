import { READING_NOUN, readingCreditsNote } from '@reading/notes';
import { progressSoFar } from '@reading/outline';
import { panelChrome } from '@reading/panel-chrome';
import {
  afterAsking,
  afterPress,
  answerOf,
  initialFlow,
  newsKeyOf,
  readingFlow,
  type PressOutcome,
  type RunAnswer,
} from '@reading/reading-flow';
import type { RunProgress } from '@reading/run';
import { watchRun, type PageVisibility } from '@reading/watch-run';
import { useEffect, useReducer, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { improvementConsented, markReadingRead, newRequestKey, readReadingRun, readReadingView, startReading, type DoorRefusal, type ReadingTarget, type ReadingView } from './api';
import { settled } from '@/ui/settled';

export type ShownView = Extract<ReadingView, { view: 'reading' }>;

/** 앱이 앞에 있는가 — 지켜보는 고리가 뒤로 간 앱에서 쉬게. 판단은 웹과 같은 `watchRun` 이다 */
const appVisibility: PageVisibility = {
  hidden: () => AppState.currentState !== 'active',
  onChange: (listener) => {
    const subscription = AppState.addEventListener('change', listener);
    return () => subscription.remove();
  },
};

/**
 * **결과 칸의 상태와 누름** — 웹의 `app/me/reading/use-reading-panel.ts` 와 같은 판단(`reading-flow` · `panel-chrome` · `watch-run`)을 탄다.
 *
 * 웹과 다른 자리는 하나다. 웹은 끝난 것을 본 액션의 응답이 화면을 다시 싣고, 앱은 그런 길이 없어 **끝난 것을 본 물음에서 풀이 칸을
 * 한 번 더 읽는다.** 맛보기 잇기 · 예시 글은 없다(입구 결정 · 웹의 개발 기계 전용).
 */
export function useReadingPanel({
  target,
  initial,
  automatic,
  onRefused,
}: {
  target: ReadingTarget;
  initial: ShownView;
  automatic: boolean;
  /** 문이 자격으로 거절했다 — 부르는 칸이 길을 고른다 */
  onRefused: (refused: DoorRefusal) => void;
}) {
  const [view, setView] = useState(initial);
  const [flow, dispatch] = useReducer(
    readingFlow,
    { running: initial.run?.status === 'running', failed: initial.run?.status === 'failed', hasReading: initial.reading !== null },
    initialFlow,
  );
  const [progress, setProgress] = useState<RunProgress | null>(initial.run?.progress ?? null);
  const [asking, setAsking] = useState(false);
  const [shortage, setShortage] = useState<{ available: number } | null>(null);

  /* 못 읽었으면 동의를 주장하지 않는다(ADR 0078) — 설문이 안 설 뿐이다 */
  const [consented, setConsented] = useState(false);
  useEffect(() => {
    let live = true;
    void settled(improvementConsented(), 'improvementConsented', () => false).then((yes) => {
      if (live) setConsented(yes);
    });
    return () => {
      live = false;
    };
  }, []);

  const { phase, failure } = flow;
  const reading = view.reading;

  /* 기다리기 전에 서 있던 글 — 끝난 뒤 이것과 다른 글이 서야 기다림을 내린다(`ReadingFlow.arriving`) */
  const keyBeforeWait = useRef(newsKeyOf(reading));

  /* 본 글의 완성 소식을 읽음으로 — 다시 받아 새 글이 서면 그 글의 소식도 한 번(웹의 `readNewsWhenSeen`) */
  const newsKey = newsKeyOf(reading);
  const newsReadingId = reading?.id ?? null;
  const newsSentFor = useRef<string | null>(null);
  useEffect(() => {
    if (newsKey === null || newsReadingId === null || newsSentFor.current === newsKey) return;
    newsSentFor.current = newsKey;
    void markReadingRead(newsReadingId);
  }, [newsKey, newsReadingId]);

  /** 풀이 칸을 다시 읽는다 — 끝났을 때와 풀이권이 움직였을 때. 못 읽으면 지금 값을 둔다. 읽은 값을 답으로 준다 */
  const reread = async (): Promise<ShownView | null> => {
    const answer = await readReadingView(target);
    if (!answer.ok) {
      if (answer.refused.refused !== 'unavailable') onRefused(answer.refused);
      return null;
    }
    if (answer.value.view !== 'reading') return null;
    setView(answer.value);
    return answer.value;
  };
  const rereadRef = useRef(reread);
  rereadRef.current = reread;

  useEffect(() => {
    if (phase !== 'loading') return;

    let alive = true;
    const ask = async () => {
      const asked = await readReadingRun(target);
      if (!alive) return;

      let answer: RunAnswer;
      if (asked.ok) {
        answer = answerOf(asked.value.run);
        const seen = asked.value.run?.progress ?? null;
        setProgress((before) => progressSoFar(before, seen));
      } else {
        /* 한 번 못 물은 것으로 끝났다고 하지 않는다. 다음 물음에서 다시 본다 */
        answer = { kind: 'unreachable' };
        if (asked.refused.refused !== 'unavailable') onRefused(asked.refused);
      }

      if (answer.kind !== 'settled') return;

      const fresh = await rereadRef.current();
      if (!alive) return;
      const shown = fresh?.reading ?? null;
      const decision = afterAsking(answer, newsKeyOf(shown) !== keyBeforeWait.current, shown !== null);
      if (decision.event !== null) dispatch(decision.event);
    };

    const stop = watchRun({ ask, visibility: appVisibility });
    return () => {
      alive = false;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 고리는 기다림의 시작과 끝에만 다시 선다
  }, [phase, target]);

  const offerCredits = (available: number) => {
    setShortage({ available });
  };

  const generate = async () => {
    dispatch({ type: 'press' });
    setProgress(null);
    keyBeforeWait.current = newsKeyOf(view.reading);

    const answer = await startReading(target, newRequestKey());
    let outcome: PressOutcome;
    if (answer.ok) {
      const result = answer.value;
      outcome = result.ok
        ? { kind: 'opened', started: result.started }
        : result.outOfCredits
          ? { kind: 'out-of-credits' }
          : { kind: 'refused', message: result.message };
    } else if (answer.refused.refused === 'unavailable') {
      outcome = { kind: 'refused', message: answer.refused.message };
    } else {
      onRefused(answer.refused);
      outcome = { kind: 'threw' };
    }

    /* 예시 글은 웹의 개발 기계 것이다 — 앱에서는 실패가 실패로 선다 */
    const decision = afterPress(outcome, null);
    if (decision.event !== null) dispatch(decision.event);
    if (decision.announcesCredits) void rereadRef.current();
    if (decision.opensCredits) offerCredits(0);
  };

  const noun = READING_NOUN[target.kind];
  const chrome = panelChrome({
    kind: target.kind,
    noun,
    loading: phase === 'loading',
    reading,
    isMock: false,
    credits: view.credits,
    automatic,
    consented,
  });

  return {
    view,
    phase,
    failure,
    reading,
    progress,
    noun,
    creditsNote: view.credits === null ? null : readingCreditsNote(view.credits),
    chrome,
    asking,
    closeAsking: () => setAsking(false),
    confirmGenerate: () => {
      setAsking(false);
      void generate();
    },
    generate: () => void generate(),
    press: () => {
      if (chrome.buysCredits) offerCredits(view.credits?.available ?? 0);
      else setAsking(true);
    },
    shortage,
    closeShortage: () => setShortage(null),
  };
}
