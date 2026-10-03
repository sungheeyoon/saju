import { describe, expect, it, vi } from 'vitest';

import type { TasteClaimResult } from '@/src/lib/reading/taste-visit';

import {
  carriesTaste,
  claimCarriedTaste,
  dropCarriedTaste,
  skipCarriedTaste,
  takeTasteArrival,
  type TabStorage,
} from './carried-taste';
import { TASTE_ARRIVAL_KEY, TASTE_SESSION_KEY } from './reading-draft';

/**
 * **세션 id 는 답이 났을 때만 지운다**(ADR 0143 「덧」). 앞서는 귀속을 부르기 전에 id 를 지우고 실패를 삼켜, 순간 장애 하나에
 * 다시 붙일 길이 사라졌다. 탭 저장소를 가짜로 넣어 무엇이 남는지 본다.
 */

const SESSION = '11111111-1111-4111-8111-111111111111';

function tab(initial: Record<string, string> = {}): TabStorage & { items: Map<string, string> } {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

const answers = (...results: TasteClaimResult[]) => {
  const called: string[] = [];
  const claim = async (sessionId: string) => {
    called.push(sessionId);
    return { result: results.shift() ?? 'terminal' };
  };
  return { claim, called };
};

describe('들고 온 세션을 붙인다', () => {
  it('들고 온 것이 없으면 묻지 않는다', async () => {
    const storage = tab();
    const { claim, called } = answers('claimed');
    expect(await claimCarriedTaste(() => storage, claim)).toBe('none');
    expect(called).toEqual([]);
  });

  it('답이 안 났으면 id 가 남고, 다시 시도하면 그 id 로 붙는다', async () => {
    const storage = tab({ [TASTE_SESSION_KEY]: SESSION });
    const { claim, called } = answers('retryable', 'claimed');

    expect(await claimCarriedTaste(() => storage, claim)).toBe('retryable');
    expect(storage.items.get(TASTE_SESSION_KEY)).toBe(SESSION);
    expect(storage.items.has(TASTE_ARRIVAL_KEY)).toBe(false);

    expect(await claimCarriedTaste(() => storage, claim)).toBe('claimed');
    expect(called).toEqual([SESSION, SESSION]);
    expect(storage.items.has(TASTE_SESSION_KEY)).toBe(false);
    expect(storage.items.get(TASTE_ARRIVAL_KEY)).toBe('1');
  });

  it('액션이 닿지 않아 던져도 답이 안 난 것이다 — id 가 남는다', async () => {
    const storage = tab({ [TASTE_SESSION_KEY]: SESSION });
    const claim = async () => Promise.reject(new Error('network'));
    expect(await claimCarriedTaste(() => storage, claim)).toBe('retryable');
    expect(storage.items.get(TASTE_SESSION_KEY)).toBe(SESSION);
  });

  it('`terminal` 이면 id 를 지우고 도착 표는 안 세운다 — 보통 흐름이다', async () => {
    const storage = tab({ [TASTE_SESSION_KEY]: SESSION });
    const { claim } = answers('terminal');
    expect(await claimCarriedTaste(() => storage, claim)).toBe('terminal');
    expect(storage.items.size).toBe(0);
  });

  it('저장소가 막혔으면 들고 온 것이 없는 것과 같다', async () => {
    const { claim, called } = answers('claimed');
    const blocked = () => {
      throw new Error('SecurityError');
    };
    expect(await claimCarriedTaste(blocked, claim)).toBe('none');
    expect(called).toEqual([]);
    expect(takeTasteArrival(blocked)).toBe(false);
    expect(() => dropCarriedTaste(blocked)).not.toThrow();
  });

  it('「다른 사람의 사주예요」면 id 를 버린다', () => {
    const storage = tab({ [TASTE_SESSION_KEY]: SESSION });
    dropCarriedTaste(() => storage);
    expect(storage.items.has(TASTE_SESSION_KEY)).toBe(false);
  });

  /**
   * **탈출구는 서버의 귀속 표까지 걷는다**(ADR 0143 「덧」). `retryable` 은 앞서 붙은 표를 건드리지 않으므로, 탭만 지우면 내 사주풀이의
   * 다음 누름이 그대로 이었다.
   */
  it('「전체 풀이만 보기」는 id 를 버리고 서버의 표도 걷는다', async () => {
    const storage = tab({ [TASTE_SESSION_KEY]: SESSION });
    const forget = vi.fn(async () => undefined);
    await skipCarriedTaste(() => storage, forget);
    expect(storage.items.has(TASTE_SESSION_KEY)).toBe(false);
    expect(forget).toHaveBeenCalledTimes(1);
  });

  it('표를 걷는 액션이 닿지 않아도 탈출구는 막히지 않는다', async () => {
    const storage = tab({ [TASTE_SESSION_KEY]: SESSION });
    await expect(skipCarriedTaste(() => storage, async () => Promise.reject(new Error('network')))).resolves.toBeUndefined();
    expect(storage.items.has(TASTE_SESSION_KEY)).toBe(false);
  });
});

describe('새로고침한 탭이 붙이지 못한 세션을 들고 있는가', () => {
  it('답이 안 났던 탭은 id 를 들고 있다 — 다시 붙일 수 있다', async () => {
    const storage = tab({ [TASTE_SESSION_KEY]: SESSION });
    const { claim } = answers('retryable', 'claimed');
    expect(await claimCarriedTaste(() => storage, claim)).toBe('retryable');
    /* 새로고침 — 화면의 상태는 사라지고 탭의 id 는 남는다 */
    expect(carriesTaste(() => storage)).toBe(true);
    expect(await claimCarriedTaste(() => storage, claim)).toBe('claimed');
    expect(carriesTaste(() => storage)).toBe(false);
    expect(storage.items.get(TASTE_ARRIVAL_KEY)).toBe('1');
  });

  it('답이 났거나 들고 온 것이 없거나 저장소가 막혔으면 아니다', async () => {
    const storage = tab({ [TASTE_SESSION_KEY]: SESSION });
    await claimCarriedTaste(() => storage, answers('terminal').claim);
    expect(carriesTaste(() => storage)).toBe(false);
    expect(carriesTaste(() => tab())).toBe(false);
    expect(
      carriesTaste(() => {
        throw new Error('SecurityError');
      }),
    ).toBe(false);
  });
});

describe('도착 표는 한 번만 참이다', () => {
  it('읽으면 지워진다 — 새로고침 · 뒤로가기에서는 거짓이다', () => {
    const storage = tab({ [TASTE_ARRIVAL_KEY]: '1' });
    expect(takeTasteArrival(() => storage)).toBe(true);
    expect(takeTasteArrival(() => storage)).toBe(false);
  });
});
