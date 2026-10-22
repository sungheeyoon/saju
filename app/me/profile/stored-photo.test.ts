import { afterEach, describe, expect, it, vi } from 'vitest';

import { memoryPhotoStore } from '../photo/store';
import { STORE_FAILED, storePhoto, type Answer, type StoredPhotoDoors } from './stored-photo';

const KEY = 'photos/0f8b2f6e-1c2d-4e5f-8a9b-0c1d2e3f4a5b/7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918';

/** WebP 확장 머리(VP8X) — 크기만 든 가짜 그림 */
function webp(width: number, height: number): Uint8Array {
  const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
  const text = (s: string) => [...s].map((c) => c.charCodeAt(0));
  return Uint8Array.from([...text('RIFF'), 0, 0, 0, 0, ...text('WEBP'), ...text('VP8X'), 10, 0, 0, 0, 0, 0, 0, 0,
    ...le24(width - 1), ...le24(height - 1)]);
}

const variants = { card: webp(360, 480), large: webp(1080, 1440) };

/** 가짜 DB 문 — 받은 표 · 적은 열쇠 · 버린 표를 센다 */
function fakeDoors(over: Partial<{ begin: Answer<string>; save: Answer<number>; saveThrows: boolean; dropThrows: boolean }> = {}) {
  const log = { begun: 0, saved: [] as string[], dropped: [] as string[] };
  const doors: StoredPhotoDoors<number> = {
    begin: async () => {
      log.begun += 1;
      return over.begin ?? { ok: true, value: KEY };
    },
    save: async (key) => {
      if (over.saveThrows) throw new Error('network');
      if (over.save && !over.save.ok) return over.save;
      log.saved.push(key);
      return over.save ?? { ok: true, value: 3 };
    },
    drop: async (key) => {
      if (over.dropThrows) throw new Error('drop failed');
      log.dropped.push(key);
    },
  };
  return { doors, log };
}

afterEach(() => vi.restoreAllMocks());

describe('storePhoto — 표를 받고, 두 벌을 쓰고, DB 에 적는다', () => {
  it('성공하면 두 벌이 열쇠 아래 서고 DB 가 그 열쇠를 적는다 — 버린 표가 없다', async () => {
    const { store, objects } = memoryPhotoStore();
    const { doors, log } = fakeDoors();

    await expect(storePhoto(store, doors, variants)).resolves.toEqual({ ok: true, value: 3 });
    expect([...objects.keys()].sort()).toEqual([`${KEY}/card`, `${KEY}/large`]);
    expect(objects.get(`${KEY}/large`)?.contentType).toBe('image/webp');
    expect(log.saved).toEqual([KEY]);
    expect(log.dropped).toEqual([]);
  });

  it('두 벌이 틀리면 DB 에도 저장소에도 안 닿는다', async () => {
    const { store, objects } = memoryPhotoStore();
    const { doors, log } = fakeDoors();

    const answer = await storePhoto(store, doors, { card: webp(480, 480), large: webp(1080, 1440) });
    expect(answer.ok).toBe(false);
    expect(log.begun).toBe(0);
    expect(objects.size).toBe(0);
  });

  it('DB 가 표를 안 주면(하루 한도) 저장소에 안 쓰고 그 문장을 낸다', async () => {
    const { store, objects } = memoryPhotoStore();
    const { doors } = fakeDoors({ begin: { ok: false, message: '오늘은 사진을 더 올릴 수 없습니다. 내일 다시 올려 주세요.' } });

    await expect(storePhoto(store, doors, variants)).resolves.toEqual({
      ok: false,
      message: '오늘은 사진을 더 올릴 수 없습니다. 내일 다시 올려 주세요.',
    });
    expect(objects.size).toBe(0);
  });

  it('한 벌을 못 쓰면 DB 에 안 적고 표를 지울 줄로 넘긴다 — 쓴 벌은 청소기가 지운다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store } = memoryPhotoStore({ put: new Set([`${KEY}/large`]) });
    const { doors, log } = fakeDoors();

    await expect(storePhoto(store, doors, variants)).resolves.toEqual({ ok: false, message: STORE_FAILED });
    expect(log.saved).toEqual([]);
    expect(log.dropped).toEqual([KEY]);
  });

  it('DB 가 거절하면(여섯 장 · 낡은 누름) 표를 지울 줄로 넘기고 DB 의 문장을 낸다', async () => {
    const { store } = memoryPhotoStore();
    const { doors, log } = fakeDoors({ save: { ok: false, message: '사진은 6장까지입니다.' } });

    await expect(storePhoto(store, doors, variants)).resolves.toEqual({ ok: false, message: '사진은 6장까지입니다.' });
    expect(log.dropped).toEqual([KEY]);
  });

  it('DB 는 적었는데 응답만 끊겨도 보이는 사진의 바이트를 지우지 않는다 — 표가 걷혀 넘기기가 빈손이다', async () => {
    const { store, objects } = memoryPhotoStore();
    const remove = vi.spyOn(store, 'remove');
    const { doors, log } = fakeDoors({ saveThrows: true });

    await expect(storePhoto(store, doors, variants)).rejects.toThrow('network');
    expect(remove).not.toHaveBeenCalled();
    expect(objects.size).toBe(2);
    expect(log.dropped).toEqual([KEY]);
  });

  it('표 넘기기가 실패해도 던지지 않는다 — 표가 남아 청소기가 한 시간 뒤 옮긴다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store } = memoryPhotoStore();
    const { doors } = fakeDoors({ save: { ok: false, message: '사진은 6장까지입니다.' }, dropThrows: true });

    await expect(storePhoto(store, doors, variants)).resolves.toEqual({ ok: false, message: '사진은 6장까지입니다.' });
  });

  it('DB 가 낸 열쇠가 모양 밖이면 저장소에 안 쓴다', async () => {
    const { store, objects } = memoryPhotoStore();
    const { doors, log } = fakeDoors({ begin: { ok: true, value: 'photos/../escape' } });

    await expect(storePhoto(store, doors, variants)).resolves.toEqual({ ok: false, message: STORE_FAILED });
    expect(objects.size).toBe(0);
    expect(log.dropped).toEqual(['photos/../escape']);
  });
});
