import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startRunner } from './runner';

describe('시계 위의 채널 상태', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const hands = () => ({ resync: vi.fn(), rejoin: vi.fn() });

  it('채널이 안 서 있으면 보이는 동안 30초마다 다시 대조하고, 서면 멈춘다', () => {
    const h = hands();
    const runner = startRunner(h, true);

    vi.advanceTimersByTime(29_999);
    expect(h.resync).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1);
    expect(h.resync).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30_000);
    expect(h.resync).toHaveBeenCalledTimes(2);

    runner.feed({ type: 'subscribed' });
    expect(h.resync).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(5 * 60_000);
    expect(h.resync).toHaveBeenCalledTimes(3);
    runner.stop();
  });

  it('끊기면 1s · 2s · 4s 뒤에 다시 붙고, 서면 뒤물림이 처음으로 돌아간다', () => {
    const h = hands();
    const runner = startRunner(h, false);
    runner.feed({ type: 'subscribed' });

    runner.feed({ type: 'failed' });
    vi.advanceTimersByTime(999);
    expect(h.rejoin).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1);
    expect(h.rejoin).toHaveBeenCalledTimes(1);

    runner.feed({ type: 'failed' });
    vi.advanceTimersByTime(1_999);
    expect(h.rejoin).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(h.rejoin).toHaveBeenCalledTimes(2);

    runner.feed({ type: 'failed' });
    vi.advanceTimersByTime(4_000);
    expect(h.rejoin).toHaveBeenCalledTimes(3);

    runner.feed({ type: 'subscribed' });
    runner.feed({ type: 'failed' });
    vi.advanceTimersByTime(1_000);
    expect(h.rejoin).toHaveBeenCalledTimes(4);
    runner.stop();
  });

  it('숨은 탭은 대체 조회를 안 하고, 돌아오면 한 번 다시 대조한다', () => {
    const h = hands();
    const runner = startRunner(h, true);
    runner.feed({ type: 'failed' });
    runner.feed({ type: 'hidden' });
    vi.advanceTimersByTime(30_000 * 3);
    // 뒤물림은 숨은 동안에도 돈다 — 다시 붙는 것은 조회가 아니다.
    expect(h.resync).toHaveBeenCalledTimes(0);

    runner.feed({ type: 'visible' });
    expect(h.resync).toHaveBeenCalledTimes(1);
    runner.stop();
  });

  it('걷은 뒤에는 타이머도 사건도 아무것도 부르지 않는다', () => {
    const h = hands();
    const runner = startRunner(h, true);
    runner.feed({ type: 'failed' });
    runner.stop();
    runner.feed({ type: 'online' });
    vi.advanceTimersByTime(10 * 60_000);
    expect(h.resync).toHaveBeenCalledTimes(0);
    expect(h.rejoin).toHaveBeenCalledTimes(0);
  });
});
