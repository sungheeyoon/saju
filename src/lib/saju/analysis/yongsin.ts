import {
  CONTROLLED_BY,
  CONTROLS,
  ELEMENT_KO,
  GENERATED_BY,
  GENERATES,
  STEM_INFO,
  type Element,
} from '../constants';
import { elementDistributionOf, type DistributionInput } from './fiveElements';
import type { Strength, StrengthInput } from './strength';

/**
 * 용신(用神) — 이 사주에 가장 필요한 오행.
 *
 * 용신을 잡는 길은 하나가 아니다. 크게 넷이 쓰인다.
 *
 *   억부(抑扶)  넘치면 누르고 모자라면 돕는다. 신강·신약에서 곧장 나온다.
 *   조후(調候)  춥고 더움을 고른다. 궁통보감의 일간×월지 표를 따른다.
 *   통관(通關)  맞선 두 세력 사이를 잇는다.
 *   병약(病藥)  사주의 병이 된 글자를 치는 약을 쓴다.
 *
 * **여기서는 억부 판정과 조후 참고표를 낸다.** 둘의 검증 수준은 다르다.
 *
 * - **조후**는 궁통보감의 120칸(일간 10 × 월지 12) 원문과 정리표를 대조해
 *   `johu.ts`에 담았다. 다만 같은 칸에서도 원국의 구성과 월의 상·하순에 따라
 *   우선순위가 바뀐다. 그 조건을 전부 자동 판정하지 않았으므로 확정 용신이
 *   아니라 `status: 'reference'` 인 후보 천간과 조건 요약으로만 낸다.
 * - **통관·병약**은 억부·조후로 잡히지 않는 사주에 쓰는 예외 규칙이라,
 *   "언제 통관으로 갈아타는가"의 판정이 먼저다. 그 판정이 계통마다 갈린다.
 * - **종격(從格)**은 신강·신약의 극단에서 대세를 따르는 것인데, 종이 성립하는
 *   조건 자체가 갈린다. 억부용신과 정반대 답을 내므로 조건을 확정하기 전에
 *   섞으면 안 된다.
 *
 * 억부는 다르다. 신강·신약과 세력 분포에서 규칙으로 나오고, 그 규칙이 고전에
 * 일관된다. 그래서 이것만 먼저 낸다.
 *
 * **그렇다고 억부 하나로 용신이 확정되지는 않는다.** 아래 규칙은 방향을
 * 설명하는 입문 수준이고, 월령의 실제 세력 차이·투간과 통근의 질·합충으로
 * 뿌리가 바뀌는 경우·한습조열·후보 오행을 실제로 쓸 수 있는지·종격 가능성·
 * 격국의 성패·같은 오행 안에서 어느 천간이 필요한지를 전부 보지 않는다.
 * 그래서 결과를 `EokbuAssessment` 로 내고 `status: 'experimental'` 을 값으로
 * 박는다. "용신은 木이다"가 아니라 "억부 관점의 후보는 木이다"이다.
 *
 * **기신도 내지 않는다.** 용신을 극하는 오행이 곧 기신인 것이 아니다. 기신은
 * 명식 전체에서 용신 작용을 방해하고 병을 키우는 요소를 봐야 정해지지,
 * 오행 상극표 한 줄로 결정되지 않는다.
 */

/**
 * 이 판정이 아직 보지 못한 것들.
 *
 * 하나라도 남아 있으면 "용신은 X 다"라고 말할 수 없다. 결과에 함께 실어
 * 쓰는 쪽이 무게를 스스로 정하게 한다.
 */
export type UnresolvedFactor =
  | 'followingPattern'
  | 'climate'
  | 'structure'
  | 'combinationEffects'
  | 'rootQuality';

export const UNRESOLVED_FACTOR_KO: Record<UnresolvedFactor, string> = {
  followingPattern: '종격 여부',
  climate: '조후 조건 판정',
  structure: '격국의 성패',
  combinationEffects: '합충으로 인한 뿌리 변화',
  rootQuality: '투간·통근의 질',
};

/** 억부 하나만 보고는 확정할 수 없는 것들 — 조후도 조건 판정 전이라 남는다 */
const UNRESOLVED: readonly UnresolvedFactor[] = [
  'followingPattern',
  'climate',
  'structure',
  'combinationEffects',
  'rootQuality',
];

/** 일간에서 본 오행의 자리 — 십성을 오행 단위로 묶은 것 */
export type ElementRole = '比劫' | '印星' | '食傷' | '財星' | '官星';

export const ELEMENT_ROLE_KO: Record<ElementRole, string> = {
  比劫: '비겁',
  印星: '인성',
  食傷: '식상',
  財星: '재성',
  官星: '관성',
};

/**
 * 억부 관점에서 나온 **후보 하나**. 용신 확정값이 아니다.
 *
 * 이름을 `Yongsin` 이 아니라 `EokbuAssessment` 로 둔 것은 그래서다. 억부는
 * 용신을 잡는 네 길 중 하나일 뿐이고, 나머지 셋을 보지 않은 답을 "용신"이라
 * 부르면 실제 검증 수준보다 강하게 말하는 것이 된다.
 */
export type EokbuAssessment = {
  /** 아직 시험 단계임을 값으로 못박는다 */
  status: 'experimental';
  /** 억부 관점에서 나온 오행 */
  suggestedElement: Element;
  /** 그 오행이 일간에게 무엇인가 */
  role: ElementRole;
  /** 억부 하나만 보았으므로 언제나 낮다 */
  confidence: 'low';
  /** 왜 이것이 나왔는가 — 화면에 그대로 쓸 수 있는 한 문장 */
  reason: string;
  /**
   * 후보 오행이 원국 여덟 글자 안에 실제로 있는가.
   *
   * 없는 오행을 쓰라고 해도 쓸 것이 없다. 해석이 아니라 사실이라 함께 낸다.
   */
  presentInChart: boolean;
  /** 아직 판정하지 않은 것들 */
  unresolved: readonly UnresolvedFactor[];
};

/** 일간 오행에서 본 다섯 자리의 오행 */
export function elementRolesOf(dayMasterElement: Element): Record<ElementRole, Element> {
  return {
    比劫: dayMasterElement,
    印星: GENERATED_BY[dayMasterElement],
    食傷: GENERATES[dayMasterElement],
    財星: CONTROLS[dayMasterElement],
    官星: CONTROLLED_BY[dayMasterElement],
  };
}

/**
 * 채택한 규칙. `STRENGTH_POLICY` 와 짝이다 — 골든 스냅샷이 함께 찍는다.
 */
export const YONGSIN_POLICY = {
  ruleSet: 'eokbu-with-johu-reference-v2',
  /** 확정값이 아니라 시험값으로 낸다 */
  status: 'experimental',
  /** 억부는 시험 판정, 조후는 원문 참고표로 함께 낸다 */
  methods: 'eokbu-and-johu-reference',
  /** 기신은 판정하지 않는다 — 오행 상극표로 정해지는 것이 아니다 */
  unfavorable: 'not-judged',
  /** 조후 조건은 자동 판정하지 않는다 */
  johu: 'qiongtong-baojian-120-reference',
  /** 종격 판정을 하지 않으므로 극단적으로 치우친 사주도 억부로 답한다 */
  followingPattern: 'not-judged',
} as const;

type YongsinInput = StrengthInput & DistributionInput;

/**
 * 억부용신을 잡는다.
 *
 * 신약이면 무엇이 일간을 가장 많이 괴롭히는지 보고 그에 맞는 약을 쓴다.
 *
 *   관성이 가장 무겁다 → 인성. 관인상생으로 살을 돌려 나를 돕게 한다.
 *   식상이 가장 무겁다 → 인성. 인성이 식상을 눌러 설기를 막는다.
 *   재성이 가장 무겁다 → 비겁. 재가 무거우면 인성을 극하므로 인성으로 못 받고,
 *                        비겁이 나서서 재를 나눈다(군겁쟁재의 반대 방향).
 *
 * 신강이면 무엇이 일간을 지나치게 밀어주는지 본다.
 *
 *   인성이 가장 무겁다 → 재성. 재극인으로 과한 생조를 끊는다.
 *   비겁이 가장 무겁다 → 관성. 관살로 비겁을 제어한다. 다만 원국에 관성
 *                        오행이 아예 없으면 제어할 손이 없으므로 식상으로
 *                        설기한다.
 */
export function eokbuAssessmentOf(
  pillars: YongsinInput,
  strength: Strength,
  weights?: Parameters<typeof elementDistributionOf>[1],
): EokbuAssessment {
  const dayMasterElement = STEM_INFO[pillars.dayMaster].element;
  const roles = elementRolesOf(dayMasterElement);
  const { scores, counts } = elementDistributionOf(pillars, weights);

  const heaviestOf = (candidates: readonly ElementRole[]): ElementRole =>
    [...candidates].sort((a, b) => scores[roles[b]] - scores[roles[a]])[0];

  const ko = (element: Element) => ELEMENT_KO[element];

  let role: ElementRole;
  let reason: string;

  if (strength.verdict === 'weak') {
    const burden = heaviestOf(['官星', '食傷', '財星']);

    role = burden === '財星' ? '比劫' : '印星';
    reason =
      burden === '財星'
        ? `신약한데 재성(${ko(roles.財星)})이 가장 무겁습니다. 재가 인성을 극해 생조를 받기 어려우므로, 비겁(${ko(roles.比劫)})으로 재를 나눕니다.`
        : `신약한데 ${ELEMENT_ROLE_KO[burden]}(${ko(roles[burden])})이 가장 무겁습니다. 인성(${ko(roles.印星)})이 그 기운을 돌려 일간을 돕습니다.`;
  } else {
    const excess = heaviestOf(['印星', '比劫']);

    if (excess === '印星') {
      role = '財星';
      reason = `신강한데 인성(${ko(roles.印星)})이 가장 무겁습니다. 재성(${ko(roles.財星)})으로 과한 생조를 끊습니다.`;
    } else if (scores[roles.官星] > 0) {
      role = '官星';
      reason = `신강한데 비겁(${ko(roles.比劫)})이 가장 무겁습니다. 관성(${ko(roles.官星)})으로 눌러 다스립니다.`;
    } else {
      // 제어할 관성이 원국에 없으면 눌러 봐야 붙잡을 것이 없다. 설기로 돌린다.
      role = '食傷';
      reason = `신강한데 비겁(${ko(roles.比劫)})이 가장 무거운데 관성(${ko(roles.官星)})이 없습니다. 식상(${ko(roles.食傷)})으로 빼냅니다.`;
    }
  }

  const suggestedElement = roles[role];

  return {
    status: 'experimental',
    suggestedElement,
    role,
    confidence: 'low',
    reason,
    presentInChart: counts[suggestedElement] > 0,
    unresolved: UNRESOLVED,
  };
}
