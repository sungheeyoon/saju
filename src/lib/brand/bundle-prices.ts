import { READING_BUNDLES, discountAgainstSingles, refundOwed, won } from '../reading/bundle';

/**
 * **약관 · 환불정책이 말하는 묶음의 숫자** — 값은 `READING_BUNDLES` 하나에서 온다(ADR 0176).
 *
 * 여기는 숫자만 짓는다. 문장은 약관 · 환불정책 파일에 그대로 있고, 이 값을 끼울 뿐이다.
 */

/** 파는 묶음의 장수 */
type BundleCredits = (typeof READING_BUNDLES)[number]['credits'];

/** 그 장수 묶음의 가격(원) */
export const bundlePrice = (credits: BundleCredits): number => {
  const bundle = READING_BUNDLES.find((one) => one.credits === credits);
  if (!bundle) throw new Error(`파는 묶음이 아니다: ${credits}장`);
  return bundle.price;
};

/** 약관 제12조의 가격표 줄 — 묶음 · 가격 · 1장당 · 1장 대비 할인 */
export const bundlePriceRows = (): string[][] =>
  READING_BUNDLES.map(({ credits, price }) => [
    `${credits}장`,
    won(price),
    won(price / credits),
    credits === 1 ? '—' : `${discountAgainstSingles(credits, price)}%`,
  ]);

/** 실제 할인율(소수 첫째 자리) — 「12.2 · 18.8 · 39.8」. 1장 묶음은 빠진다 */
export const exactDiscounts = (): string => {
  const single = READING_BUNDLES[0].price;
  return READING_BUNDLES.filter(({ credits }) => credits !== 1)
    .map(({ credits, price }) => ((1 - price / (credits * single)) * 100).toFixed(1))
    .join(' · ');
};

/**
 * 그 묶음에서 `used` 장을 쓰고 나머지를 한 번에 돌려받을 때의 금액 — 낸 돈 × 안 쓴 장수 ÷ 산 장수, 원 아래는 버린다. 7일이 지났으면
 * 그 값에서 10% 를 위약금으로 뺀다(원 아래 버림, ADR 0192). 셈은 운영자 화면 · DB 와 같은 `refundOwed` 다.
 */
export const refundOf = (credits: BundleCredits, used: number, afterSevenDays: boolean): number =>
  refundOwed(
    { paid: bundlePrice(credits), credits, refundedCredits: 0, refundedAmount: 0, penalizedCredits: 0 },
    credits - used,
    afterSevenDays,
  );
