import { describe, expect, it } from 'vitest';

import {
  READING_ALREADY_RUNNING_NOTE,
  READING_FAILED_NOTE,
  READING_UNEXPECTED_NOTE,
} from '@/src/lib/reading';

import type { CurrentReading } from './current';
import { initialFlow, readingFlow, READING_MOCK_NOTE, type ReadingFlow } from './reading-state';

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
