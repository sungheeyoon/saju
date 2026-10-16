import { rpcArgs, type RpcRow } from '@/src/lib/db';
import { readingBundleValidUntil, refundOwed } from '@/src/lib/reading/bundle';

import { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';
import { noteDenial } from '../denial';

/**
 * 주문 하나와 그 계정의 주문 전부, 그리고 진행 중인 환불이 **환불 셈의 입력으로 내려오는 문** (G-110 ②, ADR 0184).
 *
 * `operator_reading_refund_basis` 를 부른다 — 읽기 전에 풀린 예약을 정리하고, 읽을 때마다 접속기록에 `credits.refund_basis`
 * 한 줄(주문 id 만)을 남긴다(ADR 0106). 신고 화면의 문(`../reports/read.ts`)과 같은 규율이다: 운영자인지 여기서 안 묻고
 * 자료를 청해 **거절당하는 것으로 안다**(`42501`), 거절은 `noteDenial` 이 따로 적는다.
 *
 * 이메일 · 닉네임은 문이 안 내준다 — 주문은 번호로만 가리킨다(런북 「수동 환불」).
 *
 * 생성 타입은 반환 칸을 전부 `null` 이 아닌 것으로 적는다(`returns table` 의 한계). 승인 · 묶음 칸은 결제 전 주문에서 비므로
 * 여기서 한 번 `null` 로 받아 옮긴다.
 */

/** 운영자가 아니라고 DB 가 답했다 — `42501` */
export const DENIED = 'denied';

export type OrderLine = {
  readonly orderId: string;
  /** 가맹점 주문 번호(`rdo_…`) — 산 사람이 환불을 신청하며 알려 주는 번호 */
  readonly orderNumber: string;
  readonly status: string;
  readonly provider: string;
  /** PG 의 거래 번호 — 승인 때 선다 */
  readonly paymentId: string | null;
  readonly amount: number;
  readonly refundedAmount: number;
  readonly orderedAt: string;
  readonly approvedAt: string | null;
  /** 묶음 — 승인된 적 없는 주문이면 `null` */
  readonly bundle: {
    readonly credits: number;
    readonly refundedCredits: number;
    readonly used: number;
    /** 예약 중 — 풀릴 때까지 안 쓴 것이 아니다 */
    readonly reserved: number;
    /** 지금 걷을 수 있는 회차 — 쓴 것 · 예약 중 · 진행 중인 확보를 뺐다 */
    readonly unused: number;
    /** 유효기간이 끝나는 날(서울, `YYYY-MM-DD`, ADR 0173) */
    readonly validUntil: string;
  } | null;
};

/** 진행 중인 환불 — 확보한 회차 · 금액은 확정 · 준비 취소 전까지 이용자가 못 쓴다(ADR 0184) */
export type RefundHold = {
  readonly holdId: string;
  readonly credits: number;
  readonly amount: number;
  readonly reason: string;
  readonly heldAt: string;
  /** PG 의 거래 번호 — 콘솔에서 이 결제를 찾는다 */
  readonly paymentId: string | null;
  /** 취소 후 잔액 — 결제액 − 이미 돌려준 금액 − 이번 금액 */
  readonly remainingAmount: number;
};

export type RefundBasis = {
  /** 찾은 주문 */
  readonly asked: OrderLine;
  /** 같은 계정의 다른 주문 — 결제 시각 차례 */
  readonly others: readonly OrderLine[];
  /** 찾은 주문에 진행 중인 환불 — 없으면 `null` */
  readonly hold: RefundHold | null;
};

export const refundHoldOf = (row: RpcRow<'operator_reading_refund_hold'>): RefundHold => ({
  holdId: row.hold_id,
  credits: row.credits,
  amount: row.amount,
  reason: row.reason,
  heldAt: row.held_at,
  paymentId: row.provider_payment_id ?? null,
  remainingAmount: row.remaining_amount,
});

/** 문의 한 줄을 화면의 값으로 옮긴다 — 비는 칸은 여기서 한 번 `null` 로 받는다(위 머리말) */
export const orderLineOf = (row: RpcRow<'operator_reading_refund_basis'>): OrderLine => {
  const approvedAt = row.approved_at ?? null;
  const credits = row.credits ?? null;
  return {
    orderId: row.order_id,
    orderNumber: row.provider_order_id,
    status: row.status,
    provider: row.provider,
    paymentId: row.provider_payment_id ?? null,
    amount: row.amount,
    refundedAmount: row.refunded_amount,
    orderedAt: row.ordered_at,
    approvedAt,
    bundle:
      credits === null || approvedAt === null
        ? null
        : {
            credits,
            refundedCredits: row.refunded_credits,
            used: row.used,
            reserved: row.reserved,
            unused: row.unused,
            validUntil: readingBundleValidUntil(new Date(approvedAt)),
          },
  };
};

/** 지금 걷을 수 있는 회차(진행 중인 확보는 빠졌다)를 다 걷을 때의 금액 — 묶음이 없거나 걷을 것이 없으면 0 */
export const refundForAllUnused = (line: OrderLine): number =>
  line.bundle === null || line.bundle.unused === 0
    ? 0
    : refundOwed(
        {
          paid: line.amount,
          credits: line.bundle.credits,
          refundedCredits: line.bundle.refundedCredits,
          refundedAmount: line.refundedAmount,
        },
        line.bundle.unused,
      );

/**
 * 주문 번호 없이 화면만 열었을 때 청하는 id — 없는 주문이라 빈 답이 오고, 운영자가 아니면 거절이 온다. 다른 운영 화면처럼
 * 운영자가 아니면 찾는 칸조차 안 서게(404) 하려고 문을 한 번 두드린다. 접속기록에는 이 id 로 한 줄이 남는다.
 */
export const NO_ORDER = '00000000-0000-0000-0000-000000000000';

/**
 * 주문 id 하나로 청한다. 화면의 본체라 못 읽으면 값으로 낸다 — 운영자 화면이 제 문장을 세운다. 없는 주문이면 `null`.
 */
export async function refundBasis(
  orderId: string,
): Promise<typeof DENIED | SkippableRead<RefundBasis | null>> {
  const supabase = await supabaseOnServer();
  const answer = await supabase.rpc(
    'operator_reading_refund_basis',
    rpcArgs<'operator_reading_refund_basis'>({ p_order_id: orderId }),
  );

  if (answer.error?.code === '42501') {
    await noteDenial(supabase, 'credits.refund_basis');
    return DENIED;
  }
  if (answer.error) return unread(answer.error, 'operator_reading_refund_basis');

  const rows = answer.data ?? [];
  const asked = rows.find((row) => row.asked);
  if (!asked) return read(null);

  // 진행 중인 환불 — 화면을 닫았다 다시 와도 이어서 확정한다. 접속기록에 `credits.refund_status` 한 줄
  const held = await supabase.rpc(
    'operator_reading_refund_hold',
    rpcArgs<'operator_reading_refund_hold'>({ p_order_id: orderId }),
  );
  if (held.error?.code === '42501') {
    await noteDenial(supabase, 'credits.refund_status');
    return DENIED;
  }
  if (held.error) return unread(held.error, 'operator_reading_refund_hold');
  const hold = held.data?.[0];

  return read({
    asked: orderLineOf(asked),
    others: rows.filter((row) => !row.asked).map(orderLineOf),
    hold: hold === undefined ? null : refundHoldOf(hold),
  });
}
