import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RUN_ASK_EVERY_MS, watchRun, type PageVisibility } from './watch-run';

/** 손으로 숨기고 보이는 탭 — `document` 의 `visibilitychange` 대신 */
function fakeTab(hidden = false) {
  let state = hidden;
  const listeners = new Set<() => void>();
  const visibility: PageVisibility = {
    hidden: () => state,
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    visibility,
    set(next: boolean) {
      state = next;
      for (const listener of listeners) listener();
    },
    listening: () => listeners.size,
  };
}

/** 부를 때마다 센다 — `slowMs` 가 있으면 그만큼 뒤에 답한다 */
function fakeAsk(slowMs = 0) {
  let calls = 0;
  let inFlight = 0;
  let overlapped = false;
  const ask = async () => {
    calls += 1;
    inFlight += 1;
    if (inFlight > 1) overlapped = true;
    if (slowMs > 0) await new Promise((resolve) => setTimeout(resolve, slowMs));
    inFlight -= 1;
  };
  return { ask, calls: () => calls, overlapped: () => overlapped };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('도는 시도를 지켜보는 고리', () => {
  it('보이는 동안은 한 간격마다 하나씩 묻고, 연 그 자리에서는 묻지 않는다', async () => {
    const tab = fakeTab();
    const { ask, calls } = fakeAsk();
    watchRun({ ask, visibility: tab.visibility });

    expect(calls()).toBe(0);
    await vi.advanceTimersByTimeAsync(RUN_ASK_EVERY_MS);
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(RUN_ASK_EVERY_MS * 2);
    expect(calls()).toBe(3);
  });

  it('숨긴 탭에서는 멈춘다', async () => {
    const tab = fakeTab();
    const { ask, calls } = fakeAsk();
    watchRun({ ask, visibility: tab.visibility });

    await vi.advanceTimersByTimeAsync(RUN_ASK_EVERY_MS);
    tab.set(true);
    await vi.advanceTimersByTimeAsync(RUN_ASK_EVERY_MS * 10);

    expect(calls()).toBe(1);
  });

  it('숨긴 채로 열면 보일 때까지 안 묻는다', async () => {
    const tab = fakeTab(true);
    const { ask, calls } = fakeAsk();
    watchRun({ ask, visibility: tab.visibility });

    await vi.advanceTimersByTimeAsync(RUN_ASK_EVERY_MS * 5);
    expect(calls()).toBe(0);

    tab.set(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls()).toBe(1);
  });

  it('다시 보이면 간격을 기다리지 않고 곧바로 한 번 묻고, 그 뒤로 간격을 잇는다', async () => {
    const tab = fakeTab();
    const { ask, calls } = fakeAsk();
    watchRun({ ask, visibility: tab.visibility });

    tab.set(true);
    await vi.advanceTimersByTimeAsync(RUN_ASK_EVERY_MS * 4);
    expect(calls()).toBe(0);

    tab.set(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls()).toBe(1);

    await vi.advanceTimersByTimeAsync(RUN_ASK_EVERY_MS - 1);
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls()).toBe(2);
  });

  it('숨기지 않은 채 「보인다」가 다시 와도 한 번 더 묻지 않는다', async () => {
    const tab = fakeTab();
    const { ask, calls } = fakeAsk();
    watchRun({ ask, visibility: tab.visibility });

    tab.set(false);
    tab.set(false);
    await vi.advanceTimersByTimeAsync(RUN_ASK_EVERY_MS - 1);

    expect(calls()).toBe(0);
  });

  it('응답이 간격보다 느려도 물음이 겹치지 않고, 답이 온 뒤에 한 간격을 둔다', async () => {
    const tab = fakeTab();
    const slowMs = RUN_ASK_EVERY_MS * 2;
    const { ask, calls, overlapped } = fakeAsk(slowMs);
    watchRun({ ask, visibility: tab.visibility });

    /* 3초에 첫 물음 · 9초에 답 · 12초에 둘째 물음 */
    await vi.advanceTimersByTimeAsync(RUN_ASK_EVERY_MS + slowMs + RUN_ASK_EVERY_MS - 1);
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls()).toBe(2);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(overlapped()).toBe(false);
  });

  it('묻는 중에 숨겼다 돌아와도 그 답을 기다린다 — 겹쳐 묻지 않는다', async () => {
    const tab = fakeTab();
    const { ask, calls, overlapped } = fakeAsk(RUN_ASK_EVERY_MS * 2);
    watchRun({ ask, visibility: tab.visibility });

    await vi.advanceTimersByTimeAsync(RUN_ASK_EVERY_MS);
    expect(calls()).toBe(1);
    tab.set(true);
    tab.set(false);
    await vi.advanceTimersByTimeAsync(0);

    expect(calls()).toBe(1);
    expect(overlapped()).toBe(false);
  });

  it('묻는 중에 숨기면 그 답이 와도 다음을 잡지 않는다', async () => {
    const tab = fakeTab();
    const slowMs = 1_000;
    const { ask, calls } = fakeAsk(slowMs);
    watchRun({ ask, visibility: tab.visibility });

    await vi.advanceTimersByTimeAsync(RUN_ASK_EVERY_MS);
    tab.set(true);
    await vi.advanceTimersByTimeAsync(slowMs + RUN_ASK_EVERY_MS * 5);

    expect(calls()).toBe(1);
  });

  it('물음이 던져도 고리는 다음 물음으로 간다', async () => {
    const tab = fakeTab();
    let calls = 0;
    watchRun({
      ask: async () => {
        calls += 1;
        throw new Error('끊겼다');
      },
      visibility: tab.visibility,
    });

    await vi.advanceTimersByTimeAsync(RUN_ASK_EVERY_MS * 2);

    expect(calls).toBe(2);
  });

  it('멈추면 다시 안 묻고, 탭 바뀜도 더는 안 듣는다', async () => {
    const tab = fakeTab();
    const { ask, calls } = fakeAsk();
    const stop = watchRun({ ask, visibility: tab.visibility });

    stop();
    tab.set(true);
    tab.set(false);
    await vi.advanceTimersByTimeAsync(RUN_ASK_EVERY_MS * 5);

    expect(calls()).toBe(0);
    expect(tab.listening()).toBe(0);
  });

  it('묻는 중에 멈추면 늦게 온 답 뒤에도 다음을 잡지 않는다', async () => {
    const tab = fakeTab();
    const slowMs = 1_000;
    const { ask, calls } = fakeAsk(slowMs);
    const stop = watchRun({ ask, visibility: tab.visibility });

    await vi.advanceTimersByTimeAsync(RUN_ASK_EVERY_MS);
    stop();
    await vi.advanceTimersByTimeAsync(slowMs + RUN_ASK_EVERY_MS * 5);

    expect(calls()).toBe(1);
  });
});
