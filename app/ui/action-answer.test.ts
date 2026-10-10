import { redirect } from 'next/navigation';
import { describe, expect, it } from 'vitest';

import { ACTION_UNREACHED_NOTE, actionAnswer } from './action-answer';

describe('actionAnswer', () => {
  it('액션이 값으로 답하면 그 값을 그대로 낸다 — 실패 값도', async () => {
    await expect(actionAnswer(Promise.resolve({ ok: true, id: 'p-1' }))).resolves.toEqual({ ok: true, id: 'p-1' });
    await expect(actionAnswer(Promise.resolve({ ok: false, message: '이미 사용 중인 닉네임입니다.' }))).resolves.toEqual({
      ok: false,
      message: '이미 사용 중인 닉네임입니다.',
    });
  });

  it('부름이 던지면 원문 대신 우리 문장 하나로 실패 값을 낸다', async () => {
    const answer = await actionAnswer(Promise.reject(new Error('Failed to find Server Action "abc"')));
    expect(answer).toEqual({ ok: false, message: ACTION_UNREACHED_NOTE });
  });

  it('실패 모양이 다른 액션은 부르는 쪽이 지은 모양으로 낸다', async () => {
    type Opened = { ok: true } | { ok: false; kind: 'failed'; message: string };
    const call: Promise<Opened> = Promise.reject(new TypeError('Failed to fetch'));
    await expect(actionAnswer(call, (message) => ({ ok: false, kind: 'failed', message }) as const)).resolves.toEqual({
      ok: false,
      kind: 'failed',
      message: ACTION_UNREACHED_NOTE,
    });
  });

  it('Next 의 이동(redirect)은 받지 않고 다시 던진다 — 화면이 옮겨 가야 한다', async () => {
    let thrown: unknown;
    try {
      redirect('/me');
    } catch (error) {
      thrown = error;
    }
    await expect(actionAnswer(Promise.reject(thrown))).rejects.toBe(thrown);
  });
});
