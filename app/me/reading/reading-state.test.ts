import { describe, expect, it } from 'vitest';

import {
  READING_ALREADY_RUNNING_NOTE,
  READING_FAILED_NOTE,
  READING_UNEXPECTED_NOTE,
} from '@/src/lib/reading';

import type { CurrentReading, LastRun } from './current';
import {
  afterAsking,
  afterPress,
  answerOf,
  initialFlow,
  previewReading,
  readingFlow,
  READING_MOCK_NOTE,
  type ReadingFlow,
} from './reading-state';

const preview: CurrentReading = {
  id: 'development-preview',
  score: null,
  metaphor: null,
  output: '## 지금의 핵심',
  model: 'development-preview',
  viewedAt: '2026-09-20T00:00:00.000Z',
  createdAt: '2026-09-20T00:00:00.000Z',
  viewerIsFirst: true,
  fromCurrentChart: true,
  sourceRunId: null,
  myFeedback: null,
};

const idle = (): ReadingFlow => initialFlow({ running: false, failed: false });

describe('누름과 기다림이 지나는 자리', () => {
  /**
   * 만드는 일이 요청을 떠난 뒤로(ADR 0020) **누른 화면이 아닌 곳에서도 기다린다.**
   * 새로고침하고 돌아오거나 다른 기기에서 열어도 서버에는 도는 시도가 있다.
   */
  it('열릴 때 이미 도는 시도가 있으면 기다리는 모습으로 선다', () => {
    expect(initialFlow({ running: true, failed: false }).phase).toBe('loading');
    expect(idle().phase).toBe('idle');
  });

  /** 지난번 실패는 다른 기기에서 열어도 말할 수 있어야 한다 — 다만 경고는 아니다 */
  it('지난번이 실패였으면 그 사실을 들고 열되 오류 자리에 서지 않는다', () => {
    const flow = initialFlow({ running: false, failed: true });

    expect(flow.failure).toBe(READING_FAILED_NOTE);
    expect(flow.phase).toBe('idle');
  });

  it('누르면 지난번 실패도 세워 두었던 예시 글도 함께 지운다', () => {
    const stale = readingFlow(readingFlow(idle(), { type: 'mock', reading: preview }), {
      type: 'refused',
      message: '풀이권을 다 쓰셨어요.',
    });

    expect(readingFlow(stale, { type: 'press' })).toEqual({
      phase: 'loading',
      failure: null,
      mock: null,
    });
  });

  /**
   * **아무것도 열지 못한 누름을 말없이 지나가지 않는다.**
   *
   * 한 대상에 도는 시도는 하나다. 이미 도는 것이 있으면 이 누름은 아무것도 열지
   * 않고 돌아오는데, 그 갈래를 안 보면 누른 사람에게는 「눌렀는데 그대로」가 된다.
   */
  it('이미 도는 시도가 있으면 기다리되 내가 연 것이 아님을 말한다', () => {
    const pressed = readingFlow(idle(), { type: 'press' });

    const opened = readingFlow(pressed, { type: 'opened', started: true });
    expect(opened.failure).toBeNull();
    expect(opened.phase).toBe('loading');

    const joined = readingFlow(pressed, { type: 'opened', started: false });
    expect(joined.failure).toBe(READING_ALREADY_RUNNING_NOTE);
    /* 기다릴 일인 것은 마찬가지다 — 그 시도가 끝나면 새 글이 선다 */
    expect(joined.phase).toBe('loading');
  });

  /**
   * **끝난 일을 가리키는 문장이 새 글 옆에 남지 않는다.**
   *
   * 칸이 상태를 흩어 들고 있을 때는 끝나면 `phase` 만 되돌리고 문장은 안 건드렸다.
   * 그래서 남이 연 시도를 기다리다 그것이 성공하면 「이미 만들고 있는 시도가
   * 있어요」가 완성된 글 옆에 그대로 섰다.
   */
  it('시도가 성공으로 끝나면 기다리며 세웠던 말도 함께 걷는다', () => {
    const joined = readingFlow(readingFlow(idle(), { type: 'press' }), {
      type: 'opened',
      started: false,
    });

    const done = readingFlow(joined, { type: 'settled', status: 'succeeded' });
    expect(done.phase).toBe('idle');
    expect(done.failure).toBeNull();
  });

  it('시도가 실패로 끝나면 실패 문장이 서되 오류 자리는 아니다', () => {
    const settled = readingFlow(readingFlow(idle(), { type: 'press' }), {
      type: 'settled',
      status: 'failed',
    });

    expect(settled.failure).toBe(READING_FAILED_NOTE);
    /* 누름이 깨진 것이 아니라 만들던 것이 실패한 것이다 — 다시 누를 수 있다 */
    expect(settled.phase).toBe('idle');
  });

  /**
   * **DB 가 이유를 적어 보냈으면 그 문장을 그대로 세운다.** 우리 문장으로 덮으면
   * 「풀이권을 다 쓰셨어요」가 「예상치 못한 오류」가 된다.
   */
  it('거절은 DB 의 문장을, 예외는 우리 문장을 세운다', () => {
    const pressed = readingFlow(idle(), { type: 'press' });

    const refused = readingFlow(pressed, { type: 'refused', message: '풀이권을 다 쓰셨어요.' });
    expect(refused).toEqual({ phase: 'error', failure: '풀이권을 다 쓰셨어요.', mock: null });

    const threw = readingFlow(pressed, { type: 'threw' });
    expect(threw).toEqual({ phase: 'error', failure: READING_UNEXPECTED_NOTE, mock: null });
  });

  /**
   * 예시 글은 모델이 쓴 것이 아니다. 화면이 그 사실을 말하지 않으면 **개발자가 그것을
   * 결과로 읽는다** — 그래서 글과 함께 반드시 한 줄이 선다.
   */
  it('예시 글은 기다림을 끝내고 예시라는 사실과 함께 선다', () => {
    const shown = readingFlow(readingFlow(idle(), { type: 'press' }), {
      type: 'mock',
      reading: preview,
    });

    expect(shown.phase).toBe('idle');
    expect(shown.mock).toBe(preview);
    expect(shown.failure).toBe(READING_MOCK_NOTE);
  });
});

/**
 * 여기부터는 **흐름에 넣기 전의 물음**이다 — 누름이 무엇으로 끝났고 지켜보다 무엇을
 * 봤을 때, 무엇이 서고 무엇이 움직이는가.
 *
 * 이 판단들은 칸 안의 `generate()` 와 지켜보는 고리 안에 손으로 적혀 있었다. 둘 다
 * `await` 와 `setInterval` 에 매여 있어서 **부르려면 브라우저가 있어야 했고**, 그래서
 * 아무도 안 쟀다. 값으로 내려오니 그냥 부른다.
 */
describe('누름이 무엇으로 끝났는가', () => {
  /**
   * **시도를 열었으면 풀이권은 그때 이미 움직였다.** 성공을 기다리지 않는다 — 여는
   * 순간 한 자리를 잡으므로 헤더가 들고 있는 숫자는 그 시점에 낡는다.
   */
  it('시도를 열면 기다리는 모습 그대로 두고 풀이권을 다시 묻게 한다', () => {
    const decision = afterPress({ kind: 'opened', started: true }, null);

    expect(decision.event).toEqual({ type: 'opened', started: true });
    expect(decision.announcesCredits).toBe(true);
    /* 아직 볼 것이 없다 — 다시 읽는 것은 끝난 것을 본 자리의 일이다 */
    expect(decision.rereads).toBe(false);
  });

  /**
   * 내 누름이 아무것도 못 열었어도 외친다. 외치는 말에 값이 안 실리기 때문에
   * (「다시 물어봐라」뿐이다) 틀린 말이 되지 않고, **남이 연 시도가 그 사이 자리를
   * 잡고 있다** — 안 외치면 헤더가 남의 예약을 모르는 채로 선다.
   */
  it('아무것도 못 연 누름도 같은 자리를 지난다', () => {
    const decision = afterPress({ kind: 'opened', started: false }, null);

    expect(decision.event).toEqual({ type: 'opened', started: false });
    expect(decision.announcesCredits).toBe(true);
  });

  it('예시 글을 못 세우는 기계에서는 거절이 DB 문장으로, 예외가 우리 문장으로 선다', () => {
    expect(afterPress({ kind: 'refused', message: '풀이권을 다 쓰셨어요.' }, null).event).toEqual({
      type: 'refused',
      message: '풀이권을 다 쓰셨어요.',
    });
    expect(afterPress({ kind: 'threw' }, null).event).toEqual({ type: 'threw' });
  });

  /**
   * **개발 기계에서는 거절까지 예시 글이 덮는다.**
   *
   * 이 맞바꿈은 우연이 아니다 — 연결이 없는 기계에서 화면을 보려고 일부러 그렇게 두었다.
   * 다만 그 대가로 **DB 가 실제로 막은 것**(「풀이권을 다 쓰셨어요」)을 개발자가 못 보고
   * 지나갈 수 있으므로, 잊지 않게 값으로 적어 둔다. 프로덕션에는 이 갈래가 아예 없다.
   */
  it('예시 글을 세울 수 있으면 거절도 예외도 그 글로 덮인다', () => {
    expect(afterPress({ kind: 'refused', message: '풀이권을 다 쓰셨어요.' }, preview).event).toEqual({
      type: 'mock',
      reading: preview,
    });
    expect(afterPress({ kind: 'threw' }, preview).event).toEqual({ type: 'mock', reading: preview });
  });

  /** 아무 시도도 안 열렸다 — 잔액은 그대로고 서버에 새로 읽어 올 것도 없다 */
  it('예시 글을 세우는 길에서는 풀이권도 화면도 안 건드린다', () => {
    const decision = afterPress({ kind: 'threw' }, preview);

    expect(decision.announcesCredits).toBe(false);
    expect(decision.rereads).toBe(false);
  });
});

describe('지켜보다 본 것', () => {
  /**
   * **한 번 못 물은 것으로 기다림을 끝내지 않는다.** 만드는 일은 4분까지 가고 그동안
   * 왕복이 80번이다 — 그중 한 번이 끊긴 것을 「끝났다」로 읽으면 다 된 글을 못 세운다.
   */
  it('못 물은 것으로는 아무것도 안 한다', () => {
    expect(afterAsking({ kind: 'unreachable' })).toEqual({
      event: null,
      announcesCredits: false,
      rereads: false,
    });
  });

  it('아직 도는 중이면 그대로 기다린다', () => {
    expect(afterAsking({ kind: 'running' }).event).toBeNull();
  });

  /**
   * **「가리킬 시도가 없다」도 끝이 아니다.** 그 답에는 「아직 안 만들었다」와 「못 보는
   * 대상이다」가 함께 들어 있어(`lastReadingRun`), 어느 쪽인지 모르는 채로 기다림을
   * 끝내면 **도는 중인 시도를 두고 「없다」고 말하는** 화면이 된다.
   */
  it('가리킬 시도가 없다는 답으로도 끝내지 않는다', () => {
    expect(afterAsking({ kind: 'none' }).event).toBeNull();
  });

  it('끝난 것을 보면 그 사실을 세우고 풀이권과 화면을 함께 무르게 한다', () => {
    expect(afterAsking({ kind: 'settled', status: 'succeeded' })).toEqual({
      event: { type: 'settled', status: 'succeeded' },
      announcesCredits: true,
      rereads: true,
    });
    /* 실패도 잡고 있던 자리가 풀리는 일이라 똑같이 셋을 한다 */
    expect(afterAsking({ kind: 'settled', status: 'failed' })).toEqual({
      event: { type: 'settled', status: 'failed' },
      announcesCredits: true,
      rereads: true,
    });
  });
});

describe('읽은 한 줄이 네 갈래로 갈린다', () => {
  const run = (status: LastRun['status']): LastRun => ({
    status,
    failureCode: null,
    createdAt: '2026-09-22T00:00:00.000Z',
  });

  it('행이 없으면 「가리킬 시도가 없다」다 — 못 물은 것과 다른 값이다', () => {
    expect(answerOf(null)).toEqual({ kind: 'none' });
  });

  it('도는 중은 도는 중이다', () => {
    expect(answerOf(run('running'))).toEqual({ kind: 'running' });
  });

  it('끝난 것은 어떻게 끝났는지를 들고 온다', () => {
    expect(answerOf(run('succeeded'))).toEqual({ kind: 'settled', status: 'succeeded' });
    expect(answerOf(run('failed'))).toEqual({ kind: 'settled', status: 'failed' });
  });
});

describe('예시 글', () => {
  const at = new Date('2026-09-22T00:00:00.000Z');

  /**
   * 점수가 붙지 않는 대상에 숫자를 달아 두면 **그 자리가 실제로는 비어 있다는 것**을
   * 화면 검토에서 못 본다.
   */
  it('점수는 점수가 붙는 대상에만 선다', () => {
    expect(previewReading('self', at).score).toBeNull();
    expect(previewReading('person', at).score).toBeNull();
    expect(previewReading('private', at).score).not.toBeNull();
    expect(previewReading('match', at).score).not.toBeNull();
  });

  /** 한 문장 결론은 네 kind 에 다 선다 — 점수와 달리 궁합만의 것이 아니다 */
  it('한 문장 결론은 어느 대상에서나 선다', () => {
    expect(previewReading('self', at).metaphor).not.toBeNull();
    expect(previewReading('match', at).metaphor).not.toBeNull();
  });

  /**
   * **이 글을 만든 시도가 없다.** 설문이 안 붙는 것이 이 값 하나에 달려 있고
   * (`panelChrome` 의 `asksFeedback`), 지어 넣으면 예시 글에 대한 답이 진짜 판본별
   * 값에 섞인다.
   */
  it('어느 시도가 만들었는지가 없다', () => {
    expect(previewReading('self', at).sourceRunId).toBeNull();
  });
});
