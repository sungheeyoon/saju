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
 * 산 풀이권의 유효기간(년) — 구매일로부터. 상품 화면의 구매 전 확인사항이 이 값을 말한다(운영자 결정 2026-10-12, G-21).
 * 만료를 DB 가 걷는 일은 아직 없다 — 첫 판매 뒤 5년 안에 선다.
 */
export const READING_BUNDLE_VALID_YEARS = 5;

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 묶음의 유효기간이 끝나는 날(서울 날짜, `YYYY-MM-DD`) — 산 날부터 `READING_BUNDLE_VALID_YEARS` 년(ADR 0173).
 *
 * 민법 제157조 · 제160조의 셈이다: 산 날은 안 세고 다음 날부터 세므로, 끝나는 날은 **5년 뒤 같은 날**이다(2026-10-12 → 2031-10-12).
 * 그 해에 같은 날이 없으면(2월 29일) 그 달의 끝날이다. 결제 내역 화면이 이 날을 말한다 — DB 는 아직 만료를 걷지 않는다.
 */
export function readingBundleValidUntil(paidAt: Date): string {
  const seoul = new Date(paidAt.getTime() + SEOUL_OFFSET_MS);
  const year = seoul.getUTCFullYear() + READING_BUNDLE_VALID_YEARS;
  const month = seoul.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(seoul.getUTCDate(), lastDay);
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

/**
 * 1회권을 같은 횟수만큼 살 때와 견준 할인율(%) — **정수 내림**(운영자 결정 2026-09-24, G-21). 실제 값은
 * 12.2 · 18.8 · 39.8 이고 표시는 12 · 18 · 39 다. 반올림(12 · 19 · 40)은 5회 · 20회에서 표시가 실제보다 커서
 * 걷었다 — 할인 표시는 실제보다 크게 말하지 않는다. 가격은 그대로다. 상품 화면 · 결제 전 고지 · 문서가
 * 할인율을 말하면 이 값 하나를 쓴다. 화면은 기준(1회권 대비)을 함께 적는다.
 */
export const discountAgainstSingles = (credits: number, price: number): number =>
  Math.floor((1 - price / (credits * SINGLE_PRICE)) * 100);

/** 쓰임이 든 몫 — 무료 · 예외 · 산 묶음 · 몫 밖(셈이 되돌려 준 자리) */
type CreditShare = 'free' | 'grant' | 'bundle' | 'outside';

/** 돈으로 돌려줄 수 있는 몫인가 — **산 것만.** 무료 · 예외 · 몫 밖은 어떤 경우에도 아니다(G-21 ③) */
export const shareIsRefundable = (share: CreditShare): boolean => share === 'bundle';

/** 묶음 하나의 쓰임 — 환불 셈의 입력 한 줄에서 */
type BundleUsage = {
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

/** 파는 묶음 하나 — 목록에 없는 회차 수면 `null`. 주문 금액은 DB 가 정하므로 이 값은 화면이 말할 때만 쓴다 */
export const readingBundleOf = (credits: number): (typeof READING_BUNDLES)[number] | null =>
  READING_BUNDLES.find((bundle) => bundle.credits === credits) ?? null;

/**
 * 묶음에 다는 표시 — 5회는 추천, 20회는 최대 할인(§7.0 표, G-21). 둘은 까닭이 달라 하나씩만 단다.
 */
export const bundleMark = (credits: number): '추천' | '최대 할인' | null =>
  credits === 5 ? '추천' : credits === 20 ? '최대 할인' : null;

/**
 * 결제창 · 카드 명세에 서는 상품 이름. 카드사 심사는 상품 이름에 「TEST」가 들면 반려하므로 시험 표식을 싣지 않는다
 * (PortOne 필수 구축요건). PG 이름도 싣지 않는다 — PG 는 아직 안 정했다(G-21).
 */
export const bundleOrderName = (credits: number): string => `풀이권 ${credits}회`;
