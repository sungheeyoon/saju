/**
 * 주문 화면의 이름표 — 운영자만 보는 글이다(G-110 ②).
 *
 * 환불 사유는 DB 가 받는 다섯(`reading_order_refund.reason`)이고 자유 글을 받지 않는다(ADR 0106). 금액은 사유와 상관없이
 * ADR 0148 의 산식 하나이고 걷는 것은 안 쓴 회차뿐이다 — 쓴 회차까지 돌려줘야 하는 미제공은 이 화면이 아니라 런북
 * 「수동 환불」의 SQL 이다.
 */

export const REFUND_REASONS = [
  { value: 'unused', label: '안 쓴 몫 환불' },
  { value: 'withdrawal', label: '청약철회' },
  { value: 'duplicate', label: '중복 결제' },
  { value: 'failure', label: '미제공(장애)' },
  { value: 'other', label: '그 밖(심사 결제 등)' },
] as const;

export type RefundReason = (typeof REFUND_REASONS)[number]['value'];

export const refundReasonLabel = (value: string): string =>
  REFUND_REASONS.find((reason) => reason.value === value)?.label ?? value;

export const isRefundReason =(value: string): value is RefundReason =>
  REFUND_REASONS.some((reason) => reason.value === value);

const STATUS_LABEL: Readonly<Record<string, string>> = {
  pending: '결제 전',
  approved: '결제됨',
  cancelled: '닫힘(결제 안 됨)',
  partially_refunded: '일부 환불',
  refunded: '전액 환불',
};

export const orderStatusLabel = (status: string): string => STATUS_LABEL[status] ?? status;

/** 원 — 「12,900원」 */
export const won = (amount: number): string => `${amount.toLocaleString('ko-KR')}원`;

const SEOUL_TIME = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** 시각 — 서울 기준 */
export const seoulTime = (iso: string): string => SEOUL_TIME.format(new Date(iso));
