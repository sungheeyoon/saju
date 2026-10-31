import { describe, expect, it } from 'vitest';

import { UNREACHABLE_NOTE, askDoor } from './door-answer';
import { afterPress, initialFlow, readingFlow } from './reading-flow';

const unavailable = { ok: false, refused: { refused: 'unavailable', message: UNREACHABLE_NOTE } };
const reply = (status: number, body: unknown) => () => Promise.resolve(new Response(JSON.stringify(body), { status }));
const never = () => Promise.reject(new Error('보내지 않아야 한다'));

describe('askDoor', () => {
  it('세션 저장소가 던지면 까닭으로 답한다', async () => {
    expect(await askDoor(() => Promise.reject(new Error('저장소')), never)).toEqual(unavailable);
  });

  it('보내기가 던져도, 본문이 JSON 이 아니어도 같은 까닭이다', async () => {
    expect(await askDoor(() => Promise.resolve('t'), never)).toEqual(unavailable);
    expect(await askDoor(() => Promise.resolve('t'), () => Promise.resolve(new Response('<html>')))).toEqual(unavailable);
  });

  it('토큰이 없으면 보내지 않고 다시 로그인이다', async () => {
    expect(await askDoor(() => Promise.resolve(undefined), never)).toEqual({ ok: false, refused: { refused: 'sign-in' } });
  });

  it('값과 거절은 그대로 옮긴다', async () => {
    expect(await askDoor(() => Promise.resolve('t'), reply(200, { a: 1 }))).toEqual({ ok: true, value: { a: 1 } });
    expect(await askDoor(() => Promise.resolve('t'), reply(403, { refused: 'signup' }))).toEqual({ ok: false, refused: { refused: 'signup' } });
  });

  it('저장소 실패의 답이 누름을 실패 안내로 끝내고, 다시 누를 수 있다', async () => {
    const answer = await askDoor(() => Promise.reject(new Error('저장소')), never);
    if (answer.ok || answer.refused.refused !== 'unavailable') throw new Error('unavailable 이어야 한다');

    const pressed = readingFlow(initialFlow({ running: false, failed: false, hasReading: false }), { type: 'press' });
    expect(pressed.phase).toBe('loading');

    const { event } = afterPress({ kind: 'refused', message: answer.refused.message }, null);
    if (event === null) throw new Error('누름이 끝나야 한다');
    const failed = readingFlow(pressed, event);
    expect(failed.phase).not.toBe('loading');
    expect(failed.failure).toBe(UNREACHABLE_NOTE);

    expect(readingFlow(failed, { type: 'press' }).phase).toBe('loading');
  });
});
