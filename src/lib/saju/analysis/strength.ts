import {
  BRANCH_INFO,
  CONTROLLED_BY,
  CONTROLS,
  ELEMENTS,
  GENERATED_BY,
  GENERATES,
  HIDDEN_STEM_TOTAL_DAYS,
  STEM_INFO,
  type Element,
} from '../constants';
import type { Pillars } from '../pillars';
import { bureausOf } from './bureau';
import { effectiveElementsOf } from './effectiveElements';
import {
  elementDistributionOf,
  type DistributionInput,
  type ElementDistribution,
  type ElementWeights,
} from './fiveElements';
import { rootednessOf } from './rootedness';
import { gradeRooting, EFFECTIVE_ROOT_FLOOR } from './rootQuality';
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
 * **이것은 휴리스틱이지 확정된 고전 판정이 아니다.** 세 기준이 서로 겹친다 —
 * 득세 점수에 월지·일지가 이미 들어 있으므로 그 둘은 사실상 두 번 투표한다.
 * 고전의 삼자 판정 자체가 겹쳐 보는 방식이라 그대로 두었지만, "2개 이상이면
 * 신강"이라는 문턱은 우리가 고른 값이다(`requiredCriteria` 로 열려 있다).
 *
 * **세력비에 등급 이름을 붙이지 않는다.** 태약·중화·태왕 같은 이름은 근거
 * 있는 경계가 있어야 붙일 수 있는데, 우리에게는 그 경계의 출처가 없다.
 * 20%씩 다섯으로 끊는 것은 표기 편의일 뿐이고, 그렇게 끊은 값을 전통 판정처럼
 * 내보이면 없는 근거를 있는 것처럼 만든다. `ratio` 를 숫자 그대로 낸다.
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
  ruleSet: 'seasonal-roots-v2',
  /** 월지가 일간 편인가 — 득령 */
  useMonthCommand: true,
  /** 지장간을 사령 일수로 펼쳐 뿌리를 센다 — 득세 점수의 바탕 */
  useHiddenStemRoots: true,
  /** 비겁·인성을 아군, 식상·재성·관성을 상대 세력으로 본다 */
  useSupportingAndDrainingElements: true,
  /** 12운성은 점수에 넣지 않는다. 표시와 설명에만 쓴다 */
  twelveStageContribution: 'none',
  /** 득시(得時)는 따로 세지 않는다 — 시주 두 글자는 득세 점수에 이미 들어 있다 */
  criteria: 'season-branch-overall',
  /** 세력비를 구간으로 끊어 등급(태약·중화·태왕)을 붙이지 않는다 */
  gradeBands: 'none',
  /**
   * 득세 점수의 바탕 — **국(局)과 합화를 반영한 실효 분포다.**
   *
   * 종격이 실효 분포로 자당 몫을 재는데 강약이 글자 그대로의 분포로 세력을 재면,
   * 같은 명식에서 「亥卯未가 木局이라 未를 土로 논하지 않는다」와 「未는 土다」가
   * 나란히 서게 된다. 두 판정이 같은 세력을 다르게 세면 어느 쪽이 맞는지 알 수 없다.
   */
  basis: 'effective-distribution',
  /**
   * 투출(透出) 가산 — **구현했고 쟀는데 켜지 않았다.**
   *
   * 숨은 채로 있는 글자와 천간에 나와 있는 글자가 같은 무게일 수 없다는 것은
   * 계통 공통분모다(「透出者為用」). 그래서 `emergenceBonus` 로 열어 두었다.
   *
   * 켜지 않은 이유는 근거가 갈리지 않아서다. 억부 외부 대조 스무 건에서 가산을
   * 0.3·0.5·1.0 으로 올려도 강약 11/12 · 오행 11/20 이 **한 칸도 움직이지
   * 않았다.** 대신 무작위 3000건에서는 1.9% 의 강약 판정을 뒤집는다 — 아무 일도
   * 안 하는 것이 아니라, **어느 쪽이 맞는지 가릴 자료가 없는 채로 백에 둘의
   * 판정을 바꾸는 것**이다.
   *
   * 게다가 이 가산은 두 번 셀 위험이 있다. 투출한 천간 글자는 이미 무게 1 로
   * 세어져 있어서, 지지 쪽 몫을 또 올리는 것이 "드러나서 두껍다"인지 "같은
   * 글자를 두 번 센다"인지 자료 없이는 갈리지 않는다.
   *
   * 가릴 자료가 생기면 이 값을 올린다. 그전까지는 사실만 남긴다 —
   * 투출 자체는 `Analysis.rootedness.emergences` 가 이미 세고 있다.
   */
  emergenceBonus: 0,
  /**
   * 득령·득지를 무엇으로 보는가 — **십성 그대로다.**
   *
   * 「월지가 일간을 돕는가」를 통근의 질로 바꿔 재는 계통도 있어 옵션으로 열어
   * 두었다(`seat`). 기본을 바꾸지 않은 이유는 둘이다. 甲 일간의 子월처럼 인성이
   * 월령을 잡았으나 통근은 아닌 자리를 고전은 득령으로 읽고, 무엇보다 바꾸면
   * 모집단의 17.6% 가 뒤집히는데 그것을 받쳐 줄 자료가 한 칸뿐이다.
   */
  seat: 'ten-god',
  /**
   * 아직 **점수에 세지 않는** 것 — 투출 가산과 뿌리의 질.
   *
   * 둘 다 사실은 이미 세고 있다(`Analysis.rootedness.emergences` ·
   * `Analysis.rootQuality`). 여기서 안 센다는 뜻은 강약 **점수**에 가중치로
   * 넣지 않았다는 것이지 모른다는 뜻이 아니다.
   *
   * 뿌리의 질은 종격이 무근을 판정하는 데 쓴다. 강약 점수에 또 넣으면 득세
   * 점수에 이미 들어 있는 지장간 무게를 두 번 세게 된다 — 12운성을 넣지 않는
   * 것과 같은 이유다. 득령·득지를 통근의 질로 바꿔 보는 계통도 재어 보았는데
   * (`seat: 'root-quality'`), 억부 외부 대조에서 강약 한 칸이 좋아지는 대신
   * 모집단의 **17.6%** 가 뒤집혔다. 한 칸으로 살 수 있는 변화가 아니다.
   */
  unaccounted: 'stem-emergence-bonus, root-quality-weighting',
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
  /** 일간을 소모시키는 세력 (식상 + 재성 + 관성) */
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
  /**
   * 득세 점수를 무엇으로 잴 것인가.
   *
   * `literal` 은 글자를 있는 그대로 센 분포다 — 예전 셈으로 돌아가는 문이다.
   */
  basis?: 'literal' | 'effective';
  /** 투출 가산. 0 이면 투출을 안 보던 셈이다 */
  emergenceBonus?: number;
  /** 득령·득지를 십성으로 볼지 통근의 질로 볼지 */
  seat?: 'ten-god' | 'root-quality';
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
  basis: 'effective',
  emergenceBonus: STRENGTH_POLICY.emergenceBonus,
  seat: 'ten-god',
} as const satisfies Required<Omit<StrengthOptions, 'weights'>>;

/** 일간에서 본 오행이 아군인가 — 같은 오행(비겁)이거나 나를 낳는 오행(인성) */
function supports(dayMasterElement: Element, element: Element): boolean {
  return element === dayMasterElement || element === GENERATED_BY[dayMasterElement];
}

/** 강약 판정에 필요한 것은 네 기둥과 일간뿐이다 */
export type StrengthInput = DistributionInput & Pick<Pillars, 'dayMaster'>;

/**
 * 투출 가산을 얹은 분포.
 *
 * 지장간이 천간에 드러나 있으면 그 지장간의 몫을 `bonus` 만큼 더 센다. 천간
 * 글자 자체는 이미 세어져 있으므로 여기서 더 세는 것은 **지지 쪽 몫**이다 —
 * 드러난 뿌리가 숨은 뿌리보다 두껍다는 말을 무게로 옮긴 것이지, 같은 천간을
 * 두 번 세는 것이 아니다.
 */
function withEmergence(
  pillars: StrengthInput,
  distribution: ElementDistribution,
  weights: Partial<ElementWeights> | undefined,
  bonus: number,
): ElementDistribution {
  if (bonus === 0) return distribution;

  const { emergences } = rootednessOf(pillars);
  if (emergences.length === 0) return distribution;

  const branchWeight = weights?.branch ?? 1;
  const scores = { ...distribution.scores };

  for (const emergence of emergences) {
    const element = STEM_INFO[emergence.stem].element;
    const share = emergence.days / HIDDEN_STEM_TOTAL_DAYS;
    scores[element] += branchWeight * share * bonus;
  }

  const total = ELEMENTS.reduce((sum, element) => sum + scores[element], 0);
  const ratios = Object.fromEntries(
    ELEMENTS.map((element) => [element, total === 0 ? 0 : scores[element] / total]),
  ) as Record<Element, number>;
  const ranked = [...ELEMENTS].sort((a, b) => scores[b] - scores[a]);

  return {
    ...distribution,
    scores,
    ratios,
    strongest: ranked[0],
    weakest: ranked[ranked.length - 1],
  };
}

export function strengthOf(pillars: StrengthInput, options: StrengthOptions = {}): Strength {
  const {
    weights,
    overallThreshold = DEFAULT_STRENGTH_OPTIONS.overallThreshold,
    requiredCriteria = DEFAULT_STRENGTH_OPTIONS.requiredCriteria,
    includeDayMaster = DEFAULT_STRENGTH_OPTIONS.includeDayMaster,
    basis = DEFAULT_STRENGTH_OPTIONS.basis,
    emergenceBonus = DEFAULT_STRENGTH_OPTIONS.emergenceBonus,
    seat = DEFAULT_STRENGTH_OPTIONS.seat,
  } = options;

  const dayMaster = pillars.dayMaster;
  const dayMasterElement = STEM_INFO[dayMaster].element;

  const distribution = withEmergence(
    pillars,
    basis === 'effective'
      ? effectiveElementsOf(pillars, weights).distribution
      : elementDistributionOf(pillars, weights),
    weights,
    emergenceBonus,
  );

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

  // 득령·득지를 통근의 질로 보는 계통을 옵션으로 열어 둔다 — 기본은 십성이다.
  const seatByRoot = (position: 'month' | 'day') => {
    const rooted = gradeRooting(
      rootednessOf(pillars).dayMaster,
      pillars,
      bureausOf(pillars),
    );
    return rooted.roots
      .filter((graded) => graded.root.position === position)
      .reduce((sum, graded) => sum + graded.strength, 0) >= EFFECTIVE_ROOT_FLOOR;
  };

  const seasonalMet =
    seat === 'ten-god' ? SUPPORTING_GROUPS.includes(TEN_GOD_GROUP[seasonalGod]) : seatByRoot('month');
  const branchMet =
    seat === 'ten-god' ? SUPPORTING_GROUPS.includes(TEN_GOD_GROUP[branchGod]) : seatByRoot('day');
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
      detail: `보조 세력이 전체의 ${(ratio * 100).toFixed(1)}% (기준 ${(overallThreshold * 100).toFixed(0)}%)`,
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
