import { redirect } from 'next/navigation';
import { describe, expect, it } from 'vitest';

import { ACTION_UNREACHED_NOTE, actionAnswer, afterFailure, isUnreached } from './action-answer';

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
    expect(answer).toEqual({ ok: false, message: ACTION_UNREACHED_NOTE, unreached: true });
    expect(isUnreached(answer)).toBe(true);
  });

  it('답을 못 받은 실패는 표지로 가른다 — 액션이 같은 문장으로 거절해도 거절이다', () => {
    expect(isUnreached({ ok: false, message: ACTION_UNREACHED_NOTE })).toBe(false);
    expect(isUnreached({ ok: true })).toBe(false);
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

describe('실패 뒤의 고정본', () => {
  it('답을 못 받아 결과를 모르면 고정본(요청 번호)을 지킨다 — 같은 값의 재시도가 같은 요청으로 간다', async () => {
    const answer = await actionAnswer(Promise.reject(new TypeError('Failed to fetch')));
    if (answer.ok) throw new Error('실패여야 한다');
    expect(afterFailure(answer)).toBe('keep');
  });

  it('서버가 분명히 거절하면(버전 충돌 · 회수할 수 있는 수) 버린다 — 다음 누름은 새 버전 · 새 요청 번호로 새 확인을 연다', () => {
    expect(afterFailure({ ok: false, message: '그 사이 이 회원의 무상 풀이권이 바뀌었습니다. 새로 읽고 다시 확인해 주세요.' })).toBe('discard');
    expect(afterFailure({ ok: false, message: '회수할 수 있는 지급분보다 많습니다 — 지금 0장입니다.' })).toBe('discard');
  });
});
