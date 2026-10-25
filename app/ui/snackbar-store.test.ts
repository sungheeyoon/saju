import { describe, expect, it, vi } from 'vitest';

import { createSnackbarStore, SNACKBAR_SHOWN_MS, snackbarMessage } from './snackbar-store';

/** 손으로 미는 시계 — 걸린 일을 시각 순서로 돈다 */
function clock() {
  let now = 0;
  let nextHandle = 1;
  const pending = new Map<number, { at: number; run: () => void }>();
  return {
    timers: {
      set: (run: () => void, ms: number) => {
        const handle = nextHandle++;
        pending.set(handle, { at: now + ms, run });
        return handle;
      },
      clear: (handle: unknown) => {
        pending.delete(handle as number);
      },
      now: () => now,
    },
    advance(ms: number) {
      now += ms;
      for (const [handle, job] of [...pending].sort((a, b) => a[1].at - b[1].at)) {
        if (job.at > now) continue;
        pending.delete(handle);
        job.run();
      }
    },
  };
}

describe('스낵바', () => {
  it('4초 서 있다가 걷힌다', () => {
    const time = clock();
    const store = createSnackbarStore(time.timers);
    store.show('보낸 요청을 거뒀어요');
    time.advance(SNACKBAR_SHOWN_MS - 1);
    expect(store.get()?.message).toBe('보낸 요청을 거뒀어요');
    time.advance(1);
    expect(store.get()).toBeNull();
  });

  it('한 번에 하나다 — 새 것이 오면 지금 것을 바꾸고 시계도 처음부터 간다', () => {
    const time = clock();
    const store = createSnackbarStore(time.timers);
    store.show('하나');
    time.advance(3000);
    store.show('둘');
    expect(store.get()?.message).toBe('둘');
    /* 앞 것의 시계가 남아 새것을 일찍 걷지 않는다 */
    time.advance(1500);
    expect(store.get()?.message).toBe('둘');
    time.advance(SNACKBAR_SHOWN_MS - 1500);
    expect(store.get()).toBeNull();
  });

  it('누르고 있는 동안은 시계가 서고, 떼면 남은 시간만 간다', () => {
    const time = clock();
    const store = createSnackbarStore(time.timers);
    store.show('하나');
    time.advance(1000);
    store.pause();
    time.advance(60_000);
    expect(store.get()?.message).toBe('하나');
    store.resume();
    time.advance(SNACKBAR_SHOWN_MS - 1000 - 1);
    expect(store.get()?.message).toBe('하나');
    time.advance(1);
    expect(store.get()).toBeNull();
  });

  it('단추를 누르면 그 일을 하고 걷힌다 — 걷힌 뒤에는 다시 안 돈다', () => {
    const time = clock();
    const store = createSnackbarStore(time.timers);
    const onAction = vi.fn();
    store.show('지나친 인연에 보관했어요', { label: '되돌리기', onAction });
    store.act();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(store.get()).toBeNull();
    store.act();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('지난 스낵바를 걷으라는 말은 새것을 걷지 않는다', () => {
    const time = clock();
    const store = createSnackbarStore(time.timers);
    const first = store.show('하나');
    store.show('둘');
    store.dismiss(first);
    expect(store.get()?.message).toBe('둘');
  });

  it('바뀔 때마다 듣는 쪽에 알린다', () => {
    const time = clock();
    const store = createSnackbarStore(time.timers);
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    store.show('하나');
    time.advance(SNACKBAR_SHOWN_MS);
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    store.show('둘');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('한 문장이면 끝 마침표를 떼고, 두 문장 이상이면 그대로 둔다(SEED Snackbar 「마침표는 문장 수에 따라」)', () => {
    const store = createSnackbarStore(clock().timers);
    store.show('보낸 요청을 거뒀어요.');
    expect(store.get()?.message).toBe('보낸 요청을 거뒀어요');
    expect(snackbarMessage('7일 동안 답이 없어 요청이 만료됐어요. 잡고 있던 풀이권은 돌아왔어요.')).toBe(
      '7일 동안 답이 없어 요청이 만료됐어요. 잡고 있던 풀이권은 돌아왔어요.',
    );
    expect(snackbarMessage('저장했어요')).toBe('저장했어요');
  });
});
