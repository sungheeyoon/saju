import type { Pillars } from '../pillars';
import { elementDistributionOf, type ElementDistribution, type ElementWeights } from './fiveElements';
import { followingCandidacyOf, type FollowingCandidacy } from './followingPatterns';
import { johuAssessmentOf, type JohuAssessment } from './johu';
import { rootednessOf, type Rootedness } from './rootedness';
import { strengthOf, type Strength, type StrengthOptions } from './strength';
import { eokbuAssessmentOf, type EokbuAssessment } from './yongsin';
import { tenGodChartOf, tenGodCountsOf, type TenGod, type TenGodChart } from './tenGods';

export * from './fiveElements';
export * from './followingPatterns';
export * from './johu';
export * from './rootedness';
export * from './strength';
export * from './yongsin';
export * from './tenGods';
export * from './validation/eokbuExternalCases';

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
  /**
   * 억부 관점의 후보 오행 — **시험값이다.**
   *
   * 용신 확정값이 아니다. 조후·종격·격국·합충을 보지 않은 결과라
   * `status: 'experimental'` 과 `unresolved` 를 함께 읽어야 한다.
   */
  eokbu: EokbuAssessment;
  /** 《궁통보감》 일간×월지 조후 후보. 원국 조건 판정 전의 참고표다 */
  johu: JohuAssessment;
  /**
   * 통근·투출 — 억부·종격·격국이 먹고 들어가는 재료다.
   *
   * 사실만 낸다. "이 뿌리는 쓸 만한가"는 판정이라 여기 없다.
   */
  rootedness: Rootedness;
  /**
   * 종격 후보의 조건이 되는 사실 — **판정이 아니다.**
   *
   * 문턱을 고르지 않고도 셀 수 있는 것들만 낸다. 어디서 선을 긋는지가 계통
   * 선택이고 그것은 아직 하지 않았다(`FOLLOWING_PATTERN_POLICY`).
   */
  followingCandidacy: FollowingCandidacy;
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
  const elements = elementDistributionOf(pillars, options.weights);
  const rootedness = rootednessOf(pillars);

  return {
    elements,
    tenGods,
    tenGodCounts: tenGodCountsOf(tenGods),
    // 오행 분포와 같은 가중치를 써야 두 결과가 어긋나지 않는다.
    strength,
    eokbu: eokbuAssessmentOf(pillars, strength, options.weights),
    johu: johuAssessmentOf(pillars),
    rootedness,
    followingCandidacy: followingCandidacyOf(pillars, elements, rootedness),
  };
}
