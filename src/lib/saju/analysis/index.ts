import type { Pillars } from '../pillars';
import type { Bureau } from './bureau';
import { effectiveElementsOf, type EffectiveElements } from './effectiveElements';
import { elementDistributionOf, type ElementDistribution, type ElementWeights } from './fiveElements';
import {
  followingAssessmentOf,
  followingCandidacyOf,
  type FollowingAssessment,
  type FollowingCandidacy,
} from './followingPatterns';
import { johuAssessmentOf, type JohuAssessment } from './johu';
import { rootednessOf, type Rootedness } from './rootedness';
import { rootQualityOf, type RootQualityChart } from './rootQuality';
import { strengthOf, type Strength, type StrengthOptions } from './strength';
import { eokbuAssessmentOf, type EokbuAssessment } from './yongsin';
import { tenGodChartOf, tenGodCountsOf, type TenGod, type TenGodChart } from './tenGods';

export * from './bureau';
export * from './effectiveElements';
export * from './fiveElements';
export * from './followingPatterns';
export * from './johu';
export * from './rootedness';
export * from './rootQuality';
export * from './strength';
export * from './transformation';
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
  /** 글자를 있는 그대로 센 오행 분포 */
  elements: ElementDistribution;
  /**
   * 국(局)과 합화를 반영한 실효 분포 — **바탕과 함께 낸다.**
   *
   * `elements` 를 갈아치우지 않는 이유가 있다. 무엇을 반영했는지 견주려면
   * 반영하지 않은 값이 남아 있어야 한다. 어느 글자의 무게가 어디로 얼마나
   * 갔는지는 `effectiveElements.shifts` 가 한 건씩 적는다.
   */
  effectiveElements: EffectiveElements;
  /** 원국에 선 국(局) — `effectiveElements.bureaus` 와 같은 값이다 */
  bureaus: readonly Bureau[];
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
   * 뿌리의 질 — **판정이다.** `rootedness` 가 사실을 내고 이쪽이 등급을 매긴다.
   *
   * 세어진 뿌리와 남은 뿌리는 다르다. 충에 뽑히거나 국에 끌려간 뿌리는
   * `rootedness` 에 그대로 세어지지만 여기서는 얕아진다.
   */
  rootQuality: RootQualityChart;
  /**
   * 종격 후보의 조건이 되는 사실 — **판정이 아니다.**
   *
   * 문턱을 고르지 않고도 셀 수 있는 것들만 낸다. 어디서 선을 긋는지가 계통
   * 선택이고 그것은 아직 하지 않았다(`FOLLOWING_PATTERN_POLICY`).
   */
  followingCandidacy: FollowingCandidacy;
  /**
   * 종격 판정 — **실험 규칙 v2.**
   *
   * 문턱은 고전이 아니라 이 엔진의 세력 분포를 재고 정한 값이라
   * `status: 'experimental'` 이고, 억부 후보를 뒤집지 않는다. v2 에서 바뀐 것은
   * 문턱이 아니라 입력이다 — 세력은 국과 합화를 반영한 실효 분포로, 뿌리는
   * 개수가 아니라 질로 잰다.
   */
  following: FollowingAssessment;
};

export type AnalysisOptions = {
  /**
   * 출생의 절대 시각. 주면 조후의 상·하반월까지 판정한다.
   *
   * 절기와 같은 시계다 — 경도 보정된 지방시로 중기를 재면 경계 근처에서 절반이
   * 뒤집힌다. 없으면 절반을 `null` 로 두고 조후표만 낸다.
   */
  instant?: Date;
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
  const effective = effectiveElementsOf(pillars, options.weights);
  const rootQuality = rootQualityOf(rootedness, pillars, effective.bureaus);

  return {
    elements,
    effectiveElements: effective,
    bureaus: effective.bureaus,
    tenGods,
    tenGodCounts: tenGodCountsOf(tenGods),
    // 오행 분포와 같은 가중치를 써야 두 결과가 어긋나지 않는다.
    strength,
    // 강약이 실효 분포에서 세력을 쟀으므로 억부도 같은 분포에서 「무엇이 가장
    // 무거운가」를 골라야 한다. 다르면 한 문장 안에서 같은 세력을 두 번 다르게 센다.
    eokbu: eokbuAssessmentOf(pillars, strength, options.weights, effective.distribution),
    johu: johuAssessmentOf(pillars, options.instant),
    rootedness,
    rootQuality,
    // 종격은 국과 합화를 반영한 실효 분포로 잰다 — 亥卯未가 木局을 이루면
    // 未를 土로 논하지 않는다는 말이 여기서 값을 낸다.
    followingCandidacy: followingCandidacyOf(pillars, effective.distribution, rootedness),
    following: followingAssessmentOf(
      pillars,
      effective.distribution,
      rootedness,
      rootQuality.dayMaster,
    ),
  };
}
