import {
  BRANCH_INFO,
  ELEMENTS,
  HIDDEN_STEMS,
  HIDDEN_STEM_TOTAL_DAYS,
  STEM_INFO,
  type Element,
} from '../constants';
import type { FourPillars } from '../pillars';
import { PILLAR_KEYS, type PillarKey } from './tenGods';

/**
 * 오행 분포 — 여덟 글자가 어느 오행에 얼마나 몰려 있는가.
 *
 * 두 가지로 센다.
 * - `counts` 는 눈에 보이는 여덟 글자만 센다. "팔자에 없는 오행"은 이 기준이다.
 * - `scores` 는 지지를 지장간으로 펼쳐 사령 일수로 나눠 담는다. 예를 들어 寅은
 *   戊 7일·丙 7일·甲 16일이므로 목에 16/30, 화에 7/30, 토에 7/30이 간다.
 */

export type ElementWeights = {
  /** 천간 한 글자의 무게 */
  stem: number;
  /** 지지 한 글자의 무게 — 지장간에 일수 비율로 나뉜다 */
  branch: number;
  /**
   * 월지에 추가로 곱하는 계수.
   *
   * 월지는 계절을 정하므로 다른 자리보다 무겁게 보는 계통이 많다.
   * 배수를 얼마로 할지는 정해진 값이 없어 기본은 1(가중 없음)로 둔다.
   */
  monthBranchMultiplier: number;
};

export const DEFAULT_ELEMENT_WEIGHTS: ElementWeights = {
  stem: 1,
  branch: 1,
  monthBranchMultiplier: 1,
};

export type ElementDistribution = {
  /** 여덟 글자의 단순 개수 (지지는 본기 오행) — 합 8 */
  counts: Record<Element, number>;
  /** 지장간 일수로 가중한 점수 */
  scores: Record<Element, number>;
  /** `scores` 를 합 1로 정규화 */
  ratios: Record<Element, number>;
  /** 점수가 가장 높은 오행 */
  strongest: Element;
  /** 점수가 가장 낮은 오행 */
  weakest: Element;
  /** 여덟 글자에 아예 없는 오행 */
  missing: Element[];
};

function emptyTally(): Record<Element, number> {
  return Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
}

export function elementDistributionOf(
  pillars: FourPillars,
  weights: Partial<ElementWeights> = {},
): ElementDistribution {
  const { stem, branch, monthBranchMultiplier } = { ...DEFAULT_ELEMENT_WEIGHTS, ...weights };

  const counts = emptyTally();
  const scores = emptyTally();

  for (const key of PILLAR_KEYS as readonly PillarKey[]) {
    const pillar = pillars[key];
    const branchWeight = branch * (key === 'month' ? monthBranchMultiplier : 1);

    // 천간은 그대로 한 글자
    counts[STEM_INFO[pillar.stem].element] += 1;
    scores[STEM_INFO[pillar.stem].element] += stem;

    // 지지는 본기로 세되, 점수는 지장간에 일수 비율로 나눠 담는다
    counts[BRANCH_INFO[pillar.branch].element] += 1;
    for (const hidden of HIDDEN_STEMS[pillar.branch]) {
      const share = hidden.days / HIDDEN_STEM_TOTAL_DAYS;
      scores[STEM_INFO[hidden.stem].element] += branchWeight * share;
    }
  }

  const total = ELEMENTS.reduce((sum, e) => sum + scores[e], 0);
  const ratios = emptyTally();
  for (const element of ELEMENTS) {
    ratios[element] = total === 0 ? 0 : scores[element] / total;
  }

  const ranked = [...ELEMENTS].sort((a, b) => scores[b] - scores[a]);

  return {
    counts,
    scores,
    ratios,
    strongest: ranked[0],
    weakest: ranked[ranked.length - 1],
    missing: ELEMENTS.filter((e) => counts[e] === 0),
  };
}
