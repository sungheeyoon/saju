import { describe, expect, it } from 'vitest';

import type { TasteClaimResult } from '@/src/lib/reading/taste-visit';

import { claimCarriedTaste, dropCarriedTaste, takeTasteArrival, type TabStorage } from './carried-taste';
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

  it('이어 보지 않고 계속하면 id 를 버린다', () => {
    const storage = tab({ [TASTE_SESSION_KEY]: SESSION });
    dropCarriedTaste(() => storage);
    expect(storage.items.has(TASTE_SESSION_KEY)).toBe(false);
  });
});

describe('도착 표는 한 번만 참이다', () => {
  it('읽으면 지워진다 — 새로고침 · 뒤로가기에서는 거짓이다', () => {
    const storage = tab({ [TASTE_ARRIVAL_KEY]: '1' });
    expect(takeTasteArrival(() => storage)).toBe(true);
    expect(takeTasteArrival(() => storage)).toBe(false);
  });
});
