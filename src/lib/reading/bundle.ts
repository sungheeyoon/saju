/**
 * **풀이권 묶음 — 파는 넷과 환불 셈의 판단**(G-21, ADR 0100 · 0106).
 *
 * 값을 적는 자리는 DB 다 — 주문 금액은 `reading_bundle_price` 가 정하고, 쓴 수 · 예약 중 수는
 * `operator_reading_refund_basis` 가 내준다. 여기는 그 값을 두고 **판단만** 한다: 1회권과 견준 할인율,
 * 묶음 하나에서 지금 걷을 수 있는 회차. 환불 **금액**의 산식은 없다 — 변호사 검토(G-25 ⑥) 뒤에 선다.
 *
 * 가격은 2026-09-23 에 사람이 정한 값이다. 주문 금액은 DB 의 가격표가 정하므로 둘이 갈리면 DB 가 맞다 —
 * 이 표는 화면이 할인율을 말할 때 쓴다(판매가 열리는 날, G-21).
 */

/** 파는 묶음 넷 — 회차 수와 가격(원, 부가세 포함) */
export const READING_BUNDLES = [
  { credits: 1, price: 4900 },
  { credits: 3, price: 12900 },
  { credits: 5, price: 19900 },
  { credits: 20, price: 59000 },
] as const;

const SINGLE_PRICE = READING_BUNDLES[0].price;

/**
 * 1회권을 같은 횟수만큼 살 때와 견준 할인율(%) — **반올림**, 사람이 정한 표(12 · 19 · 40)가 그렇게 셌다.
 * 실제 값은 12.2 · 18.8 · 39.8 이라 5회 · 20회는 표시가 실제보다 크다 — 판매를 열기 전에 사람이
 * 정한다(G-21, 2026-09-24 에 잼). 화면은 기준을 함께 적는다.
 */
export const discountAgainstSingles = (credits: number, price: number): number =>
  Math.round((1 - price / (credits * SINGLE_PRICE)) * 100);

/** 쓰임이 든 몫 — 무료 · 예외 · 산 묶음 · 몫 밖(셈이 되돌려 준 자리) */
export type CreditShare = 'free' | 'grant' | 'bundle' | 'outside';

/** 돈으로 돌려줄 수 있는 몫인가 — **산 것만.** 무료 · 예외 · 몫 밖은 어떤 경우에도 아니다(G-21 ③) */
export const shareIsRefundable = (share: CreditShare): boolean => share === 'bundle';

/** 묶음 하나의 쓰임 — 환불 셈의 입력 한 줄에서 */
export type BundleUsage = {
  readonly credits: number;
  readonly refundedCredits: number;
  readonly used: number;
  readonly reserved: number;
};

/**
 * 지금 걷을 수 있는 회차와 **풀릴 때까지 기다려야 하는** 회차. 예약 중인 것은 답이 오거나 시도가 끝나야
 * 쓴 것인지 안 쓴 것인지가 정해진다 — 그때까지는 걷지 않는다(G-21 ③).
 */
export const refundableCredits = (usage: BundleUsage): { refundable: number; waiting: number } => ({
  refundable: Math.max(0, usage.credits - usage.refundedCredits - usage.used - usage.reserved),
  waiting: usage.reserved,
});
