import { describe, expect, it } from 'vitest';

import {
  bundleMark,
  readingBundleOf,
  bundleOrderName,
  discountAgainstSingles,
  READING_BUNDLES,
  readingBundleValidUntil,
  refundableCredits,
  shareIsRefundable,
} from './bundle';

describe('풀이권 묶음', () => {
  it('파는 묶음은 1 · 3 · 5 · 20 회 넷이고 가격은 사람이 정한 값이다', () => {
    expect(READING_BUNDLES.map((b) => [b.credits, b.price])).toEqual([
      [1, 4900],
      [3, 12900],
      [5, 19900],
      [20, 59000],
    ]);
  });

  it('1회권과 견준 할인율은 정수 내림으로 0 · 12 · 18 · 39 다 — 운영자가 정한 표와 같다', () => {
    expect(READING_BUNDLES.map((b) => discountAgainstSingles(b.credits, b.price))).toEqual([0, 12, 18, 39]);
  });

  it('실제 할인율은 12.2 · 18.8 · 39.8 이고 표시는 어느 묶음에서도 실제보다 크지 않다', () => {
    const exact = READING_BUNDLES.map((b) => (1 - b.price / (b.credits * 4900)) * 100);
    expect(exact.map((one) => Math.round(one * 10) / 10)).toEqual([0, 12.2, 18.8, 39.8]);
    READING_BUNDLES.forEach((b, i) => {
      const shown = discountAgainstSingles(b.credits, b.price);
      expect(shown).toBeLessThanOrEqual(exact[i]);
      expect(exact[i] - shown).toBeLessThan(1);
    });
  });

  it('많이 사는 묶음일수록 한 회가 싸다', () => {
    const perCredit = READING_BUNDLES.map((b) => b.price / b.credits);
    expect([...perCredit].sort((a, b) => b - a)).toEqual(perCredit);
  });
});

describe('상품 화면의 판단', () => {
  it('목록에 있는 회차만 묶음이다 — 그 밖의 수는 팔지 않는다', () => {
    expect(readingBundleOf(3)).toEqual({ credits: 3, price: 12900 });
    expect([0, 2, 4, 10, 21].map(readingBundleOf)).toEqual([null, null, null, null, null]);
  });

  it('추천은 5회, 최대 할인은 20회에 하나씩만 선다', () => {
    expect(READING_BUNDLES.map((b) => bundleMark(b.credits))).toEqual([null, null, '추천', '최대 할인']);
  });

  it('상품 이름은 장수를 말하고 시험 표식 · 0원이 없다 — 카드사 심사가 반려하는 꼴', () => {
    for (const b of READING_BUNDLES) {
      expect(bundleOrderName(b.credits)).toBe(`풀이권 ${b.credits}장`);
      expect(bundleOrderName(b.credits)).not.toMatch(/test/i);
      expect(b.price).toBeGreaterThan(0);
    }
  });
});

describe('환불 셈의 판단', () => {
  it('돈으로 돌려줄 수 있는 몫은 산 묶음뿐이다', () => {
    expect(shareIsRefundable('bundle')).toBe(true);
    expect(shareIsRefundable('free')).toBe(false);
    expect(shareIsRefundable('grant')).toBe(false);
    expect(shareIsRefundable('outside')).toBe(false);
  });

  it('안 쓴 것만 걷고 예약 중인 것은 풀릴 때까지 기다린다', () => {
    expect(refundableCredits({ credits: 3, refundedCredits: 0, used: 1, reserved: 1 })).toEqual({
      refundable: 1,
      waiting: 1,
    });
  });

  it('이미 걷은 회차는 다시 걷지 않는다', () => {
    expect(refundableCredits({ credits: 5, refundedCredits: 2, used: 1, reserved: 0 })).toEqual({
      refundable: 2,
      waiting: 0,
    });
  });

  it('다 쓴 묶음에서 걷을 것은 0 이다 — 음수가 되지 않는다', () => {
    expect(refundableCredits({ credits: 1, refundedCredits: 0, used: 1, reserved: 1 })).toEqual({
      refundable: 0,
      waiting: 1,
    });
  });
});

describe('유효기간이 끝나는 날 (ADR 0173 · 0174)', () => {
  it('산 날부터 5년 뒤 같은 날이다 — 서울 날짜로 센다', () => {
    expect(readingBundleValidUntil(new Date('2026-10-12T05:03:00Z'))).toBe('2031-10-12');
    /* 서울로 자정을 넘긴 결제는 다음 날에 산 것이다 */
    expect(readingBundleValidUntil(new Date('2026-10-12T15:30:00Z'))).toBe('2031-10-13');
  });

  it('5년 뒤에 같은 날이 없으면 그 달의 끝날이다', () => {
    expect(readingBundleValidUntil(new Date('2028-02-29T03:00:00Z'))).toBe('2033-02-28');
  });
});
