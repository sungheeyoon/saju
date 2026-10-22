import { describe, expect, it } from 'vitest';

import { memoryPhotoStore, type PhotoStore } from '../../../me/photo/store';
import { SWEEP_BATCH, sweepOnce, type TrashLedger } from './sweep';

const key = (n: number) => `photos/0f8b2f6e-1c2d-4e5f-8a9b-0c1d2e3f4a5b/00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const bytes = Uint8Array.from([1, 2, 3]);

/** 가짜 장부 — 지울 줄을 들고, 정리한 결과를 적는다. 못 지운 줄은 이번 실행에 다시 안 낸다(다음 차례 시각) */
function fakeLedger(trash: string[], tickets = 0) {
  const settled: { deleted: string[]; failed: string[]; errorClass: string | null }[] = [];
  const later = new Set<string>();
  const ledger: TrashLedger = {
    sweepTickets: async () => tickets,
    batch: async (limit) => trash.filter((k) => !later.has(k)).slice(0, limit).map((object_key) => ({ object_key })),
    settle: async (deleted, failed, errorClass) => {
      settled.push({ deleted: [...deleted], failed: [...failed], errorClass });
      for (const k of deleted) trash.splice(trash.indexOf(k), 1);
      for (const k of failed) later.add(k);
      return false;
    },
  };
  return { ledger, settled };
}

async function filled(store: PhotoStore, keys: string[]) {
  for (const k of keys) {
    await store.put(`${k}/card`, bytes, 'image/webp');
    await store.put(`${k}/large`, bytes, 'image/webp');
  }
}

describe('sweepOnce — 지울 줄을 저장소에서 지운다', () => {
  it('열쇠마다 두 벌을 지우고 그 열쇠를 걷는다 · 남은 표의 수를 낸다', async () => {
    const { store, objects } = memoryPhotoStore();
    await filled(store, [key(1), key(2)]);
    await store.put('photos/keep/large', bytes, 'image/webp');
    const { ledger, settled } = fakeLedger([key(1), key(2)], 3);

    const result = await sweepOnce(ledger, store);

    expect(result).toEqual({ ticketsMoved: 3, deleted: 2, failed: 0, errorClass: null, alerted: false });
    expect([...objects.keys()]).toEqual(['photos/keep/large']);
    expect(settled).toEqual([{ deleted: [key(1), key(2)], failed: [], errorClass: null }]);
  });

  it('이미 없는 객체(쓰다 만 올리기)를 지우는 것은 성공이다', async () => {
    const { store } = memoryPhotoStore();
    const { ledger, settled } = fakeLedger([key(3)]);

    await expect(sweepOnce(ledger, store)).resolves.toMatchObject({ deleted: 1, failed: 0 });
    expect(settled[0].deleted).toEqual([key(3)]);
  });

  it('한 벌이라도 못 지우면 그 열쇠는 못 지운 것이다 — 분류와 함께 적는다', async () => {
    const { store, objects } = memoryPhotoStore({ remove: new Set([`${key(5)}/large`]) });
    await filled(store, [key(4), key(5)]);
    const { ledger, settled } = fakeLedger([key(4), key(5)]);

    const result = await sweepOnce(ledger, store);

    expect(result).toMatchObject({ deleted: 1, failed: 1, errorClass: 'delete:partial' });
    expect(settled).toEqual([{ deleted: [key(4)], failed: [key(5)], errorClass: 'delete:partial' }]);
    expect(objects.has(`${key(5)}/large`)).toBe(true);
  });

  it('저장소 부름이 통째로 던지면 그 차례의 열쇠를 전부 못 지운 것으로 적고 더 돌지 않는다', async () => {
    const store: PhotoStore = {
      put: async () => {},
      get: async () => null,
      remove: async () => {
        throw Object.assign(new Error('denied'), { name: 'AccessDenied' });
      },
    };
    const { ledger, settled } = fakeLedger([key(6), key(7)]);

    await expect(sweepOnce(ledger, store)).resolves.toMatchObject({ deleted: 0, failed: 2, errorClass: 'delete:accessdenied' });
    expect(settled).toHaveLength(1);
  });

  it('밀린 날은 여러 차례를 돈다', async () => {
    const { store } = memoryPhotoStore();
    const many = Array.from({ length: SWEEP_BATCH + 5 }, (_, i) => key(100 + i));
    const { ledger, settled } = fakeLedger(many);

    await expect(sweepOnce(ledger, store)).resolves.toMatchObject({ deleted: SWEEP_BATCH + 5, failed: 0 });
    expect(settled).toHaveLength(2);
  });
});
