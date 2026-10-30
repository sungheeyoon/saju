import { afterEach, describe, expect, it, vi } from 'vitest';

import { bytesToText, sealedStorage, textToBytes, type SessionStore } from './sealed-session';

const KEY = 'sb-ref-auth-token';

const memory = () => {
  const values = new Map<string, string>();
  const store: SessionStore = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => void values.set(key, value),
    removeItem: async (key) => void values.delete(key),
  };
  return { values, store };
};

const setup = () => {
  const box = memory();
  const vault = memory();
  let made = 0;
  const cipher = {
    newKey: async () => `key${++made}`,
    seal: async (text: string, key: string) => `${key}|${[...text].reverse().join('')}`,
    open: async (sealed: string, key: string) => {
      const [used, body] = sealed.split('|');
      if (used !== key) throw new Error('bad key');
      return [...body].reverse().join('');
    },
  };
  return { box, vault, cipher, storage: sealedStorage({ box: box.store, vault: vault.store, cipher }), made: () => made };
};

afterEach(() => vi.restoreAllMocks());

describe('앱의 세션 저장소', () => {
  it('일반 저장소에는 암호문만, 키는 보안 저장소에만 있다', async () => {
    const { box, vault, storage } = setup();
    await storage.setItem(KEY, 'refresh-token');
    expect([...box.values.keys()]).toEqual([`${KEY}.sealed`]);
    expect([...box.values.values()].join()).not.toContain('refresh-token');
    expect([...vault.values.keys()]).toEqual([`${KEY}.key`]);
    expect(await storage.getItem(KEY)).toBe('refresh-token');
  });

  it('옛 평문 세션은 처음 읽을 때 옮기고 지운다', async () => {
    const { box, storage } = setup();
    box.values.set(KEY, 'old-session');
    expect(await storage.getItem(KEY)).toBe('old-session');
    expect(box.values.has(KEY)).toBe(false);
    expect(box.values.has(`${KEY}.sealed`)).toBe(true);
    expect(await storage.getItem(KEY)).toBe('old-session');
  });

  it('옮기지 못하면 평문을 지우지 않고 그 값으로 잇는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { box, vault, storage } = setup();
    box.values.set(KEY, 'old-session');
    vault.store.getItem = async () => {
      throw new Error('locked');
    };
    expect(await storage.getItem(KEY)).toBe('old-session');
    expect(box.values.get(KEY)).toBe('old-session');
  });

  it('쓰기가 실패하면 던지고 평문을 남기지 않는다', async () => {
    const { box, cipher, vault } = setup();
    const storage = sealedStorage({
      box: box.store,
      vault: vault.store,
      cipher: {
        ...cipher,
        seal: async () => {
          throw new Error('no');
        },
      },
    });
    await expect(storage.setItem(KEY, 'secret')).rejects.toThrow();
    expect([...box.values.values()].join()).not.toContain('secret');
  });

  it('보안 저장소 읽기가 실패하면 세션 없음으로 답하고 아무것도 안 지운다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { box, vault, storage } = setup();
    await storage.setItem(KEY, 'session');
    const before = [...box.values];
    vault.store.getItem = async () => {
      throw new Error('locked');
    };
    expect(await storage.getItem(KEY)).toBeNull();
    expect([...box.values]).toEqual(before);
    expect(vault.values.size).toBe(1);
  });

  it('동시에 써도 키는 하나다', async () => {
    const { storage, made } = setup();
    await Promise.all([storage.setItem(KEY, 'a'), storage.setItem(KEY, 'b')]);
    expect(made()).toBe(1);
    expect(['a', 'b']).toContain(await storage.getItem(KEY));
  });

  it('지우면 암호문 · 옛 평문 · 키가 모두 사라진다', async () => {
    const { box, vault, storage } = setup();
    await storage.setItem(KEY, 'session');
    box.values.set(KEY, 'old');
    await storage.removeItem(KEY);
    expect(box.values.size).toBe(0);
    expect(vault.values.size).toBe(0);
  });

  it('한글이 든 세션도 바이트를 오가며 그대로다', () => {
    const text = '{"name":"홍길동 😀"}';
    expect(bytesToText(textToBytes(text))).toBe(text);
  });
});
