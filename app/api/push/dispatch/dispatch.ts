import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';
import { PUSH_CLAIM_LIMIT, PUSH_SEND_CONCURRENCY, type SettleResult } from '@/src/lib/push';

import { recordDbFailure } from '../../../db-error';
import type { PushSender } from './send';

/** 한 묶음의 결과 — 배달 문의 기록에 남는다. 개인정보는 없다(수만 센다) */
export type DispatchSummary = {
  claimed: number;
  settled: Record<SettleResult, number>;
  /** `settle_push_delivery` 를 못 부른 줄 — 잠금이 풀리면 다음 깨움이 다시 집는다 */
  unsettled: number;
};

/**
 * **깨움 한 번에 한 묶음** — 기한이 된 배달 줄을 잠그고(`claim_push_deliveries`), 보내고, 닫는다.
 *
 * 남은 줄은 여기서 더 돌지 않는다. 다음 깨움(새 배달 줄의 `pg_net` · 1분 `pg_cron`)이 집는다 — 한 요청이 오래
 * 살면 함수 시간 한도에 걸려 보낸 것을 닫지 못한 채 끊긴다.
 *
 * 송신기가 없으면(`null`, VAPID 설정 안 됨) 보내지 않고 줄마다 `unconfigured` 로 닫는다 — DB 가 그 줄을 지우지
 * 않고 다시 기한을 세운다(ADR 0156 「VAPID 열쇠 · 배달 비밀이 없으면」).
 */
export async function dispatchPushBatch(
  db: SupabaseClient<Database>,
  sender: PushSender | null,
): Promise<DispatchSummary | null> {
  const { data, error } = await db.rpc('claim_push_deliveries', { p_limit: PUSH_CLAIM_LIMIT });
  if (error) {
    recordDbFailure(error, 'push dispatch: claim_push_deliveries');
    return null;
  }

  const rows = data ?? [];
  const summary: DispatchSummary = {
    claimed: rows.length,
    settled: { sent: 0, gone: 0, retry: 0, unconfigured: 0 },
    unsettled: 0,
  };

  await eachWithLimit(rows, PUSH_SEND_CONCURRENCY, async (row) => {
    const result: SettleResult =
      sender === null
        ? 'unconfigured'
        : await sender({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth }, row.match_id).catch(
            () => 'retry' as const,
          );

    const { error: notSettled } = await db.rpc('settle_push_delivery', {
      p_delivery_id: row.delivery_id,
      p_result: result,
    });
    if (notSettled) {
      // 뒤에서 받치는 쓰기를 못 했다 — 답은 그대로이고 다음 깨움이 그 줄을 다시 집는다
      console.error('push dispatch: settle_push_delivery', notSettled.code);
      summary.unsettled += 1;
      return;
    }
    summary.settled[result] += 1;
  });

  return summary;
}

/** 동시에 `limit` 개까지만 연다 — 줄의 차례는 지키지 않는다(방마다 줄이 하나라 차례가 뜻이 없다) */
async function eachWithLimit<T>(items: readonly T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await work(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}
