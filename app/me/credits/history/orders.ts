import type { SupabaseClient } from '@supabase/supabase-js';

import { type Database } from '@/src/lib/db';
import { bundleOrderName, readingBundleValidUntil } from '@/src/lib/reading/bundle';

import { dbFailure } from '../../../db-error';
import { when } from '../../requests/when';

/**
 * **결제 내역이 읽는 문** (G-21, ADR 0174) — 산 사람이 제 주문을 다시 본다.
 *
 * 문은 `my_reading_orders()` 하나다 — 부른 사람의 승인된 적 있는 주문만, 최근 결제부터. 남은 회차는 DB 가 센다(산 수 − 걷은 수 −
 * 쓴 것 − 살아 있는 예약). 이 모듈은 그 줄을 화면의 말로 한 번 옮긴다.
 */

type Row = Database['public']['Functions']['my_reading_orders']['Returns'][number];

/** 결제 내역 한 줄 — 화면이 그대로 그린다 */
export type PaidOrder = {
  /** 환불을 신청할 때 알려 주는 번호 — 결제창 · PG 가 아는 가맹점 주문 번호(`rdo_…`) */
  readonly orderNumber: string;
  readonly product: string;
  readonly amount: number;
  readonly refundedAmount: number;
  readonly status: '결제 완료' | '부분 환불' | '전액 환불';
  readonly paidAt: string;
  readonly validUntil: string;
  readonly remaining: number;
};

const STATUS: Record<string, PaidOrder['status']> = {
  approved: '결제 완료',
  partially_refunded: '부분 환불',
  refunded: '전액 환불',
};

/** `2031-10-12` → 「2031년 10월 12일」 */
const koreanDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일`;
};

/**
 * DB 의 한 줄을 화면의 말로. 묶음이 선 주문만 오므로 상태는 승인 · 부분 환불 · 전액 환불 셋이다 — 모르는 값은 결제 완료로 읽는다
 * (묶음이 섰다는 것은 돈이 들어왔다는 것이다).
 */
export function paidOrderOf(row: Row): PaidOrder {
  return {
    orderNumber: row.provider_order_id,
    product: bundleOrderName(row.bundle_credits),
    amount: row.amount,
    refundedAmount: row.refunded_amount,
    status: STATUS[row.status] ?? '결제 완료',
    paidAt: when(row.paid_at),
    validUntil: koreanDate(readingBundleValidUntil(new Date(row.paid_at))),
    remaining: Math.max(0, row.remaining),
  };
}

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
