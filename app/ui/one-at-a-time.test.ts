import { describe, expect, it } from 'vitest';

import { oneAtATime } from './one-at-a-time';

describe('중복 클릭', () => {
  it('처리 중에 다시 누른 것은 버리고, 끝나면 다시 받는다', async () => {
    const guard = oneAtATime();
    let calls = 0;
    let finish: () => void = () => {};
    const work = () =>
      new Promise<void>((resolve) => {
        calls += 1;
        finish = resolve;
      });

    expect(guard.run(work)).toBe(true);
    expect(guard.run(work)).toBe(false);
    expect(guard.run(work)).toBe(false);
    expect(calls).toBe(1);

    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(guard.run(work)).toBe(true);
    expect(calls).toBe(2);
  });

  it('실패해도 자물쇠가 풀린다', async () => {
    const guard = oneAtATime();
    expect(guard.run(() => Promise.reject(new Error('x')))).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(guard.run(async () => {})).toBe(true);
  });
});
