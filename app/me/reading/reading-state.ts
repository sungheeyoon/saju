import {
  isScored,
  READING_ALREADY_RUNNING_NOTE,
  READING_FAILED_NOTE,
  READING_UNEXPECTED_NOTE,
} from '@/src/lib/reading';

import type { CurrentReading, LastRun } from './current';
import type { ReadingTarget } from './target';

/**
 * **누름과 기다림이 화면에서 어떤 자리를 지나는가.**
 *
 * 결과 칸이 들던 상태 넷(`mockReading` · `phase` · `failure` · `isMock`)이 여기로
 * 내려왔다. 칸 안에 있을 때 그 넷은 여덟 개의 `set*` 호출로 흩어져 있었고, 갈래
 * 일곱(누름 · 열림 · 이미 돎 · 거절 · 예외 · 예시 · 끝남)을 한자리에서 볼 방법이
 * 없었다 — 그래서 **어느 갈래에서 어떤 문장이 서는지를 아무도 재지 않았다.**
 *
 * **부수효과를 하지는 않되, 무엇을 할지는 여기서 정한다.** 풀이권을 외치는
 * 일(`announceCreditsMoved`)과 화면을 다시 읽는 일(`router.refresh`)을 실제로 하는 것은
 * 칸이지만, **언제 하는가**는 이 파일이 값으로 답한다(`afterPress` · `afterAsking` 이
 * 내는 `FlowDecision`). 그 둘이 칸 안에 있을 때는 갈래마다 손으로 적혀 있었고, 그래서
 * **거절이 예시 글로 덮이는 갈래도 못 물은 갈래도 아무도 안 쟀다.**
 *
 * 확인 창을 여는 일은 여전히 칸이 한다 — `<dialog>` 가 열림·닫힘을 스스로 든다.
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

/* -------------------------------------------------------------------------- */
/* 누름과 물음이 무엇으로 끝났는가 — **그래서 무엇을 하는가**                  */
/* -------------------------------------------------------------------------- */

/**
 * **누름이 무엇으로 끝났는가** — 액션의 답을 화면의 말로 옮기기 전의 날것.
 *
 * `generateReading` 이 내는 것은 결과가 아니라 **시작 여부**다(ADR 0020). 그래서
 * 「열렸다」는 성공이 아니고, 「아무것도 안 열렸다」도 실패가 아니다 — 셋을 한 칸에
 * 뭉치면 기다릴 일과 그만둘 일이 같은 얼굴이 된다.
 */
export type PressOutcome =
  /** 액션이 답했다 — `started` 가 **내 누름이 시도를 열었는가**다 */
  | { readonly kind: 'opened'; readonly started: boolean }
  /** DB 가 이유를 붙여 거절했다 */
  | { readonly kind: 'refused'; readonly message: string }
  /** 액션이 예외로 끝났다 — 이유를 모른다 */
  | { readonly kind: 'threw' };

/**
 * **지켜보다 무엇을 보았는가.**
 *
 * 「못 물었다」와 「물었더니 없다더라」를 가른다. 둘을 합치면 연결이 한 번 끊긴 것이
 * 「시도가 사라졌다」와 같은 값이 되고, 그러면 **한 번 못 물은 것으로 기다림을 끝내게**
 * 된다 — 만드는 일은 4분까지 가고 그동안 왕복은 80번이다.
 */
export type RunAnswer =
  /** 문을 못 두드렸다 — 다음 물음에서 다시 본다 */
  | { readonly kind: 'unreachable' }
  /** 문은 답했는데 가리킬 시도가 없다 */
  | { readonly kind: 'none' }
  | { readonly kind: 'running' }
  | { readonly kind: 'settled'; readonly status: 'succeeded' | 'failed' };

/**
 * 그 일이 있고 나서 **무엇이 서고 무엇이 움직이는가.**
 *
 * 셋 다 「하라」가 아니라 「할 일이다」다 — 실제로 하는 것은 칸이고, 여기서는 그것이
 * 값이라 그냥 부르면 재어진다.
 */
export type FlowDecision = {
  /** 흐름에 넣을 일 — 없으면 `null`(본 것이 아무것도 안 바꾸는 때) */
  readonly event: ReadingEvent | null;
  /** 풀이권이 움직였을 수 있다고 외치는가 */
  readonly announcesCredits: boolean;
  /** 서버에서 화면을 다시 읽어 오는가 */
  readonly rereads: boolean;
};

const nothing = (event: ReadingEvent | null): FlowDecision =>
  ({ event, announcesCredits: false, rereads: false });

/**
 * 누름이 끝난 자리 — **예시 글을 세울 수 있으면 실패는 그것으로 덮인다.**
 *
 * `preview` 가 곧 「이 기계에서 예시 글을 세울 수 있는가」다(개발 기계에서만 값이
 * 온다). `allowMockFallback` 이라는 참/거짓을 따로 받지 않는 것은 `isMock` 을 안 드는
 * 것과 같은 까닭이다 — **세울 수 있다와 세울 글이 있다가 갈리면 한쪽만 지우는 갈래가
 * 생긴다.**
 *
 * **거절도 덮인다.** 「풀이권을 다 쓰셨어요」까지 예시 글이 가리므로, 개발 기계에서는
 * DB 가 실제로 막은 것을 못 보고 지나갈 수 있다. 그 대신 예시 글 옆에는 언제나
 * `READING_MOCK_NOTE` 가 서고, 프로덕션에서는 `preview` 가 `null` 이라 이 갈래가 아예
 * 없다. 재어 두는 까닭은 **이 맞바꿈이 우연이 아니라는 것**을 값으로 남기기 위해서다.
 */
export function afterPress(outcome: PressOutcome, preview: CurrentReading | null): FlowDecision {
  switch (outcome.kind) {
    /**
     * **열었든 못 열었든 풀이권에 한 번 물어본다.** 외치는 말에는 값이 안 실린다 —
     * 「다시 물어봐라」뿐이라(`credits-signal.ts`), 내 누름이 아무것도 안 열었을 때
     * 외치는 것도 틀린 말이 아니다. 그 사이 남이 연 시도가 자리를 잡고 있다.
     */
    case 'opened':
      return {
        event: { type: 'opened', started: outcome.started },
        announcesCredits: true,
        rereads: false,
      };

    case 'refused':
      return nothing(
        preview !== null
          ? { type: 'mock', reading: preview }
          : { type: 'refused', message: outcome.message },
      );

    case 'threw':
      return nothing(preview !== null ? { type: 'mock', reading: preview } : { type: 'threw' });
  }
}

/**
 * 한 번 물어본 자리 — **끝난 것을 봤을 때만 무언가 한다.**
 *
 * 나머지 셋은 전부 「그대로 기다린다」로 모인다. 그런데 모이는 까닭이 셋 다 다르다:
 * 못 물은 것은 **다음 물음이 있어서**, 도는 중인 것은 **아직 안 끝나서**, 가리킬 시도가
 * 없다는 답은 **그 대상이 우리 것이 아닐 수도 있어서**다(`lastReadingRun` 이 「아직
 * 만들지 않았거나 못 보는 대상」을 한 값으로 낸다). 어느 쪽도 기다림을 끝낼 근거가
 * 못 된다.
 */
export function afterAsking(answer: RunAnswer): FlowDecision {
  if (answer.kind !== 'settled') return nothing(null);

  /*
    끝난 자리에서 외친다. 성공이면 잡고 있던 자리가 쓴 자리로 옮겨 가고 실패면 그
    자리가 풀린다 — 어느 쪽이든 헤더가 들고 있는 숫자는 낡았다.

    그리고 **언제나 다시 읽는다.** 결과는 서버에만 있고 칸이 들고 있는 것은 마지막으로
    그린 화면이다. 다시 안 읽으면 교체로 사라진 옛 글을 계속 세운다.
  */
  return {
    event: { type: 'settled', status: answer.status },
    announcesCredits: true,
    rereads: true,
  };
}

/**
 * 읽은 한 줄을 **화면이 가르는 네 갈래로** 옮긴다.
 *
 * 모르는 상태를 `null` 로 좁히는 일은 이미 `lastReadingRun` 이 한다 — 여기서 다시
 * 물으면 좁히는 자리가 둘이 된다.
 */
export function answerOf(run: LastRun | null): RunAnswer {
  if (run === null) return { kind: 'none' };
  if (run.status === 'running') return { kind: 'running' };

  return { kind: 'settled', status: run.status };
}

/**
 * **연결을 못 쓸 때 대신 세우는 글.**
 *
 * 개발 기계에서만 지어진다. 글자는 화면을 보려고 박아 둔 것이라 뜻이 없지만, 두 칸은
 * 뜻이 있다.
 *
 * - **점수와 비유는 점수가 붙는 대상에만** 선다(`isScored`). 자기 풀이에 숫자를 달아
 *   두면 그 자리가 실제로는 비어 있다는 것을 화면 검토에서 못 본다.
 * - **`sourceRunId` 가 없다.** 이 글을 만든 시도가 없기 때문이고, 그래서 설문도 안
 *   붙는다(`panelChrome` 의 `asksFeedback`). 지어 넣으면 예시 글에 대한 답이 진짜
 *   판본별 값에 섞인다.
 */
export function previewReading(kind: ReadingTarget['kind'], at: Date): CurrentReading {
  const scored = isScored(kind);

  return {
    id: 'development-preview',
    score: scored ? 78 : null,
    metaphor: scored
      ? '오래 걷던 두 사람이 같은 갈림길에서 잠깐 멈춘 모양입니다.'
      : '늘 앞장서 걷다가 가끔 뒤를 돌아보는 사람입니다.',
    output: MOCK_OUTPUT,
    model: 'development-preview',
    viewedAt: at.toISOString(),
    createdAt: at.toISOString(),
    viewerIsFirst: true,
    fromCurrentChart: true,
    sourceRunId: null,
    myFeedback: null,
  };
}

const MOCK_OUTPUT = `## 지금의 핵심

당신의 사주는 **한 방향으로 빠르게 밀어붙이기보다, 주변의 흐름을 읽고 자신의 기준을 세울 때 힘이 나는 구조**로 보입니다. 겉으로는 차분하게 상황을 정리하지만, 납득할 만한 이유가 생기면 생각보다 결단이 빠른 편입니다.

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

이 해석은 저장된 사주 근거를 바탕으로 현재 확인 가능한 경향을 설명합니다. 출생 시각이 없거나 계산 근거가 제한된 부분은 단정하지 않았으며, 중요한 결정을 대신하는 판단으로 사용하지 마세요.`;
