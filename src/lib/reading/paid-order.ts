import { bundleOrderName, readingBundleValidUntil } from './bundle';
import { orderIsPaid, orderStatusOf, type PaidOrderStatus } from './order-status';
import { when } from './when';

/** `my_reading_orders` 의 한 줄 가운데 화면이 쓰는 칸 — 문의 생성 타입은 부르는 쪽이 들고, 칸이 어긋나면 그쪽 컴파일이 짚는다 */
type Row = {
  readonly provider_order_id: string;
  readonly bundle_credits: number;
  readonly amount: number;
  readonly refunded_amount: number;
  readonly status: string;
  readonly paid_at: string;
  readonly remaining: number;
};

/** 결제 내역 한 줄 — 웹과 앱의 화면이 그대로 그린다 */
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

const STATUS: Record<PaidOrderStatus, PaidOrder['status']> = {
  approved: '결제 완료',
  partially_refunded: '부분 환불',
  refunded: '전액 환불',
};

/** 묶음이 선 셋은 제 이름으로, 그 밖의 값은 결제 완료로 */
const paidStatusOf = (value: string): PaidOrder['status'] => {
  const status = orderStatusOf(value);
  return orderIsPaid(status) ? STATUS[status] : '결제 완료';
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
    status: paidStatusOf(row.status),
    paidAt: when(row.paid_at),
    validUntil: koreanDate(readingBundleValidUntil(new Date(row.paid_at))),
    remaining: Math.max(0, row.remaining),
  };
}
