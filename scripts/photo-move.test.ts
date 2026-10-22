import { describe, expect, it } from 'vitest';

import { movePhotos } from './photo-move.mjs';
import { verifyAll, verifyRow } from './photo-verify.mjs';

const USER = '0f8b2f6e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

/** 가짜 DB — 바이트 줄을 들고, 판본이 맞으면 열쇠로 바꾼다. `changed` 의 자리는 그 사이 사람이 바꾼 장이다 */
function fakeDb(rows: { position: number; version: number; bytes: string }[], changed = new Set<number>()) {
  const live = rows.map((row) => ({ ...row, key: null as string | null }));
  let issued = 0;
  const trashed: string[] = [];
  return {
    live,
    trashed,
    db: {
      begin: async () => `photos/${USER}/00000000-0000-4000-8000-00000000000${(issued += 1)}`,
      toMove: async (limit: number) =>
        live
          .filter((row) => row.key === null)
          .slice(0, limit)
          .map((row) => ({
            user_id: USER,
            position: row.position,
            version: changed.has(row.position) ? row.version + 1 : row.version,
            content_type: 'image/webp',
            base64: Buffer.from(row.bytes).toString('base64'),
          })),
      moved: async (_user: string, position: number, version: number, key: string) => {
        const row = live.find((one) => one.position === position);
        if (row === undefined || row.key !== null || row.version !== version || changed.has(position)) {
          trashed.push(key);
          return false;
        }
        row.key = key;
        return true;
      },
    },
  };
}

describe('photo:move — 옛 사진을 저장소로', () => {
  it('DB 가 준 열쇠로 원본 바이트를 그대로 두 벌로 쓰고 적는다 — 다시 굽지 않는다', async () => {
    const { db, live } = fakeDb([{ position: 1, version: 10, bytes: 'one' }, { position: 2, version: 20, bytes: 'two' }]);
    const objects = new Map<string, string>();

    const result = await movePhotos(db, async (key, body) => void objects.set(key, Buffer.from(body).toString()));

    expect(result).toEqual({ moved: 2, skipped: 0 });
    expect(live.map((row) => row.key)).toEqual([
      `photos/${USER}/00000000-0000-4000-8000-000000000001`,
      `photos/${USER}/00000000-0000-4000-8000-000000000002`,
    ]);
    expect(objects.get(`photos/${USER}/00000000-0000-4000-8000-000000000001/card`)).toBe('one');
    expect(objects.get(`photos/${USER}/00000000-0000-4000-8000-000000000001/large`)).toBe('one');
  });

  it('그 사이 바뀐 장은 덮지 않고 건너뛰며, 끝없이 다시 받지 않는다', async () => {
    const { db, trashed } = fakeDb([{ position: 1, version: 10, bytes: 'one' }], new Set([1]));

    await expect(movePhotos(db, async () => {})).resolves.toEqual({ moved: 0, skipped: 1 });
    expect(trashed).toHaveLength(1);
  });

  it('저장소에 못 쓰면 DB 에 적기 전에 멈춘다', async () => {
    const { db, live } = fakeDb([{ position: 1, version: 10, bytes: 'one' }]);

    await expect(movePhotos(db, async () => { throw new Error('denied'); })).rejects.toThrow('denied');
    expect(live[0].key).toBeNull();
  });
});

describe('photo:verify — 열쇠마다 두 벌이 있는가', () => {
  const row = { object_key: `photos/${USER}/00000000-0000-4000-8000-000000000001`, content_type: 'image/webp' };

  it('두 벌이 있고 형식이 같으면 맞다', async () => {
    await expect(verifyRow(row, async () => ({ contentType: 'image/webp', length: 10 }))).resolves.toEqual([]);
  });

  it('없거나 비었거나 형식이 다르면 그 이름을 낸다', async () => {
    const problems = await verifyRow(row, async (key) =>
      key.endsWith('/card') ? null : { contentType: 'image/jpeg', length: 0 });
    expect(problems).toEqual(['card 가 없다', 'large 가 비었다', 'large 의 형식이 DB 와 다르다']);
  });

  it('열쇠 차례로 이어 받는다', async () => {
    const keys = Array.from({ length: 5 }, (_, i) => ({ object_key: `k${i}`, content_type: 'image/webp' }));
    const asked: string[] = [];
    const results = await verifyAll(
      async (after, limit) => {
        asked.push(after);
        return keys.filter((k) => k.object_key > after).slice(0, limit);
      },
      async () => ({ contentType: 'image/webp', length: 1 }),
      2,
    );
    expect(results).toHaveLength(5);
    expect(asked).toEqual(['', 'k1', 'k3']);
  });
});
