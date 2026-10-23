import { variantKey } from '@/src/lib/profile';

import { storeErrorClassOf, type PhotoStore } from '../../../me/photo/store';

/**
 * 매시간의 사진 청소 — **남은 표를 지울 줄로, 지울 줄을 저장소에서 지운다**(G-120, `20261227090000` · `20261229090000`, ADR 0205).
 *
 * 지울 줄에 서는 것: 바꾸거나 지운 장 · 계정 삭제로 사라진 장 · 저장하지 못한 올리기의 객체. 열쇠 하나에 두 벌(`card` ·
 * `large`)이 있다 — 둘 다 지워야 그 열쇠를 지운 것이다. 없는 객체를 지우는 것은 성공이다(이미 지워진 · 쓰다 만 객체).
 *
 * 깨우는 쪽은 둘이다 — 매시간의 pg_cron(`wake_photo_sweep`)과 예비인 Vercel 의 하루 한 번. 겹치면 뒤 실행은 임대를 못 잡고
 * 아무것도 안 한다(`busy`). 결과를 DB 에 적는다(`photo_trash_settle`) — 지운 것은 걷고, 못 지운 것은 다음 매시 실행에 다시 두고,
 * 첫 실패부터 DB 가 운영 알림을 낸다. 끝까지 돌면 임대를 놓으며 그 시각을 적는다 — 「청소가 멈췄다」 감시의 기준이다.
 * DB 를 부르는 손은 밖에서 받는다 — 시험이 메모리 저장소로 이 차례를 잰다(`sweep.test.ts`).
 */

export type TrashLedger = {
  /** 임대를 잡는다 — 다른 실행이 쥐고 있으면 `null` */
  readonly begin: () => Promise<string | null>;
  readonly sweepTickets: () => Promise<number>;
  readonly batch: (limit: number) => Promise<readonly { readonly object_key: string }[]>;
  readonly settle: (deleted: readonly string[], failed: readonly string[], errorClass: string | null) => Promise<boolean>;
  /** 끝까지 돈 실행을 적고 임대를 놓는다 */
  readonly finish: (run: string, deleted: number, failed: number) => Promise<boolean>;
};

/** 한 번에 받는 열쇠 수 · 한 번 실행에 도는 차례 수 — 밀린 때가 있어도 한 번 실행이 끝나게 */
export const SWEEP_BATCH = 200;
const MAX_ROUNDS = 10;

export type SweepResult = {
  readonly ticketsMoved: number;
  readonly deleted: number;
  readonly failed: number;
  readonly errorClass: string | null;
  readonly alerted: boolean;
};

/** 다른 실행이 임대를 쥐고 있어 아무것도 안 했다 */
export const SWEEP_BUSY = 'busy';

export async function sweepOnce(ledger: TrashLedger, store: PhotoStore): Promise<SweepResult | typeof SWEEP_BUSY> {
  const run = await ledger.begin();
  if (run === null) return SWEEP_BUSY;

  const ticketsMoved = await ledger.sweepTickets();
  let deleted = 0;
  let failed = 0;
  let errorClass: string | null = null;
  let alerted = false;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const keys = (await ledger.batch(SWEEP_BATCH)).map((row) => row.object_key);
    if (keys.length === 0) break;

    const objects = keys.flatMap((key) => [variantKey(key, 'card'), variantKey(key, 'large')]);
    let missed: ReadonlySet<string>;
    try {
      missed = new Set((await store.remove(objects)).failed);
      if (missed.size > 0) errorClass ??= 'delete:partial';
    } catch (error) {
      missed = new Set(objects);
      errorClass = storeErrorClassOf('delete', error);
    }

    const gone = keys.filter((key) => !missed.has(variantKey(key, 'card')) && !missed.has(variantKey(key, 'large')));
    const left = keys.filter((key) => !gone.includes(key));
    alerted = (await ledger.settle(gone, left, left.length > 0 ? errorClass : null)) || alerted;
    deleted += gone.length;
    failed += left.length;

    /* 못 지운 것은 다음 매시 실행 전에는 다시 안 나온다 — 그래도 이 차례가 통째로 실패했으면 더 돌지 않는다 */
    if (gone.length === 0 || keys.length < SWEEP_BATCH) break;
  }

  await ledger.finish(run, deleted, failed);
  return { ticketsMoved, deleted, failed, errorClass, alerted };
}
