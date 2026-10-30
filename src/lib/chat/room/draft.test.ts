import { describe, expect, it } from 'vitest';

import { dropDraft, readDraft, writeDraft } from './draft';

const tab = () => {
  const items = new Map<string, string>();
  return {
    items,
    storage: () => ({
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    }),
  };
};

const blocked = () => {
  throw new Error('SecurityError');
};

describe('방마다 쓰던 글', () => {
  it('방마다 따로 남고 다시 읽힌다', () => {
    const { storage } = tab();
    writeDraft(storage, 'a', '안녕하세요');
    writeDraft(storage, 'b', '다른 방');
    expect(readDraft(storage, 'a')).toBe('안녕하세요');
    expect(readDraft(storage, 'b')).toBe('다른 방');
    expect(readDraft(storage, 'c')).toBe('');
  });

  it('빈 칸은 적지 않고 지운다 — 보낸 뒤 · 닫힌 방', () => {
    const { storage, items } = tab();
    writeDraft(storage, 'a', '쓰던 글');
    writeDraft(storage, 'a', '');
    expect(items.size).toBe(0);
    writeDraft(storage, 'a', '쓰던 글');
    dropDraft(storage, 'a');
    expect(items.size).toBe(0);
  });

  it('저장소가 막힌 창에서도 던지지 않는다', () => {
    expect(() => writeDraft(blocked, 'a', '글')).not.toThrow();
    expect(readDraft(blocked, 'a')).toBe('');
  });
});
