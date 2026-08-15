import type { Pillars } from '../pillars';
import { elementDistributionOf, type ElementDistribution, type ElementWeights } from './fiveElements';
import { strengthOf, type Strength, type StrengthOptions } from './strength';
import { yongsinOf, type Yongsin } from './yongsin';
import { tenGodChartOf, tenGodCountsOf, type TenGod, type TenGodChart } from './tenGods';

export * from './fiveElements';
export * from './strength';
export * from './yongsin';
export * from './tenGods';

/**
 * 4주에서 해석의 재료를 뽑는다 — 오행 분포·십성·신강신약.
 *
 * 여기까지가 L1(만세력 엔진)의 끝이다. 전부 순수 함수이고 결론을 문장으로
 * 만들지 않는다. 자연어는 L3가 이 구조화된 결과를 조회해서 조립한다.
 */

export type Analysis = {
  elements: ElementDistribution;
  tenGods: TenGodChart;
  tenGodCounts: Record<TenGod, number>;
  strength: Strength;
  /** 억부용신 — 이 사주에 가장 필요한 오행 */
  yongsin: Yongsin;
};

export type AnalysisOptions = {
  weights?: Partial<ElementWeights>;
  strength?: Omit<StrengthOptions, 'weights'>;
};

export function analyzePillars(
  pillars: Pillars,
  options: AnalysisOptions = {},
): Analysis {
  const tenGods = tenGodChartOf(pillars);
  const strength = strengthOf(pillars, { ...options.strength, weights: options.weights });

  return {
    elements: elementDistributionOf(pillars, options.weights),
    tenGods,
    tenGodCounts: tenGodCountsOf(tenGods),
    // 오행 분포와 같은 가중치를 써야 두 결과가 어긋나지 않는다.
    strength,
    yongsin: yongsinOf(pillars, strength, options.weights),
  };
}
