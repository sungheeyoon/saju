import type { RpcRow } from '../db';
import { readingBundleValidUntil, refundOwed } from '../reading/bundle';
import type { Owner } from './refund-confirm';

/** 주문 · 진행 중인 환불을 화면의 값으로 옮긴다 — 웹과 앱이 함께 쓴다 (G-110 ②, ADR 0184) */
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
  /** 산 사람 — 확인창이 대상을 가르는 값(닉네임 · 계정 앞자리). 이메일은 안 받는다 */
  readonly owner: Owner;
  /** 묶음 — 승인된 적 없는 주문이면 `null` */
  readonly bundle: {
    readonly credits: number;
    readonly refundedCredits: number;
    /** 걷은 회차 가운데 위약금을 뗀 사유(「안 쓴 몫 환불」)로 걷은 것 — 다음 환불의 누적 위약금이 이것을 센다(ADR 0192) */
    readonly penalizedCredits: number;
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
  /** 가맹점 주문 번호(`rdo_…`) — PortOne 의 결제 번호 */
  readonly orderNumber: string;
  /** PG 의 거래 번호 — 콘솔에서 이 결제를 찾는다 */
  readonly paymentId: string | null;
  /** 결제액 */
  readonly paidAmount: number;
  /** 취소 후 잔액 — 결제액 − 이미 돌려준 금액 − 이번 금액 */
  readonly remainingAmount: number;
  /** 산 사람이 떠나 주문이 지워졌다 — 확정은 보관된 결제에 대해 한다 */
  readonly departed: boolean;
  /** 장부에 이미 적힌 그 주문의 환불액(이번 확보는 안 든다) — 비면 견줄 장부가 없다 */
  readonly bookedRefund: number | null;
  /** 산 사람 — 떠났으면 닉네임은 없고 계정 앞자리만 남는다 */
  readonly owner: Owner;
};

export type RefundBasis = {
  /** 찾은 주문 — 산 사람이 떠나 주문이 지워졌으면 `null`(그때는 진행 중인 확보만 선다) */
  readonly asked: OrderLine | null;
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
  orderNumber: row.provider_order_id,
  paymentId: row.provider_payment_id ?? null,
  paidAmount: row.paid_amount,
  remainingAmount: row.remaining_amount,
  departed: row.departed,
  bookedRefund: row.booked_refund ?? null,
  owner: { nickname: row.owner_nickname ?? null, ref: row.owner_ref },
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
    owner: { nickname: row.owner_nickname ?? null, ref: row.owner_ref },
    bundle:
      credits === null || approvedAt === null
        ? null
        : {
            credits,
            refundedCredits: row.refunded_credits,
            penalizedCredits: row.penalized_credits,
            used: row.used,
            reserved: row.reserved,
            unused: row.unused,
            validUntil: readingBundleValidUntil(new Date(approvedAt)),
          },
  };
};

/**
 * 지금 걷을 수 있는 회차(진행 중인 확보는 빠졌다)를 다 걷을 때의 금액 — 묶음이 없거나 걷을 것이 없으면 0.
 * `penalized` 면 10% 위약금을 뗀 금액이다(ADR 0192).
 */
export const refundForAllUnused = (line: OrderLine, penalized: boolean): number =>
  line.bundle === null || line.bundle.unused === 0
    ? 0
    : refundOwed(
        {
          paid: line.amount,
          credits: line.bundle.credits,
          refundedCredits: line.bundle.refundedCredits,
          refundedAmount: line.refundedAmount,
          penalizedCredits: line.bundle.penalizedCredits,
        },
        line.bundle.unused,
        penalized,
      );

/**
 * 주문 번호 없이 화면만 열었을 때 청하는 id — 없는 주문이라 빈 답이 오고, 운영자가 아니면 거절이 온다. 다른 운영 화면처럼
 * 운영자가 아니면 찾는 칸조차 안 서게(404) 하려고 문을 한 번 두드린다. 접속기록에는 이 id 로 한 줄이 남는다.
 */
export const NO_ORDER = '00000000-0000-0000-0000-000000000000';
