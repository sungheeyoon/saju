import { describe, expect, it } from 'vitest';

import {
  bundleMark,
  readingBundleOf,
  bundleOrderName,
  discountAgainstSingles,
  READING_BUNDLES,
  readingBundleValidUntil,
  isPenalizedRefund,
  readingOrderIdOf,
  refundBreakdown,
  refundOwed,
  type RefundLedger,
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

describe('환불 금액 (ADR 0148 · 0192)', () => {
  const fresh = (paid: number, credits: number) => ({ paid, credits, refundedCredits: 0, refundedAmount: 0, penalizedCredits: 0 });

  /** 걷은 것을 장부에 적는다 — DB 의 `refund_reading_order` 가 하는 일 */
  const booked = (ledger: RefundLedger, take: number, penalized: boolean, owed: number): RefundLedger => ({
    ...ledger,
    refundedCredits: ledger.refundedCredits + take,
    refundedAmount: ledger.refundedAmount + owed,
    penalizedCredits: ledger.penalizedCredits + (penalized ? take : 0),
  });

  /** 나눠 걷기 — 회차 · 위약금 여부를 차례로 걷고 돌려준 금액들을 낸다 */
  const inSteps = (paid: number, credits: number, steps: readonly (readonly [number, boolean])[]): number[] => {
    let ledger = fresh(paid, credits);
    return steps.map(([take, penalized]) => {
      const owed = refundOwed(ledger, take, penalized);
      ledger = booked(ledger, take, penalized, owed);
      return owed;
    });
  };
  const sum = (amounts: readonly number[]) => amounts.reduce((a, b) => a + b, 0);

  it('7일 안의 금액은 환불정책의 예시 다섯과 같다 — 낸 돈 × 안 쓴 장수 ÷ 산 장수', () => {
    expect(refundOwed(fresh(59000, 20), 17, false)).toBe(50150);
    expect(refundOwed(fresh(59000, 20), 8, false)).toBe(23600);
    expect(refundOwed(fresh(19900, 5), 4, false)).toBe(15920);
    expect(refundOwed(fresh(12900, 3), 2, false)).toBe(8600);
    expect(refundOwed(fresh(4900, 1), 1, false)).toBe(4900);
  });

  it('7일 뒤의 금액은 그 값에서 10% 를 뺀 것이다 — 20장 묶음에서 3 · 10 · 15장 쓴 예시', () => {
    expect([17, 10, 5].map((take) => refundOwed(fresh(59000, 20), take, false))).toEqual([50150, 29500, 14750]);
    expect([17, 10, 5].map((take) => refundOwed(fresh(59000, 20), take, true))).toEqual([45135, 26550, 13275]);
    expect(refundBreakdown(fresh(59000, 20), 17, true)).toEqual({ gross: 50150, penalty: 5015, owed: 45135 });
  });

  it('위약금은 원 아래를 버린다 — 이용자 쪽으로', () => {
    // 19,900 × 4 ÷ 5 = 15,920 · 위약금 1,592
    expect(refundOwed(fresh(19900, 5), 4, true)).toBe(14328);
    // 19,900 × 1 ÷ 3 = 6,633.3 → 6,633 · 위약금 663.3 → 663
    expect(refundBreakdown(fresh(19900, 3), 1, true)).toEqual({ gross: 6633, penalty: 663, owed: 5970 });
  });

  it('나눠 돌려주면 누적으로 셈해 묶음을 다 걷은 합이 결제액과 같다', () => {
    const paidBack = inSteps(19900, 3, [[1, false], [1, false], [1, false]]);
    expect(paidBack).toEqual([6633, 6633, 6634]);
    expect(sum(paidBack)).toBe(19900);
  });

  it('위약금을 떼며 나눠 돌려줘도 한 번에 돌려줄 때와 합이 같다 — 두 번 빠지지도 덜 빠지지도 않는다', () => {
    const once = refundOwed(fresh(59000, 20), 17, true);
    expect(sum(inSteps(59000, 20, Array.from({ length: 17 }, () => [1, true] as const)))).toBe(once);
    expect(sum(inSteps(59000, 20, [[1, true], [16, true]]))).toBe(once);
    expect(sum(inSteps(19900, 3, [[1, true], [1, true], [1, true]]))).toBe(refundOwed(fresh(19900, 3), 3, true));
    expect(sum(inSteps(19900, 3, [[1, true], [1, true], [1, true]]))).toBe(19900 - 1990);
  });

  it('버림은 누적 값에 한 번씩이다 — DB 시험(99_refund_penalty)과 같은 수', () => {
    // 회마다 버리면 3,000 · 3,000 · 3,000 으로 1원이 덜 간다
    expect(inSteps(10001, 3, [[1, true], [1, true], [1, true]])).toEqual([3000, 3001, 3000]);
    expect(inSteps(59000, 20, [[1, true], [16, true]])).toEqual([2655, 42480]);
  });

  it('위약금 없는 환불과 섞어도 위약금은 위약금을 뗀 회차에만 한 번 든다', () => {
    // 7일 안에 5장을 철회하고, 7일 뒤 남은 12장을 돌려받는다
    const mixed = inSteps(59000, 20, [[5, false], [12, true]]);
    expect(mixed).toEqual([14750, 35400 - 3540]);
    // 순서를 바꿔도 합은 같다 — 위약금은 12장 몫(35,400 의 10%)뿐이다
    expect(sum(inSteps(59000, 20, [[12, true], [5, false]]))).toBe(sum(mixed));
    expect(sum(mixed)).toBe(50150 - 3540);
  });

  it('어떻게 나눠 걷든 돌려준 합은 결제액을 넘지 않는다', () => {
    for (const [paid, credits] of [[4900, 1], [12900, 3], [19900, 5], [59000, 20], [19900, 3], [10001, 7]] as const) {
      for (let first = 1; first <= credits; first += 1) {
        for (const penalties of [[false, false], [true, true], [true, false], [false, true]] as const) {
          const steps: [number, boolean][] = [[first, penalties[0]]];
          if (credits - first > 0) steps.push([credits - first, penalties[1]]);
          const amounts = inSteps(paid, credits, steps);
          expect(amounts.every((one) => one >= 0)).toBe(true);
          expect(sum(amounts)).toBeLessThanOrEqual(paid);
        }
      }
    }
  });

  it('위약금을 떼는 사유는 「안 쓴 몫 환불」 하나다', () => {
    expect(isPenalizedRefund('unused')).toBe(true);
    for (const reason of ['withdrawal', 'duplicate', 'failure', 'other']) expect(isPenalizedRefund(reason)).toBe(false);
  });
});

describe('주문 번호', () => {
  it('rdo_ 뒤의 32자를 주문 id 로 되짚고 붙여 넣은 빈칸 · 대문자는 받는다', () => {
    expect(readingOrderIdOf('rdo_0f1e2d3c4b5a49688776655443322110')).toBe('0f1e2d3c-4b5a-4968-8776-655443322110');
    expect(readingOrderIdOf('  RDO_0F1E2D3C4B5A49688776655443322110 ')).toBe('0f1e2d3c-4b5a-4968-8776-655443322110');
  });

  it('그 모양이 아니면 주문 번호가 아니다', () => {
    expect(readingOrderIdOf('0f1e2d3c-4b5a-4968-8776-655443322110')).toBeNull();
    expect(readingOrderIdOf('rdo_0f1e2d3c')).toBeNull();
    expect(readingOrderIdOf('')).toBeNull();
  });
});
