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
import type { FourPillars } from '../pillars';
import { elementDistributionOf, type ElementWeights } from './fiveElements';
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
 */

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

export function strengthOf(pillars: FourPillars, options: StrengthOptions = {}): Strength {
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
