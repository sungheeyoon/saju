/**
 * **풀이권 묶음 — 파는 넷과 환불 셈의 판단**(G-21, ADR 0100 · 0106).
 *
 * 값을 적는 자리는 DB 다 — 주문 금액은 `reading_bundle_price` 가 정하고, 쓴 수 · 예약 중 수는
 * `operator_reading_refund_basis` 가 내준다. 여기는 그 값을 두고 **판단만** 한다: 1회권과 견준 할인율,
 * 환불 금액(ADR 0148 — 운영자 주문 화면이 보이고, DB 의 `operator_refund_reading_order` 가 같은 산식으로 다시 셈한다).
 *
 * 가격은 2026-09-23 에 사람이 정한 값이다. 주문 금액은 DB 의 가격표가 정하고, 사람이 읽는 가격 · 개수는 모두 이 표에서
 * 온다 — 결제 화면, 약관 제12조 · 제16조, 환불정책의 예시(`src/lib/brand/bundle-prices.ts`). 둘이 같은지는
 * `app/me/credits/bundle-price.test.ts` 가 마이그레이션의 마지막 정의와 견준다 — 가격을 바꾸면 둘을 같은 PR 에서 고친다(ADR 0176).
 */

import { seoulWallClock } from './seoul-date';

/** 파는 묶음 넷 — 회차 수와 가격(원, 부가세 포함) */
export const READING_BUNDLES = [
  { credits: 1, price: 4900 },
  { credits: 3, price: 12900 },
  { credits: 5, price: 19900 },
  { credits: 20, price: 59000 },
] as const;

const SINGLE_PRICE = READING_BUNDLES[0].price;

/**
 * 산 풀이권의 유효기간(년) — 구매일로부터. 상품 화면의 유의사항(ADR 0175)이 이 값을 말한다(운영자 결정 2026-10-12, G-21).
 * 만료를 DB 가 걷는 일은 아직 없다 — 첫 판매 뒤 5년 안에 선다.
 */
export const READING_BUNDLE_VALID_YEARS = 5;

/**
 * 묶음의 유효기간이 끝나는 날(서울 날짜, `YYYY-MM-DD`) — 산 날부터 `READING_BUNDLE_VALID_YEARS` 년(ADR 0173).
 *
 * 민법 제157조 · 제160조의 셈이다: 산 날은 안 세고 다음 날부터 세므로, 끝나는 날은 **5년 뒤 같은 날**이다(2026-10-12 → 2031-10-12).
 * 그 해에 같은 날이 없으면(2월 29일) 그 달의 끝날이다. 결제 내역 화면이 이 날을 말한다 — DB 는 아직 만료를 걷지 않는다.
 */
export function readingBundleValidUntil(paidAt: Date): string {
  const seoul = seoulWallClock(paidAt);
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
 *
 * 상품 화면의 묶음 이름과 결제 내역의 상품 칸도 이 값이다. 이름은 DB 에 두지 않는다 — 결제 내역은 묶음 수량(`bundle_credits`)에서
 * 다시 짓고, 웹훅 · 정산은 이름을 견주지 않는다. 그래서 단위가 「회」에서 「장」으로 바뀐 날(대장 all-02) 앞의 주문도 「장」으로 읽힌다.
 */
export const bundleOrderName = (credits: number): string => `풀이권 ${credits}장`;

/**
 * 가맹점 주문 번호(`rdo_` + 하이픈 뺀 주문 id)에서 주문 id 를 되짚는다 — `open_reading_order` 가 그렇게 짓는다(`20261011090000`).
 * 운영자가 붙여 넣는 글자라 앞뒤 빈칸과 대문자는 받는다. 그 모양이 아니면 `null` 이다.
 */
export function readingOrderIdOf(orderNumber: string): string | null {
  const hex = /^rdo_([0-9a-f]{32})$/.exec(orderNumber.trim().toLowerCase())?.[1];
  if (!hex) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 환불 금액을 셈할 묶음 하나의 값 — `operator_reading_refund_basis` 의 한 줄에서 온다 */
export type RefundLedger = {
  /** 실제 결제액(원) */
  readonly paid: number;
  /** 산 회차 */
  readonly credits: number;
  /** 이미 걷은 회차 */
  readonly refundedCredits: number;
  /** 이미 돌려준 금액(원) */
  readonly refundedAmount: number;
};

/**
 * 이번에 `take` 장을 걷을 때 돌려줄 금액(원) — ADR 0148 의 누적 산식이다: `결제액 × (이미 걷은 회차 + 이번 회차) ÷ 산 회차`를
 * 원 아래 버림한 뒤 이미 돌려준 금액을 뺀다. 그래서 나눠 돌려줘도 묶음을 다 걷으면 합이 결제액과 같고 넘지 않는다.
 * 걷을 수 있는 회차(안 쓴 것)를 가리는 것은 이 함수가 아니다 — DB 가 거절한다.
 */
export function refundOwed(ledger: RefundLedger, take: number): number {
  return Math.floor((ledger.paid * (ledger.refundedCredits + take)) / ledger.credits) - ledger.refundedAmount;
}
