import type { SupabaseClient } from '@supabase/supabase-js';

import { rpcArgs, type Database } from '@/src/lib/db';

import { dbFailure, read, unread, type SkippableRead } from '../../db-error';
import { orderStatusOf, type OrderStatus } from './order-status';

/**
 * **풀이권 상품 화면이 읽는 문 둘** (G-21, ADR 0171).
 *
 * 판매는 닫혀 있다(`reading_sale_is_open()` = false). 카드사 심사 계정만 판매가 닫힌 채로 주문을 연다 — 그 판정은 DB 의
 * `reading_sale_is_open_for` 하나이고, 화면이 묻는 `my_reading_sale_is_open` 과 주문을 여는 `open_reading_order` 가 같은 판정을
 * 지난다. 화면이 다시 판정하지 않는다.
 */

/**
 * 이 사람에게 판매가 열렸는가.
 *
 * @returns **부속 정보다** — 못 읽으면 값으로 말하고 화면은 가격만 세운다(결제 단추를 안 세운다 — 닫힌 쪽으로 기운다)
 */
export async function mySaleIsOpen(client: SupabaseClient<Database>): Promise<SkippableRead<boolean>> {
  const { data, error } = await client.rpc('my_reading_sale_is_open');
  if (error) return unread(error, 'my_reading_sale_is_open');
  return read(data === true);
}

/** `status` 는 모르는 값이면 `null` 이다(`orderStatusOf`) */
export type MyOrder = { readonly status: OrderStatus | null; readonly credits: number; readonly amount: number };

/**
 * 내 주문 하나 — 결제 뒤 화면의 본체.
 *
 * @returns 없거나 남의 주문이면 `null`
 * @throws 못 읽으면 `dbFailure`
 */
export async function myOrder(client: SupabaseClient<Database>, orderId: string): Promise<MyOrder | null> {
  const { data, error } = await client.rpc('my_reading_order', rpcArgs<'my_reading_order'>({ p_order_id: orderId }));
  if (error) throw dbFailure(error, 'my_reading_order');
  const row = (data ?? [])[0];
  return row === undefined ? null : { status: orderStatusOf(row.status), credits: row.bundle_credits, amount: row.amount };
}
