import { describe, expect, it } from 'vitest';

import {
  combinedBalanceOf,
  complementOf,
  complementOneWay,
  suppliedCountOf,
  type ElementSummary,
} from './elementAxes';

/**
 * **이 두 벌은 pgTAP 에도 그대로 있다**(`supabase/tests/07_discovery.test.sql`).
 *
 * 오행 두 축은 TypeScript 와 SQL 에 하나씩 적혀 있다 — 후보의 오행 요약을 브라우저로
 * 내려보내지 않으려면 DB 안에서도 같은 셈을 해야 하기 때문이다. 두 자리는 갈릴 수
 * 있으므로 **같은 입력에 같은 기대값**을 양쪽에 적어 둔다. 한쪽만 고치면 다른 쪽이 깨진다.
 */
const 고른네오행: ElementSummary = {
  glyphCount: 8,
  counts: { 木: 2, 火: 2, 土: 2, 金: 2, 水: 0 },
  ratios: { 木: 0.25, 火: 0.25, 土: 0.25, 金: 0.25, 水: 0 },
};

const 토금뿐: ElementSummary = {
  glyphCount: 8,
  counts: { 木: 0, 火: 0, 土: 4, 金: 4, 水: 0 },
  ratios: { 木: 0, 火: 0, 土: 0.5, 金: 0.5, 水: 0 },
};

const 다있다: ElementSummary = {
  glyphCount: 8,
  counts: { 木: 2, 火: 2, 土: 2, 金: 1, 水: 1 },
  ratios: { 木: 0.25, 火: 0.25, 土: 0.25, 金: 0.125, 水: 0.125 },
};

describe('오행 보완', () => {
  it('없는 오행 중 상대가 가진 비율이다', () => {
    // 토금뿐 에게 없는 것은 木·火·水 셋, 그중 고른네오행 이 가진 것은 木·火 둘.
    expect(complementOneWay(토금뿐, 고른네오행)).toBeCloseTo(66.6667, 4);
    // 고른네오행 에게 없는 것은 水 하나, 토금뿐 에는 없다.
    expect(complementOneWay(고른네오행, 토금뿐)).toBe(0);
  });

  it('양방향 평균이라 자리를 바꿔도 같다', () => {
    expect(complementOf(고른네오행, 토금뿐)).toBeCloseTo(33.3333, 4);
    expect(complementOf(토금뿐, 고른네오행)).toBeCloseTo(33.3333, 4);
  });

  /**
   * 빠진 오행이 없다는 것은 상대가 채울 몫도 없다는 뜻이다. 완벽한 궁합으로 올리지
   * 않고 중립값에 둔다 — 제품 선택이며 명리 규칙이 아니다.
   */
  it('빠진 오행이 없으면 중립값 70 이다', () => {
    expect(complementOneWay(다있다, 토금뿐)).toBe(70);
  });

  it('채우는 개수는 따로 센다 — 문장이 쓰는 수다', () => {
    expect(suppliedCountOf(토금뿐, 고른네오행)).toBe(2);
    expect(suppliedCountOf(고른네오행, 토금뿐)).toBe(0);
  });
});

describe('함께 놓은 균형', () => {
  it('두 비중을 합쳐 다섯 축의 쏠림을 잰다', () => {
    // 평균 비중 木·火 0.125, 土·金 0.375, 水 0 → 거리 합 0.7 → (1 - 0.7/1.6)*100
    expect(combinedBalanceOf(고른네오행, 토금뿐)).toBeCloseTo(56.25, 4);
  });

  it('자리를 바꿔도 같다', () => {
    expect(combinedBalanceOf(토금뿐, 고른네오행)).toBeCloseTo(
      combinedBalanceOf(고른네오행, 토금뿐),
      10,
    );
  });
});
