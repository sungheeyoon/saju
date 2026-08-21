import {
  CONTROLLED_BY,
  ELEMENTS,
  ELEMENT_KO,
  GENERATED_BY,
  type Element,
} from '../constants';
import type { ElementDistribution } from './fiveElements';
import type { EokbuAssessment } from './yongsin';

/**
 * 희용기구한(喜用忌仇閑) — **용신을 중심으로 다섯 오행에 자리를 준다.**
 *
 * 이 저장소는 여태 기신을 내지 않았고, 그 이유를 `YONGSIN_POLICY.unfavorable`
 * 에 적어 두었다. 「용신을 극하는 오행이 곧 기신인 것이 아니다」 — 맞는 말이다.
 * 기신은 명식 전체에서 용신 작용을 방해하고 병을 키우는 것을 봐야 정해지지
 * 오행 상극표 한 줄로 결정되지 않는다.
 *
 * 그래서 여기서 내는 것은 **기신이 아니라 오신 배정(五神)이다.** 둘은 다르다.
 *
 *   기신    이 명식의 병이 무엇인가 — 명식 전체를 읽어야 나온다
 *   오신    고른 용신을 기준으로 다섯 오행을 상생상극으로 늘어놓은 것
 *
 * 오신 배정은 용신 하나가 정해지면 **표에서 곧장 나온다.** 용신을 생하는 것이
 * 희신, 용신을 극하는 것이 기신, 기신을 생하는 것이 구신, 남는 하나가 한신이다.
 * 이것은 판정이 아니라 표 조회라서 계통이 갈리지 않는다.
 *
 * **갈리는 것은 그 앞이다** — 용신을 무엇으로 잡았는가. 우리 용신은 억부 하나만
 * 본 시험값이므로(`EokbuAssessment.confidence === 'low'`), 그 위에 세운 이 배정도
 * 그보다 셀 수 없다. `basis` 에 무엇에서 나왔는지를 값으로 싣고, 억부가 아직
 * 보지 못한 것들(`unresolved`)을 그대로 물려받는다.
 *
 * 한 줄로 줄이면 이렇다. **"기신은 금(金)입니다"가 아니라 "억부 후보를 용신으로
 * 놓으면 금이 기신 자리에 온다"이다.**
 */

export const FAVORABILITY_POLICY = {
  ruleSet: 'five-role-from-yongsin-v1',
  /** 용신이 시험값이라 이 배정도 시험값이다 */
  status: 'experimental',
  /** 다섯 자리는 상생상극 표에서 곧장 나온다 — 여기서 문턱을 고르지 않는다 */
  derivation: 'table-from-chosen-yongsin',
  /** 용신을 무엇으로 잡았는가. 이것이 갈리면 다섯 자리가 통째로 갈린다 */
  basis: 'eokbu-candidate',
  /**
   * **병(病)은 판정하지 않는다.**
   *
   * 기신 자리에 온 오행이 원국에 실제로 얼마나 있는지는 사실이라 함께 낸다
   * (`presence`). 그러나 「그래서 이 명식의 병이다」는 별개의 판정이고, 그것을
   * 하려면 용신이 확정돼야 한다. 아직 아니다.
   */
  disease: 'not-judged',
} as const;

/** 용신을 기준으로 본 다섯 자리 */
export type FavorRole =
  /** 용신(用神) — 이 명식에 가장 필요하다고 본 오행 */
  | 'yongsin'
  /** 희신(喜神) — 용신을 낳아 돕는다 */
  | 'helper'
  /** 기신(忌神) — 용신을 극한다 */
  | 'adversary'
  /** 구신(仇神) — 기신을 낳아 키운다 */
  | 'accomplice'
  /** 한신(閑神) — 어느 쪽도 아닌 나머지 하나 */
  | 'neutral';

export const FAVOR_ROLE_KO: Record<FavorRole, string> = {
  yongsin: '용신',
  helper: '희신',
  adversary: '기신',
  accomplice: '구신',
  neutral: '한신',
};

export type FavorSeat = {
  role: FavorRole;
  element: Element;
  /** 원국 여덟 글자에 그 오행이 몇 자 보이는가 */
  count: number;
  /** 실효 분포에서의 비중 */
  ratio: number;
  /** 사람이 읽는 한 줄 */
  detail: string;
};

export type Favorability = {
  /** 용신이 시험값이므로 이 배정도 시험값이다 */
  status: 'experimental';
  /** 무엇을 용신으로 놓았는가 */
  basis: 'eokbu-candidate';
  /** 용신이 시험값이라 언제나 낮다 */
  confidence: 'low';
  seats: readonly FavorSeat[];
  /** 자리로 찾아 쓰는 표 */
  byRole: Record<FavorRole, Element>;
  /** 억부가 아직 보지 못한 것들 — 그대로 물려받는다 */
  unresolved: EokbuAssessment['unresolved'];
};

/**
 * 용신 하나에서 다섯 자리를 배정한다.
 *
 * 표 조회이므로 규칙이랄 것이 없다. 값이 있는 곳은 `eokbu` 하나이고, 그것이
 * 시험값이라는 사실이 결과에 그대로 실린다.
 */
export function favorabilityOf(
  eokbu: EokbuAssessment,
  elements: ElementDistribution,
): Favorability {
  const yongsin = eokbu.suggestedElement;
  const helper = GENERATED_BY[yongsin];
  const adversary = CONTROLLED_BY[yongsin];
  const accomplice = GENERATED_BY[adversary];

  const assigned = [yongsin, helper, adversary, accomplice];
  // 다섯에서 넷을 빼면 하나가 남는다. 오행이 다섯이라 언제나 정확히 하나다.
  const neutral = ELEMENTS.find((element) => !assigned.includes(element))!;

  const byRole: Record<FavorRole, Element> = {
    yongsin,
    helper,
    adversary,
    accomplice,
    neutral,
  };

  const explain: Record<FavorRole, string> = {
    yongsin: '억부 관점에서 고른 후보입니다.',
    helper: `${ELEMENT_KO[helper]}이(가) ${ELEMENT_KO[yongsin]}을(를) 낳아 돕습니다.`,
    adversary: `${ELEMENT_KO[adversary]}이(가) ${ELEMENT_KO[yongsin]}을(를) 극합니다.`,
    accomplice: `${ELEMENT_KO[accomplice]}이(가) ${ELEMENT_KO[adversary]}을(를) 낳아 키웁니다.`,
    neutral: '용신에도 기신에도 직접 걸리지 않는 나머지입니다.',
  };

  const seats = (Object.keys(byRole) as FavorRole[]).map((role): FavorSeat => {
    const element = byRole[role];
    return {
      role,
      element,
      count: elements.counts[element],
      ratio: elements.ratios[element],
      detail: explain[role],
    };
  });

  return {
    status: 'experimental',
    basis: 'eokbu-candidate',
    confidence: 'low',
    seats,
    byRole,
    unresolved: eokbu.unresolved,
  };
}
