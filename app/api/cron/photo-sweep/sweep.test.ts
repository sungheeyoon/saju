import { describe, expect, it } from 'vitest';

import { memoryPhotoStore, type PhotoStore } from '../../../me/photo/store';
import { SWEEP_BATCH, SWEEP_BUSY, sweepOnce, type TrashLedger } from './sweep';

const key = (n: number) => `photos/0f8b2f6e-1c2d-4e5f-8a9b-0c1d2e3f4a5b/00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const bytes = Uint8Array.from([1, 2, 3]);

/**
 * 가짜 장부 — 지울 줄을 들고, 정리한 결과를 적는다. 못 지운 줄은 이번 실행에 다시 안 낸다(다음 차례 시각).
 *
 * 임대는 DB(`photo_sweep_begin` · `photo_sweep_finish`)처럼 한 자리다 — 쥔 실행이 있으면 `null`, 놓는 것은 쥔 실행만.
 */
function fakeLedger(trash: string[], tickets = 0, lease = { holder: null as string | null }) {
  const settled: { deleted: string[]; failed: string[]; errorClass: string | null }[] = [];
  const finished: { run: string; deleted: number; failed: number }[] = [];
  const later = new Set<string>();
  let runs = 0;
  const ledger: TrashLedger = {
    begin: async () => {
      if (lease.holder !== null) return null;
      runs += 1;
      lease.holder = `run-${runs}`;
      return lease.holder;
    },
    sweepTickets: async () => tickets,
    batch: async (limit) => trash.filter((k) => !later.has(k)).slice(0, limit).map((object_key) => ({ object_key })),
    settle: async (deleted, failed, errorClass) => {
      settled.push({ deleted: [...deleted], failed: [...failed], errorClass });
      for (const k of deleted) if (trash.includes(k)) trash.splice(trash.indexOf(k), 1);
      for (const k of failed) later.add(k);
      return false;
    },
    finish: async (run, deleted, failed) => {
      if (lease.holder !== run) return false;
      lease.holder = null;
      finished.push({ run, deleted, failed });
      return true;
    },
  };
  return { ledger, settled, finished, lease };
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

  it('밀린 때는 여러 차례를 돈다', async () => {
    const { store } = memoryPhotoStore();
    const many = Array.from({ length: SWEEP_BATCH + 5 }, (_, i) => key(100 + i));
    const { ledger, settled } = fakeLedger(many);

    await expect(sweepOnce(ledger, store)).resolves.toMatchObject({ deleted: SWEEP_BATCH + 5, failed: 0 });
    expect(settled).toHaveLength(2);
  });
});

describe('sweepOnce — 임대: 겹치면 하나만, 끝까지 돌면 놓으며 적는다', () => {
  it('끝까지 돌면 지운 수 · 못 지운 수와 함께 임대를 놓는다 — 못 지운 것이 있어도 끝까지 돈 실행이다', async () => {
    const { store } = memoryPhotoStore({ remove: new Set([`${key(9)}/card`]) });
    const { ledger, finished, lease } = fakeLedger([key(8), key(9)]);

    await sweepOnce(ledger, store);

    expect(finished).toEqual([{ run: 'run-1', deleted: 1, failed: 1 }]);
    expect(lease.holder).toBeNull();
  });

  it('다른 실행이 임대를 쥐고 있으면 DB 에도 저장소에도 안 닿고 「도는 중」이다', async () => {
    const { store, objects } = memoryPhotoStore();
    await filled(store, [key(10)]);
    const { ledger, settled, finished } = fakeLedger([key(10)], 2, { holder: 'someone-else' });

    await expect(sweepOnce(ledger, store)).resolves.toBe(SWEEP_BUSY);
    expect(settled).toEqual([]);
    expect(finished).toEqual([]);
    expect(objects.size).toBe(2);
  });

  it('pg_cron 과 Vercel 이 겹쳐 깨우면 한 실행만 지우고 다른 실행은 「도는 중」이다', async () => {
    const { store, objects } = memoryPhotoStore();
    await filled(store, [key(11), key(12)]);
    const lease = { holder: null as string | null };
    const trash = [key(11), key(12)];
    const hourly = fakeLedger(trash, 0, lease);
    const daily = fakeLedger(trash, 0, lease);

    const [first, second] = await Promise.all([sweepOnce(hourly.ledger, store), sweepOnce(daily.ledger, store)]);

    expect([first, second].filter((r) => r === SWEEP_BUSY)).toHaveLength(1);
    expect([first, second].find((r) => r !== SWEEP_BUSY)).toMatchObject({ deleted: 2, failed: 0 });
    expect(objects.size).toBe(0);
    expect(lease.holder).toBeNull();
  });

  it('도중에 DB 가 실패하면 놓지 않는다 — 임대는 저절로 풀리고, 끝난 시각이 안 적혀 감시가 본다', async () => {
    const { store } = memoryPhotoStore();
    const { ledger, finished, lease } = fakeLedger([key(13)]);
    const broken: TrashLedger = {
      ...ledger,
      batch: async () => {
        throw Object.assign(new Error('db down'), { code: '08006' });
      },
    };

    await expect(sweepOnce(broken, store)).rejects.toMatchObject({ code: '08006' });
    expect(finished).toEqual([]);
    expect(lease.holder).toBe('run-1');
  });
});
