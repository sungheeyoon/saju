import { describe, expect, it } from 'vitest';

import type { SaveResult } from '../../save-result';
import { saveLatest } from './save-latest';

/** 손으로 끝내는 저장 — 부른 차례와 값을 적고, 끝은 시험이 정한다 */
function manualSave() {
  const calls: { value: string; finish: (result: SaveResult) => void }[] = [];
  const save = (value: string) =>
    new Promise<SaveResult>((finish) => {
      calls.push({ value, finish });
    });
  return { calls, save };
}

const settle = () => new Promise((done) => setTimeout(done, 0));

function harness(stored = 'any') {
  const { calls, save } = manualSave();
  const busy: boolean[] = [];
  const failed: { back: string; message: string }[] = [];
  const choose = saveLatest(stored, save, {
    busy: (now) => busy.push(now),
    failed: (back, message) => failed.push({ back, message }),
  });
  return { calls, busy, failed, choose };
}

describe('고르면 곧 저장하는 칸의 차례 (화면 점검 B16)', () => {
  it('고르면 곧 저장하고, 끝나면 바쁨을 내린다', async () => {
    const { calls, busy, choose } = harness();

    choose('male');
    expect(calls.map((one) => one.value)).toEqual(['male']);
    expect(busy).toEqual([true]);

    calls[0].finish({ ok: true });
    await settle();
    expect(busy).toEqual([true, false]);
  });

  it('이미 든 값을 다시 고르면 부르지 않는다', () => {
    const { calls, choose } = harness('any');

    choose('any');
    expect(calls).toEqual([]);
  });

  /** 두 저장을 나란히 보내면 늦게 떠난 것이 먼저 닿아 서버에 앞 값이 남을 수 있다 */
  it('가는 동안 고른 값은 나란히 안 가고, 마지막 하나만 앞 저장 뒤에 간다', async () => {
    const { calls, busy, choose } = harness('any');

    choose('male');
    choose('female');
    choose('any');
    choose('female');
    expect(calls.map((one) => one.value)).toEqual(['male']);

    calls[0].finish({ ok: true });
    await settle();
    expect(calls.map((one) => one.value)).toEqual(['male', 'female']);

    calls[1].finish({ ok: true });
    await settle();
    expect(calls).toHaveLength(2);
    expect(busy).toEqual([true, false]);
  });

  it('가는 동안 원래 값으로 돌아오면 그것도 마지막 값이라 보낸다', async () => {
    const { calls, choose } = harness('any');

    choose('male');
    choose('any');
    calls[0].finish({ ok: true });
    await settle();
    expect(calls.map((one) => one.value)).toEqual(['male', 'any']);
  });

  it('가는 값과 같은 값을 다시 고르면 한 번만 간다', async () => {
    const { calls, choose } = harness('any');

    choose('male');
    choose('male');
    calls[0].finish({ ok: true });
    await settle();
    expect(calls).toHaveLength(1);
  });

  it('실패하면 서버가 든 마지막 값과 까닭을 돌려주고, 남겨 둔 값은 버린다', async () => {
    const { calls, busy, failed, choose } = harness('any');

    choose('male');
    calls[0].finish({ ok: true });
    await settle();

    choose('female');
    choose('any');
    calls[1].finish({ ok: false, message: '잠시 뒤 다시 시도해 주세요.' });
    await settle();

    expect(failed).toEqual([{ back: 'male', message: '잠시 뒤 다시 시도해 주세요.' }]);
    expect(calls).toHaveLength(2);
    expect(busy.at(-1)).toBe(false);

    /* 실패 뒤에도 다시 고를 수 있다 — 든 값은 앞서 저장된 것이다 */
    choose('male');
    expect(calls).toHaveLength(2);
    choose('female');
    expect(calls.map((one) => one.value)).toEqual(['male', 'female', 'female']);
  });
});
