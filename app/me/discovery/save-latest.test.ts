import { describe, expect, it } from 'vitest';

import type { SaveResult } from '../../save-result';
import { saveLatest } from './save-latest';

/** 손으로 끝내는 저장 — 부른 차례와 값을 적고, 끝은 시험이 정한다 */
function manualSave() {
  const calls: { value: string; finish: (result: SaveResult) => void; fail: (error: Error) => void }[] = [];
  const save = (value: string) =>
    new Promise<SaveResult>((finish, fail) => {
      calls.push({ value, finish, fail });
    });
  return { calls, save };
}

const UNEXPECTED = '잠시 뒤 다시 시도해 주세요.';

const settle = () => new Promise((done) => setTimeout(done, 0));

function harness(stored = 'any') {
  const { calls, save } = manualSave();
  const busy: boolean[] = [];
  const failed: { back: string; message: string }[] = [];
  let saved = 0;
  const choose = saveLatest(
    stored,
    save,
    {
      busy: (now) => busy.push(now),
      saved: () => {
        saved += 1;
      },
      failed: (back, message) => failed.push({ back, message }),
    },
    UNEXPECTED,
  );
  return { calls, busy, failed, saved: () => saved, choose };
}

describe('고르면 곧 저장하는 칸의 차례', () => {
  it('고르면 곧 저장하고, 끝나면 바쁨을 내린다', async () => {
    const { calls, busy, saved, choose } = harness();

    choose('male');
    expect(calls.map((one) => one.value)).toEqual(['male']);
    expect(busy).toEqual([true]);

    calls[0].finish({ ok: true });
    await settle();
    expect(busy).toEqual([true, false]);
    expect(saved()).toBe(1);
  });

  it('이미 든 값을 다시 고르면 부르지 않는다', () => {
    const { calls, choose } = harness('any');

    choose('any');
    expect(calls).toEqual([]);
  });

  /** 두 저장을 나란히 보내면 늦게 떠난 것이 먼저 닿아 서버에 앞 값이 남을 수 있다 */
  it('가는 동안 고른 값은 나란히 안 가고, 마지막 하나만 앞 저장 뒤에 간다', async () => {
    const { calls, busy, saved, choose } = harness('any');

    choose('male');
    choose('female');
    choose('any');
    choose('female');
    expect(calls.map((one) => one.value)).toEqual(['male']);

    calls[0].finish({ ok: true });
    await settle();
    expect(calls.map((one) => one.value)).toEqual(['male', 'female']);
    /* 앞 값만 저장된 때에는 「저장했다」고 하지 않는다 — 마지막 값이 아직 가는 중이다 */
    expect(saved()).toBe(0);

    calls[1].finish({ ok: true });
    await settle();
    expect(calls).toHaveLength(2);
    expect(busy).toEqual([true, false]);
    expect(saved()).toBe(1);
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
    const { calls, busy, failed, saved, choose } = harness('any');

    choose('male');
    calls[0].finish({ ok: true });
    await settle();
    expect(saved()).toBe(1);

    choose('female');
    choose('any');
    calls[1].finish({ ok: false, message: '잠시 뒤 다시 시도해 주세요.' });
    await settle();

    expect(failed).toEqual([{ back: 'male', message: '잠시 뒤 다시 시도해 주세요.' }]);
    expect(saved()).toBe(1);
    expect(calls).toHaveLength(2);
    expect(busy.at(-1)).toBe(false);

    /* 실패 뒤에도 다시 고를 수 있다 — 든 값은 앞서 저장된 것이다 */
    choose('male');
    expect(calls).toHaveLength(2);
    choose('female');
    expect(calls.map((one) => one.value)).toEqual(['male', 'female', 'female']);
  });

  /** 연결이 끊기면 문은 값 대신 던진다 — 저장 안 된 선택이 칸에 남고 아무 말도 없으면 사용자는 저장된 줄 안다 */
  it('저장이 던지면 서버가 든 마지막 값과 정해 둔 까닭을 돌려주고 다시 고를 수 있다', async () => {
    const { calls, busy, failed, saved, choose } = harness('any');

    choose('male');
    choose('female');
    calls[0].fail(new TypeError('Failed to fetch'));
    await settle();

    expect(failed).toEqual([{ back: 'any', message: UNEXPECTED }]);
    expect(saved()).toBe(0);
    expect(calls).toHaveLength(1);
    expect(busy).toEqual([true, false]);

    choose('female');
    expect(calls.map((one) => one.value)).toEqual(['male', 'female']);
  });
});
