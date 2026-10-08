import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { READ_RETRY_LIMIT, readRetryDelay, startReadRetry } from './read-retry';

describe('못 남긴 읽음의 다시 시도', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = (visible = true) => {
    const state = { visible };
    const attempt = vi.fn();
    const retry = startReadRetry({ attempt, visible: () => state.visible });
    return { state, attempt, retry };
  };

  it('뒤물림은 2초에서 두 배씩 늘어 30초에서 멈추고, 다섯 번 뒤로는 스스로 부르지 않는다', () => {
    expect([1, 2, 3, 4, 5].map(readRetryDelay)).toEqual([2_000, 4_000, 8_000, 16_000, 30_000]);
    expect(readRetryDelay(READ_RETRY_LIMIT + 1)).toBeNull();
    expect(readRetryDelay(0)).toBeNull();
  });

  it('실패하면 보이는 동안 뒤물림 뒤에 다시 부르고, 상한에서 그친다', () => {
    const { attempt, retry } = setup();
    for (let n = 1; n <= READ_RETRY_LIMIT; n += 1) {
      retry.failed();
      vi.advanceTimersByTime(readRetryDelay(n)! - 1);
      expect(attempt).toHaveBeenCalledTimes(n - 1);
      vi.advanceTimersByTime(1);
      expect(attempt).toHaveBeenCalledTimes(n);
    }
    retry.failed();
    vi.advanceTimersByTime(10 * 60_000);
    expect(attempt).toHaveBeenCalledTimes(READ_RETRY_LIMIT);
    retry.stop();
  });

  it('망이 돌아오면(복구 신호) 실패한 것을 곧장 다시 부르고, 뒤물림을 처음으로 되돌린다', () => {
    const { attempt, retry } = setup();
    for (let n = 0; n <= READ_RETRY_LIMIT; n += 1) retry.failed();
    retry.recovered();
    expect(attempt).toHaveBeenCalledTimes(1);
    retry.failed();
    vi.advanceTimersByTime(2_000);
    expect(attempt).toHaveBeenCalledTimes(2);
    retry.stop();
  });

  it('실패가 없으면 복구 신호에 부르지 않는다', () => {
    const { attempt, retry } = setup();
    retry.recovered();
    retry.failed();
    retry.succeeded();
    retry.recovered();
    vi.advanceTimersByTime(60_000);
    expect(attempt).not.toHaveBeenCalled();
    retry.stop();
  });

  it('숨은 탭에서는 차례가 와도 · 복구 신호가 와도 부르지 않는다', () => {
    const { state, attempt, retry } = setup(false);
    retry.failed();
    vi.advanceTimersByTime(60_000);
    retry.recovered();
    expect(attempt).not.toHaveBeenCalled();
    state.visible = true;
    retry.recovered();
    expect(attempt).toHaveBeenCalledTimes(1);
    retry.stop();
  });
});
