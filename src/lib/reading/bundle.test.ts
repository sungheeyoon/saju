import { describe, expect, it } from 'vitest';

import {
  discountAgainstSingles,
  READING_BUNDLES,
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

  it('1회권과 견준 할인율은 반올림으로 0 · 12 · 19 · 40 이다 — 사람이 정한 표와 같다', () => {
    expect(READING_BUNDLES.map((b) => discountAgainstSingles(b.credits, b.price))).toEqual([0, 12, 19, 40]);
  });

  it('5회 · 20회의 실제 할인율은 표시보다 작다 — 18.8 · 39.8', () => {
    const exact = READING_BUNDLES.map((b) => Math.round((1 - b.price / (b.credits * 4900)) * 1000) / 10);
    expect(exact).toEqual([0, 12.2, 18.8, 39.8]);
  });

  it('많이 사는 묶음일수록 한 회가 싸다', () => {
    const perCredit = READING_BUNDLES.map((b) => b.price / b.credits);
    expect([...perCredit].sort((a, b) => b - a)).toEqual(perCredit);
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
