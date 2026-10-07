/**
 * 채널 하나의 상태 — **언제 다시 대조하고, 언제 다시 붙고, 언제 대체 조회를 도는가**(ADR 0155 「다시 대조」).
 *
 * 타이머도 브라우저도 모르는 순수 함수다. 드라이버(`live-updates.tsx`)가 사건을 넣고, 돌려받은 할 일(`Effect`)을
 * 그대로 한다 — 그래서 가짜 시계 없이도 「끊기면 1s → 2s → … 60s」 · 「보일 때만 30초」를 시험이 한 줄씩 잰다.
 *
 * 채널이 스스로 다시 붙는 길(realtime-js 의 rejoin)은 쓰지 않는다. 실패하면 드라이버가 채널을 걷고 여기서 정한
 * 뒤물림만큼 기다려 새로 연다 — 거절된 구독(남의 주제 · 풀린 토큰)이 라이브러리의 짧은 간격으로 끝없이 두드리지
 * 않게 하고, 뒤물림의 상한이 한 자리에 있게 한다.
 */

/** 처음 다시 붙기까지 — 그 뒤로 두 배씩 */
export const RETRY_FIRST_MS = 1_000;
/** 다시 붙는 간격의 상한 — 재접속 폭주를 피한다(ADR 0155 「수치의 근거」) */
export const RETRY_MAX_MS = 60_000;
/** 채널이 서 있지 않은 동안, 보이는 화면만 이 간격으로 다시 대조한다 */
export const FALLBACK_EVERY_MS = 30_000;

export type Phase =
  /** 구독을 보냈고 답을 기다린다 */
  | 'joining'
  /** 서버가 구독을 받았다 — 사건이 온다 */
  | 'subscribed'
  /** 끊겼거나 거절됐다 — 다시 붙기를 기다린다 */
  | 'down';

export type Connection = {
  readonly phase: Phase;
  /** 연이어 실패한 수 — 다음 뒤물림을 정한다. 서면 0 이다 */
  readonly failures: number;
  /** 문서가 보이는가 — 대체 조회와 목록 다시 그리기는 보일 때만 한다 */
  readonly visible: boolean;
  /** 이 채널이 한 번이라도 섰는가 — 처음 선 때와 다시 선 때의 다시 대조가 다르다(아래 `resync` 의 `first`) */
  readonly joined: boolean;
};

export type Input =
  | { readonly type: 'subscribed' }
  /** `CHANNEL_ERROR` · `TIMED_OUT` · 우리가 걷지 않은 `CLOSED` */
  | { readonly type: 'failed' }
  /** 뒤물림이 끝났다 */
  | { readonly type: 'retry-due' }
  /** 대체 조회의 차례 */
  | { readonly type: 'poll-due' }
  | { readonly type: 'visible' }
  | { readonly type: 'hidden' }
  /** 네트워크가 돌아왔다 */
  | { readonly type: 'online' }
  /** bfcache 에서 돌아왔다(`pageshow` 의 `persisted`) */
  | { readonly type: 'restored' }
  /** 토큰이 새로 났다 — 채널 인증은 supabase-js 가 다시 건다 */
  | { readonly type: 'token-refreshed' };

export type Effect =
  /**
   * 딱지를 다시 세고 지금 화면이 든 갈래를 다시 읽는다. `first` 는 화면을 연 뒤 채널이 처음 선 때다 — 서버가 방금 그린
   * 화면이라 목록은 다시 그리지 않는다(딱지와 방만 다시 읽는다). 다시 그리면 화면 하나를 여는 데 서버 그리기가 둘이 되고,
   * 그 둘째가 사람이 하지 않은 활동으로 적힌다(ADR 0118).
   */
  | { readonly type: 'resync'; readonly first?: boolean }
  /** 지금 채널을 걷고 새로 연다 */
  | { readonly type: 'rejoin' }
  | { readonly type: 'schedule-retry'; readonly ms: number }
  | { readonly type: 'cancel-retry' }
  | { readonly type: 'start-polling'; readonly every: number }
  | { readonly type: 'stop-polling' };

export type Step = { readonly state: Connection; readonly effects: readonly Effect[] };

/** 처음 구독을 보낸 자리 — 보이는지는 드라이버가 문서에서 읽어 넣는다 */
export const opened = (visible: boolean): Connection => ({ phase: 'joining', failures: 0, visible, joined: false });

/** 연이어 `failures` 번 실패한 뒤 기다릴 시간 — 1s · 2s · 4s … 60s 에서 멈춘다 */
export function retryDelay(failures: number): number {
  const exponent = Math.max(0, failures - 1);
  return Math.min(RETRY_MAX_MS, RETRY_FIRST_MS * 2 ** Math.min(exponent, 16));
}

/** 대체 조회가 도는가 — 채널이 서 있지 않고 문서가 보일 때만 */
export const polling = (state: Connection): boolean => state.phase !== 'subscribed' && state.visible;

/** 처음 열 때의 할 일 — 이미 보이는 화면이면 채널이 서기 전에도 대체 조회가 돈다 */
export function openingEffects(state: Connection): readonly Effect[] {
  return polling(state) ? [{ type: 'start-polling', every: FALLBACK_EVERY_MS }] : [];
}

export function step(state: Connection, input: Input): Step {
  const next = advance(state, input);
  const effects = [...next.effects, ...pollingEffects(state, next.state)];
  return { state: next.state, effects };
}

function advance(state: Connection, input: Input): Step {
  switch (input.type) {
    case 'subscribed':
      // 처음 섰든 다시 섰든 끊긴 동안의 변경이 있을 수 있다 — 다시 대조한다.
      return {
        state: { ...state, phase: 'subscribed', failures: 0, joined: true },
        effects: [{ type: 'cancel-retry' }, state.joined ? { type: 'resync' } : { type: 'resync', first: true }],
      };

    case 'failed': {
      // 이미 내려가 기다리는 중이면 같은 실패의 메아리다(오류 뒤의 닫힘) — 뒤물림을 다시 세지 않는다.
      if (state.phase === 'down') return { state, effects: [] };
      const failures = state.failures + 1;
      return {
        state: { ...state, phase: 'down', failures },
        effects: [{ type: 'schedule-retry', ms: retryDelay(failures) }],
      };
    }

    case 'retry-due':
      if (state.phase !== 'down') return { state, effects: [] };
      return { state: { ...state, phase: 'joining' }, effects: [{ type: 'rejoin' }] };

    case 'poll-due':
      return { state, effects: polling(state) ? [{ type: 'resync' }] : [] };

    case 'hidden':
      return { state: { ...state, visible: false }, effects: [] };

    case 'visible':
    case 'online': {
      const shown = input.type === 'visible' ? { ...state, visible: true } : state;
      // 내려가 있으면 뒤물림을 다 기다리지 않는다 — 사람이 돌아왔거나 망이 돌아왔다.
      const rejoin: Effect[] = shown.phase === 'down' ? [{ type: 'cancel-retry' }, { type: 'rejoin' }] : [];
      return {
        state: shown.phase === 'down' ? { ...shown, phase: 'joining' } : shown,
        effects: [...rejoin, { type: 'resync' }],
      };
    }

    case 'restored':
    case 'token-refreshed':
      return { state, effects: [{ type: 'resync' }] };
  }
}

function pollingEffects(before: Connection, after: Connection): readonly Effect[] {
  const was = polling(before);
  const is = polling(after);
  if (was === is) return [];
  return is ? [{ type: 'start-polling', every: FALLBACK_EVERY_MS }] : [{ type: 'stop-polling' }];
}
