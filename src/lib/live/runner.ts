import { openingEffects, opened, step, type Connection, type Effect, type Input } from './connection';

/**
 * 상태(`connection.ts`)의 할 일을 **시계 위에서** 하는 자리 — 타이머 둘(다시 붙기 · 대체 조회)을 든다.
 *
 * 브라우저를 모른다. 채널을 여닫는 일과 다시 대조하는 일은 받은 손(`Hands`)이 하고, 시계는 전역 타이머를 쓴다 —
 * 그래서 vitest 의 가짜 시계로 「30초마다 · 보일 때만 · 서면 멈춘다」를 그대로 잰다.
 */
export type Hands = {
  /** 딱지를 다시 세고 지금 화면이 든 갈래를 다시 읽는다(`resync.ts`) */
  readonly resync: () => void;
  /** 지금 채널을 걷고 새로 연다 */
  readonly rejoin: () => void;
};

export type Runner = {
  readonly feed: (input: Input) => void;
  readonly state: () => Connection;
  /** 타이머를 모두 걷는다 — 이 뒤로 들어온 사건은 버린다 */
  readonly stop: () => void;
};

export function startRunner(hands: Hands, visible: boolean): Runner {
  let state = opened(visible);
  let retry: ReturnType<typeof setTimeout> | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const cancelRetry = () => {
    if (retry !== null) clearTimeout(retry);
    retry = null;
  };
  const stopPolling = () => {
    if (poll !== null) clearInterval(poll);
    poll = null;
  };

  const apply = (effects: readonly Effect[]) => {
    for (const effect of effects) {
      if (stopped) return;
      switch (effect.type) {
        case 'resync':
          hands.resync();
          break;
        case 'rejoin':
          hands.rejoin();
          break;
        case 'schedule-retry':
          cancelRetry();
          retry = setTimeout(() => {
            retry = null;
            feed({ type: 'retry-due' });
          }, effect.ms);
          break;
        case 'cancel-retry':
          cancelRetry();
          break;
        case 'start-polling':
          stopPolling();
          poll = setInterval(() => feed({ type: 'poll-due' }), effect.every);
          break;
        case 'stop-polling':
          stopPolling();
          break;
      }
    }
  };

  const feed = (input: Input) => {
    if (stopped) return;
    const next = step(state, input);
    state = next.state;
    apply(next.effects);
  };

  apply(openingEffects(state));

  return {
    feed,
    state: () => state,
    stop: () => {
      stopped = true;
      cancelRetry();
      stopPolling();
    },
  };
}
