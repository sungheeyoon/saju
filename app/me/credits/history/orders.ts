import type { SupabaseClient } from '@supabase/supabase-js';

import { type Database } from '@/src/lib/db';
import { paidOrderOf, type PaidOrder } from '@/src/lib/reading/paid-order';

import { dbFailure } from '../../../db-error';

export type { PaidOrder };

/**
 * **결제 내역이 읽는 문** (G-21, ADR 0174) — 산 사람이 제 주문을 다시 본다.
 *
 * 문은 `my_reading_orders()` 하나다 — 부른 사람의 승인된 적 있는 주문만, 최근 결제부터. 남은 회차는 DB 가 센다(산 수 − 걷은 수 −
 * 쓴 것 − 살아 있는 예약). 그 줄을 화면의 말로 옮기는 일은 앱과 함께 쓴다(`src/lib/reading/paid-order.ts`).
 */

/**
 * 내 결제 내역 — 최근 결제부터.
 *
 * @returns 산 적이 없으면 `[]`
 * @throws 못 읽으면 `dbFailure` — 이 화면의 본체다
 */
export async function myPaidOrders(client: SupabaseClient<Database>): Promise<readonly PaidOrder[]> {
  const { data, error } = await client.rpc('my_reading_orders');
  if (error) throw dbFailure(error, 'my_reading_orders');
  return (data ?? []).map(paidOrderOf);
}
