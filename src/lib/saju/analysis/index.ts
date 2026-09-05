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
import { favorabilityOf, type Favorability } from './favorability';
import { hiddenCombinationsOf, type HiddenCombination } from './hiddenRelations';
import { johuAssessmentOf, type JohuAssessment } from './johu';
import { rootednessOf, type Rootedness } from './rootedness';
import { rootQualityOf, type RootQualityChart } from './rootQuality';
import { strengthOf, type Strength, type StrengthOptions } from './strength';
import { structureOf, type Structure } from './structure';
import { judgementPrecedenceOf, type JudgementPrecedence } from './precedence';
import { tonggwanCandidacyOf, type TonggwanCandidacy } from './tonggwan';
import {
  eokbuAssessmentOf,
  yongsinAgreementOf,
  type EokbuAssessment,
  type YongsinAgreement,
} from './yongsin';
import { tenGodChartOf, tenGodCountsOf, type TenGod, type TenGodChart } from './tenGods';

export * from './bureau';
export * from './effectiveElements';
export * from './fiveElements';
export * from './followingPatterns';
export * from './johu';
export * from './favorability';
export * from './hiddenRelations';
export * from './rootedness';
export * from './rootQuality';
export * from './structure';
export * from './precedence';
export * from './tonggwan';
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
  /**
   * 《궁통보감》 일간×월지 조후 후보.
   *
   * 후보가 원국 어디에 있는지까지는 센다(`candidates`) — 「丙이 없으면」은
   * 사실이라 셀 수 있다. 「그러면 庚을 참작한다」는 여전히 판정이라 안 한다.
   */
  johu: JohuAssessment;
  /**
   * 격국(格局) — **월령에서 무엇을 쓰는가.**
   *
   * 억부와 답이 다를 수 있고, 뒤집지 않는다. 종격과 같은 자리인데 근거는 더
   * 얕다 — 종격에는 외부 명조 서른다섯 건의 대조가 있고 이쪽은 0 건이다.
   */
  structure: Structure;
  /**
   * 희용기구한 — **기신이 아니라 오신 배정이다.**
   *
   * 억부 후보를 용신 자리에 놓았을 때 나머지 넷이 어디에 오는가. 표 조회라
   * 계통이 갈리지 않고, 갈리는 것은 그 앞(용신을 무엇으로 잡았는가)이다.
   */
  favorability: Favorability;
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
   * 암합 — 지장간이 낀 합. **관계 표에 섞지 않는다.**
   *
   * 여덟 글자의 형충회합은 한 명식에 서넛이라 화면이 다 읽지만, 지장간까지
   * 펼치면 쌍이 수십으로 는다. 한 목록에 담으면 드러난 관계가 숨은 관계에
   * 파묻힌다.
   */
  hiddenCombinations: readonly HiddenCombination[];
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
  /**
   * 통관 후보의 재료 — **판정이 아니다.**
   *
   * 억부는 언제나 답을 하나 내지만, 두 세력이 팽팽히 맞선 명식에서는 그 물음이
   * 답을 못 낸다. 맞선 다섯 쌍과 그 사이를 잇는 오행을 세어만 둔다 — 얼마나
   * 맞서야 대치인가는 계통이 갈리는 문턱이라 여기서 긋지 않는다.
   */
  tonggwan: TonggwanCandidacy;
  /**
   * 억부와 조후가 같은 것을 가리키는가 — **대조지 판정이 아니다.**
   *
   * 두 후보가 화면에 나란히 서 있기만 하고 서로 무슨 관계인지는 아무도 말하지
   * 않았다. 어느 쪽이 우선인지는 여전히 정하지 않는다 — 그것은 한난조습을 재는
   * 자리가 있어야 답할 수 있고 이 엔진에 그 자리가 없다.
   */
  yongsinAgreement: YongsinAgreement;
  /**
   * 판정 사이의 서열 — **어긋날 때 무엇이 이기는가.**
   *
   * 억부·조후·종격·격국·통관은 한 명식에서 서로 다른 답을 낼 수 있다. 그 관계가
   * 여태 정책 상수에만 있어서, 자료를 받는 쪽은 **서열 없이 답 넷을 나란히** 받았다.
   * 여기 오는 값은 각 정책의 스위치를 그대로 읽은 것이고, 판정이 늘면 줄이 는다.
   */
  precedence: JudgementPrecedence;
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
  const eokbu = eokbuAssessmentOf(pillars, strength, options.weights, effective.distribution);
  const johu = johuAssessmentOf(pillars, options.instant);
  const agreement = yongsinAgreementOf(eokbu, johu);
  const structure = structureOf(pillars, effective.distribution);
  const tonggwan = tonggwanCandidacyOf(pillars, effective);
  const following = followingAssessmentOf(
    pillars,
    effective.distribution,
    rootedness,
    rootQuality.dayMaster,
  );

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
    eokbu,
    johu,
    // 두 후보를 견주기만 한다. 우선순위를 정하는 자리가 아니다.
    yongsinAgreement: agreement,
    // 격국도 강약·억부·종격과 같은 분포에서 세력을 잰다.
    structure,
    favorability: favorabilityOf(eokbu, effective.distribution),
    rootedness,
    rootQuality,
    hiddenCombinations: hiddenCombinationsOf(pillars),
    // 종격은 국과 합화를 반영한 실효 분포로 잰다 — 亥卯未가 木局을 이루면
    // 未를 土로 논하지 않는다는 말이 여기서 값을 낸다.
    followingCandidacy: followingCandidacyOf(pillars, effective.distribution, rootedness),
    // 통관은 강약·억부와 **같은 실효 분포**에서 잰다 — 한 화면 안에서 같은 세력을
    // 두 번 다르게 세지 않기 위해서다.
    tonggwan,
    following,
    /*
      **맨 뒤에 선다.** 서열 표는 위의 판정들을 읽어 세우므로 그것들이 다 나온 뒤라야
      한다. 여기서 판정을 새로 하지 않는다 — 각 정책의 스위치와 이미 나온 값만 읽는다.
    */
    precedence: judgementPrecedenceOf({
      eokbu,
      johu,
      agreement,
      following,
      structure,
      tonggwan,
    }),
  };
}
