import { describe, expect, it } from 'vitest';

import { verifyAll, verifyRow } from './photo-verify.mjs';

const USER = '0f8b2f6e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

describe('scripts/photo-verify — 열쇠마다 두 벌이 있는가', () => {
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
