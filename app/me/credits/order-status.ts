/**
 * **주문의 상태** — `reading_order.status` 의 check 제약과 같은 다섯이다. 대기 → 승인 → 부분 환불 → 전액 환불, 또는 대기 → 취소.
 *
 * 제약에 상태가 늘면 여기도 늘린다 — 그래야 상태를 갈라 쓰는 자리(`orderIsPaid` · 결제 내역의 이름표)를 컴파일러가 짚는다.
 * 아무것도 들이지 않는 파일로 둔다 — 브라우저가 부르는 `sale.ts` 가 이 낱말을 쓴다.
 */
export const ORDER_STATUSES = ['pending', 'approved', 'cancelled', 'partially_refunded', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** 돈이 들어와 묶음이 선 상태 셋 */
export type PaidOrderStatus = Extract<OrderStatus, 'approved' | 'partially_refunded' | 'refunded'>;

/** DB 의 `text` 를 상태 다섯으로 좁힌다 — 모르는 값은 `null` */
export const orderStatusOf = (value: string): OrderStatus | null =>
  ORDER_STATUSES.find((known) => known === value) ?? null;

/** 주문 상태 가운데 돈이 들어와 묶음이 선 것 — 환불이 섞였어도 결제는 끝났다 */
export const orderIsPaid = (status: OrderStatus | null): status is PaidOrderStatus =>
  status === 'approved' || status === 'partially_refunded' || status === 'refunded';
