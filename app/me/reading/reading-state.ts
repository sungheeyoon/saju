import {
  READING_ALREADY_RUNNING_NOTE,
  READING_FAILED_NOTE,
  READING_UNEXPECTED_NOTE,
} from '@/src/lib/reading';

import type { CurrentReading } from './current';

/**
 * **누름과 기다림이 화면에서 어떤 자리를 지나는가.**
 *
 * 결과 칸이 들던 상태 넷(`mockReading` · `phase` · `failure` · `isMock`)이 여기로
 * 내려왔다. 칸 안에 있을 때 그 넷은 여덟 개의 `set*` 호출로 흩어져 있었고, 갈래
 * 일곱(누름 · 열림 · 이미 돎 · 거절 · 예외 · 예시 · 끝남)을 한자리에서 볼 방법이
 * 없었다 — 그래서 **어느 갈래에서 어떤 문장이 서는지를 아무도 재지 않았다.**
 *
 * 부수효과는 안 들어온다. 풀이권을 외치는 일(`announceCreditsMoved`), 화면을 다시
 * 읽는 일(`router.refresh`), 확인 창을 여는 일은 다 칸이 한다. 여기 있는 것은
 * **다음 상태가 무엇인가** 하나뿐이라 그냥 부르면 재어진다.
 *
 * `isMock` 은 안 든다. 예시 글이 서 있는 것과 `mock !== null` 은 언제나 같은 말이었고,
 * 둘을 따로 들면 **한쪽만 지우는 갈래**가 생긴다.
 */
export type ReadingPhase = 'idle' | 'loading' | 'error';

export type ReadingFlow = {
  readonly phase: ReadingPhase;
  /**
   * 사용자에게 세울 한 줄 — 없으면 `null`.
   *
   * `error` 일 때는 경고로, 아닐 때는 알림으로 선다. **`loading` 이면서 이 값이 있는
   * 자리가 있다** — 이미 도는 시도가 있어서 내 누름이 아무것도 열지 못한 때다.
   */
  readonly failure: string | null;
  /** 개발용 예시 글 — 진짜 글은 서버가 들고 이 칸은 안 든다 */
  readonly mock: CurrentReading | null;
};

/**
 * **연결을 못 쓸 때 대신 보이는 글에 붙는 말.**
 *
 * 개발 기계에서만 선다(`allowMockFallback`). 그래도 `null` 로 두지 않는 것은, 이 글이
 * 모델이 쓴 것이 아니라는 사실을 화면이 말하지 않으면 **개발자가 그것을 결과로 읽기**
 * 때문이다.
 */
export const READING_MOCK_NOTE =
  '풀이를 만드는 연결을 지금 쓸 수 없어, 화면 검토용 예시 글을 대신 보이고 있습니다.';

export type ReadingEvent =
  /** 확인 창에서 「받기」를 눌렀다 */
  | { type: 'press' }
  /** 액션이 답했다 — `started` 가 **내 누름이 시도를 열었는가**다 */
  | { type: 'opened'; started: boolean }
  /** DB 가 이유를 붙여 거절했다 */
  | { type: 'refused'; message: string }
  /** 액션이 예외로 끝났다 — 이유를 모른다 */
  | { type: 'threw' }
  /** 연결을 못 써서 예시 글을 세운다 */
  | { type: 'mock'; reading: CurrentReading }
  /** 지켜보던 시도가 끝났다 */
  | { type: 'settled'; status: 'succeeded' | 'failed' };

/**
 * 화면이 열릴 때의 자리 — **도는 시도는 내 누름이 아니어도 기다린다.**
 *
 * 새로고침하고 돌아오거나 다른 기기에서 열어도 서버에는 도는 시도가 있다. 모르면
 * 화면이 「아무것도 안 하고 있다」고 말한다.
 */
export function initialFlow({
  running,
  failed,
}: {
  running: boolean;
  failed: boolean;
}): ReadingFlow {
  return {
    phase: running ? 'loading' : 'idle',
    failure: failed ? READING_FAILED_NOTE : null,
    mock: null,
  };
}

export function readingFlow(state: ReadingFlow, event: ReadingEvent): ReadingFlow {
  switch (event.type) {
    /* 누르면 앞의 것은 다 지운다 — 지난번 실패도, 세워 두었던 예시 글도 */
    case 'press':
      return { phase: 'loading', failure: null, mock: null };

    /**
     * **열지 못한 것도 기다릴 일이다.** 한 대상에 도는 시도는 하나라, 이미 도는 것이
     * 있으면 이 누름은 아무것도 열지 않고 돌아온다(`started: false`). 그래도 그 시도가
     * 끝나면 새 글이 서므로 기다리는 모습 그대로 둔다 — 다만 **내가 방금 연 것이
     * 아니라는 사실**은 말해 준다. 안 그러면 「눌렀는데 그대로」로 보인다.
     */
    case 'opened':
      return event.started ? state : { ...state, failure: READING_ALREADY_RUNNING_NOTE };

    /* DB 가 이유를 적어 보냈으면 그 문장을 그대로 세운다 */
    case 'refused':
      return { ...state, phase: 'error', failure: event.message };

    case 'threw':
      return { ...state, phase: 'error', failure: READING_UNEXPECTED_NOTE };

    case 'mock':
      return { phase: 'idle', failure: READING_MOCK_NOTE, mock: event.reading };

    /**
     * **끝나면 앞서 세운 말도 함께 걷는다.**
     *
     * 이 줄이 칸 안에 있을 때는 `phase` 만 되돌리고 문장은 안 건드렸다. 그래서 이미
     * 도는 시도를 기다리다 그것이 성공하면, 새 글 옆에 **「이미 만들고 있는 시도가
     * 있어요」가 그대로 남았다** — 끝난 일을 가리키는 문장이다.
     */
    case 'settled':
      return {
        ...state,
        phase: 'idle',
        failure: event.status === 'failed' ? READING_FAILED_NOTE : null,
      };
  }
}
