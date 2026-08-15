import {
  BRANCH_INFO,
  CONTROLLED_BY,
  CONTROLS,
  ELEMENTS,
  GENERATED_BY,
  GENERATES,
  STEM_INFO,
  type Element,
} from '../constants';
import type { Pillars } from '../pillars';
import {
  elementDistributionOf,
  type DistributionInput,
  type ElementWeights,
} from './fiveElements';
import { TEN_GOD_GROUP, TEN_GOD_KO, tenGodOfBranch, type TenGodGroup } from './tenGods';

/**
 * 신강·신약 — 일간이 버틸 힘이 있는가.
 *
 * 고전은 세 가지를 본다.
 *   득령(得令) 월지가 일간 편인가 — 계절을 쥐므로 가장 무겁다
 *   득지(得地) 일지가 일간 편인가 — 일간이 깔고 앉은 자리
 *   득세(得勢) 나머지를 합친 세력이 일간 편인가
 *
 * 이 중 몇 개를 채워야 신강인지, 세력을 어떻게 셀지는 계통마다 다르다.
 * 여기서는 기본값을 두되 전부 옵션으로 열어두고, 판정 근거를 함께 반환한다.
 *
 * 시간 미상이면 여섯 글자로 판정한다. 득령·득지는 월지·일지만 보므로 그대로지만,
 * 득세는 시주 두 글자가 빠진 세력비다. 시주가 어느 편이었는지에 따라 결론이
 * 뒤집힐 수 있다 — 그래서 `hourKnown: false` 일 때 경고를 남긴다.
 *
 * **12운성은 여기에 넣지 않는다.** 넣고 싶어지는 순간이 오므로 이유를 남긴다.
 *
 * 12운성은 일간이 각 지지에서 어느 생애 단계로 표현되는가를 보여주는 상태표이고,
 * 신강·신약은 계절과 뿌리로 재는 세력 계산이다. 둘은 자주 같은 방향을 가리키지만
 * 같은 값이 아니다. `乙`의 장생은 `午`인데 午의 지장간은 丙己丁이라 木의 뿌리가
 * 하나도 없고, 여름 화기는 오히려 목을 설기한다. "장생이니 신강 쪽"이라고 점수를
 * 주면 통근·계절 판단과 정면으로 충돌한다.
 *
 * 반대로 `甲`의 건록 `寅`·제왕 `卯`가 실제로 강한 근거인 것은 이름이 건록·제왕이라서가
 * 아니라 지장간에 木이 있어 통근하기 때문이다. 그 몫은 아래 `elementDistributionOf`
 * 가 지장간을 사령 일수로 펼치면서 이미 세고 있다. 12운성으로 한 번 더 더하면
 * 같은 사실을 두 번 세는 것이 된다.
 *
 * 그래서 12운성은 계산 결과를 설명하는 보조 문구로만 쓴다 — "甲은 寅에 통근한다.
 * 12운성으로도 건록이다" 에서 둘째 문장은 첫째를 보강할 뿐 점수를 더하지 않는다.
 * 장생·건록·제왕에 고정 점수를 주는 계통이 있는데, 그것은 틀렸다기보다 **다른
 * 계산법**이다. 지원한다면 이 결과에 조용히 섞지 말고 계산법 자체를 갈라야 한다.
 */

/**
 * 채택한 강약 계산법. `RELATION_POLICY`·`SINSAL_POLICY` 와 같은 구실을 한다 —
 * 골든 스냅샷이 찍으므로 계산법이 바뀌면 diff 맨 위에서 먼저 드러난다.
 */
export const STRENGTH_POLICY = {
  ruleSet: 'seasonal-roots-v1',
  /** 월지가 일간 편인가 — 득령 */
  useMonthCommand: true,
  /** 지장간을 사령 일수로 펼쳐 뿌리를 센다 — 득세 점수의 바탕 */
  useHiddenStemRoots: true,
  /** 비겁·인성을 아군, 식상·재성·관성을 상대 세력으로 본다 */
  useSupportingAndDrainingElements: true,
  /** 12운성은 점수에 넣지 않는다. 표시와 설명에만 쓴다 */
  twelveStageContribution: 'none',
  /** 아직 세지 않는 것 — 지장간의 천간 투출, 합충으로 인한 뿌리 변화 */
  unaccounted: 'stem-emergence, combination-clash-effects',
} as const;

/** 일간을 돕는 십성 계열 — 나와 같거나(비겁) 나를 낳는 것(인성) */
const SUPPORTING_GROUPS: readonly TenGodGroup[] = ['比劫', '印星'];

export type StrengthVerdict = 'strong' | 'weak';

export type StrengthCriterion = {
  key: 'seasonal' | 'branch' | 'overall';
  label: string;
  met: boolean;
  detail: string;
};

export type Strength = {
  verdict: StrengthVerdict;
  /** 일간을 돕는 세력 (비겁 + 인성) */
  supportScore: number;
  /** 일간을 빼는 세력 (식상 + 재성 + 관성) */
  opposeScore: number;
  /** supportScore / (supportScore + opposeScore) */
  ratio: number;
  criteria: StrengthCriterion[];
  /** 충족한 기준 수 */
  metCount: number;
  /**
   * 억부(抑扶) 기준으로 필요한 오행.
   * 신강이면 힘을 빼는 쪽, 신약이면 힘을 보태는 쪽을 고른다.
   * 격국·조후를 함께 보는 계통에서는 결론이 달라질 수 있다.
   */
  neededElements: Element[];
};

export type StrengthOptions = {
  weights?: Partial<ElementWeights>;
  /** 득세 판정 임계 비율 */
  overallThreshold?: number;
  /** 세 기준 중 몇 개를 채우면 신강으로 볼지 */
  requiredCriteria?: number;
  /**
   * 일간 자신의 무게를 아군 세력에 포함할지.
   *
   * 기본은 제외다. 신강·신약은 "일간을 둘러싼 환경이 일간 편인가"를 재는 것이라,
   * 판정 대상인 일간을 세력에 넣으면 스스로를 근거로 삼는 셈이 된다.
   */
  includeDayMaster?: boolean;
};

export const DEFAULT_STRENGTH_OPTIONS = {
  overallThreshold: 0.5,
  requiredCriteria: 2,
  includeDayMaster: false,
} as const;

/** 일간에서 본 오행이 아군인가 — 같은 오행(비겁)이거나 나를 낳는 오행(인성) */
function supports(dayMasterElement: Element, element: Element): boolean {
  return element === dayMasterElement || element === GENERATED_BY[dayMasterElement];
}

/** 강약 판정에 필요한 것은 네 기둥과 일간뿐이다 */
export type StrengthInput = DistributionInput & Pick<Pillars, 'dayMaster'>;

export function strengthOf(pillars: StrengthInput, options: StrengthOptions = {}): Strength {
  const {
    weights,
    overallThreshold = DEFAULT_STRENGTH_OPTIONS.overallThreshold,
    requiredCriteria = DEFAULT_STRENGTH_OPTIONS.requiredCriteria,
    includeDayMaster = DEFAULT_STRENGTH_OPTIONS.includeDayMaster,
  } = options;

  const dayMaster = pillars.dayMaster;
  const dayMasterElement = STEM_INFO[dayMaster].element;

  const distribution = elementDistributionOf(pillars, weights);

  let supportScore = 0;
  let opposeScore = 0;
  for (const element of ELEMENTS) {
    if (supports(dayMasterElement, element)) supportScore += distribution.scores[element];
    else opposeScore += distribution.scores[element];
  }

  // 판정 대상인 일간 자신의 무게는 기본적으로 아군에서 뺀다.
  if (!includeDayMaster) {
    supportScore -= weights?.stem ?? 1;
  }

  const total = supportScore + opposeScore;
  const ratio = total === 0 ? 0 : supportScore / total;

  const seasonalGod = tenGodOfBranch(dayMaster, pillars.month.branch);
  const branchGod = tenGodOfBranch(dayMaster, pillars.day.branch);

  const seasonalMet = SUPPORTING_GROUPS.includes(TEN_GOD_GROUP[seasonalGod]);
  const branchMet = SUPPORTING_GROUPS.includes(TEN_GOD_GROUP[branchGod]);
  const overallMet = ratio > overallThreshold;

  const criteria: StrengthCriterion[] = [
    {
      key: 'seasonal',
      label: '득령',
      met: seasonalMet,
      detail: `월지 ${pillars.month.branch}(${BRANCH_INFO[pillars.month.branch].ko})가 ${TEN_GOD_KO[seasonalGod]}이라 일간을 ${seasonalMet ? '돕는다' : '돕지 않는다'}`,
    },
    {
      key: 'branch',
      label: '득지',
      met: branchMet,
      detail: `일지 ${pillars.day.branch}(${BRANCH_INFO[pillars.day.branch].ko})가 ${TEN_GOD_KO[branchGod]}이라 일간을 ${branchMet ? '돕는다' : '돕지 않는다'}`,
    },
    {
      key: 'overall',
      label: '득세',
      met: overallMet,
      detail: `아군 세력이 전체의 ${(ratio * 100).toFixed(1)}% (기준 ${(overallThreshold * 100).toFixed(0)}%)`,
    },
  ];

  const metCount = criteria.filter((c) => c.met).length;
  const verdict: StrengthVerdict = metCount >= requiredCriteria ? 'strong' : 'weak';

  const neededElements =
    verdict === 'strong'
      ? // 신강 — 빼내고 눌러야 한다 (식상·재성·관성)
        [GENERATES[dayMasterElement], CONTROLS[dayMasterElement], CONTROLLED_BY[dayMasterElement]]
      : // 신약 — 보태고 받쳐야 한다 (비겁·인성)
        [dayMasterElement, GENERATED_BY[dayMasterElement]];

  return {
    verdict,
    supportScore,
    opposeScore,
    ratio,
    criteria,
    metCount,
    neededElements,
  };
}
