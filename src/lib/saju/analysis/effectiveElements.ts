import { ELEMENTS, HIDDEN_STEMS, STEM_INFO, type Element } from '../constants';
import type { Pillars } from '../pillars';
import type { PillarPosition } from '../position';
import { bureausOf, type Bureau } from './bureau';
import {
  DEFAULT_ELEMENT_WEIGHTS,
  elementDistributionOf,
  hiddenStemShares,
  type ElementDistribution,
  type ElementWeights,
} from './fiveElements';
import type { PillarKey } from './tenGods';
import { stemTransformationsOf, type StemTransformation } from './transformation';

/**
 * 실효 오행 분포 — **합화와 국(局)을 반영한 세력.**
 *
 * `elementDistributionOf` 는 글자를 있는 그대로 센다. 그것이 바탕이어야 한다 —
 * 무엇을 반영했는지 견주려면 반영하지 않은 값이 남아 있어야 하기 때문이다.
 * 그래서 이 함수는 분포를 갈아치우지 않고 **둘을 나란히 낸다**(`base`·`distribution`).
 *
 * 옮긴 무게는 한 건씩 `shifts` 에 적는다. 어느 글자의 무게가 어디로 얼마나
 * 갔는지 적어 두지 않으면, 분포가 달라진 이유를 나중에 되짚을 수 없다.
 *
 * **합에 일간이 끼면 무게를 옮기지 않는다.** 일간이 化하면 일간의 오행이 바뀌고,
 * 그러면 비겁·인성·재성이 통째로 다시 배정된다 — 그것은 분포 보정이 아니라
 * 화격(化格) 판정이고, 아직 채택하지 않았다. 사실은 `transformations` 에 그대로
 * 남으므로, 화격을 채택하는 날 여기가 아니라 그 판정에서 읽으면 된다.
 */

export const EFFECTIVE_ELEMENTS_POLICY = {
  ruleSet: 'effective-elements-v1',
  status: 'experimental',
  /** 바탕 분포를 지우지 않고 함께 낸다 */
  keepsBase: true,
  /** 합화가 성립하면 두 천간의 무게가 통째로 화신으로 간다 */
  transformedStemShift: 'full',
  /** 조건부 합화는 절반만 옮긴다 — 운에서 채워질 자리라 반쯤 서 있다 */
  conditionalStemShift: 0.5,
  /** 일간이 낀 합은 옮기지 않는다 — 화격 판정은 아직 하지 않는다 */
  dayMasterCombination: 'facts-only',
  /** 한 지지가 여러 국에 걸리면 옮기는 몫의 합을 1 로 자른다 */
  perBranchPullCap: 1,
} as const;

/** 무게가 어디서 어디로 옮겨 갔는가 — 한 건 */
export type ElementShift = {
  from: Element;
  to: Element;
  amount: number;
  /** 어느 자리의 글자 때문인가 */
  position: PillarPosition;
  /** 무엇이 옮겼는가 — 합화의 한글 이름이거나 국의 한글 이름 */
  cause: string;
};

export type EffectiveElements = {
  status: 'experimental';
  /** 글자를 있는 그대로 센 분포 — 견줄 바탕이다 */
  base: ElementDistribution;
  /** 합화와 국을 반영한 분포. 아무것도 없으면 `base` 와 같다 */
  distribution: ElementDistribution;
  transformations: readonly StemTransformation[];
  bureaus: readonly Bureau[];
  shifts: readonly ElementShift[];
  /** 무게가 하나라도 움직였는가 */
  adjusted: boolean;
};

type EffectiveInput = Pick<Pillars, 'year' | 'month' | 'day' | 'hour' | 'dayMaster'>;

const emptyTally = (): Record<Element, number> =>
  Object.fromEntries(ELEMENTS.map((element) => [element, 0])) as Record<Element, number>;

export function effectiveElementsOf(
  pillars: EffectiveInput,
  weights: Partial<ElementWeights> = {},
): EffectiveElements {
  const { stem: stemWeight, branch, monthBranchMultiplier, hiddenStemWeighting } = {
    ...DEFAULT_ELEMENT_WEIGHTS,
    ...weights,
  };

  const base = elementDistributionOf(pillars, weights);
  const transformations = stemTransformationsOf(pillars);
  const bureaus = bureausOf(pillars);

  const scores = { ...base.scores };
  const shifts: ElementShift[] = [];

  const move = (from: Element, to: Element, amount: number, position: PillarPosition, cause: string) => {
    if (amount <= 0 || from === to) return;
    scores[from] -= amount;
    scores[to] += amount;
    shifts.push({ from, to, amount, position, cause });
  };

  // ── 천간합화 ────────────────────────────────────────────────
  for (const transformation of transformations) {
    if (transformation.verdict === 'bound') continue;
    // 일간이 낀 합은 사실만 남기고 무게는 건드리지 않는다.
    if (transformation.involvesDayMaster) continue;

    const factor =
      transformation.verdict === 'transformed'
        ? 1
        : EFFECTIVE_ELEMENTS_POLICY.conditionalStemShift;

    for (const participant of transformation.participants) {
      move(
        STEM_INFO[participant.stem].element,
        transformation.target,
        stemWeight * factor,
        participant.position,
        transformation.ko,
      );
    }
  }

  // ── 지지국 ─────────────────────────────────────────────────
  // 한 지지가 두 국에 걸릴 수 있다(예: 방합과 삼합). 옮기는 몫의 합이 1 을
  // 넘으면 그 지지가 지고 있는 것보다 많이 옮기게 되므로 비례로 줄인다.
  const pullByPosition = new Map<PillarPosition, number>();
  for (const bureau of bureaus) {
    for (const member of bureau.members) {
      pullByPosition.set(member.position, (pullByPosition.get(member.position) ?? 0) + bureau.pull);
    }
  }

  for (const bureau of bureaus) {
    for (const member of bureau.members) {
      const total = pullByPosition.get(member.position) ?? 0;
      const scale =
        total > EFFECTIVE_ELEMENTS_POLICY.perBranchPullCap
          ? EFFECTIVE_ELEMENTS_POLICY.perBranchPullCap / total
          : 1;
      const pull = bureau.pull * scale;
      if (pull <= 0) continue;

      const key = member.position as PillarKey;
      const branchWeight = branch * (key === 'month' ? monthBranchMultiplier : 1);

      // 그 지지가 지고 있던 무게에서 `pull` 만큼을 걷어 국의 오행에 얹는다.
      const taken = emptyTally();
      const hiddens = HIDDEN_STEMS[pillars[key]!.branch];
      const shares = hiddenStemShares(hiddens, hiddenStemWeighting);
      hiddens.forEach((hidden, index) => {
        taken[STEM_INFO[hidden.stem].element] += branchWeight * shares[index] * pull;
      });

      for (const element of ELEMENTS) {
        move(element, bureau.element, taken[element], member.position, bureau.ko);
      }
    }
  }

  const total = ELEMENTS.reduce((sum, element) => sum + scores[element], 0);
  const ratios = emptyTally();
  for (const element of ELEMENTS) {
    ratios[element] = total === 0 ? 0 : scores[element] / total;
  }

  const ranked = [...ELEMENTS].sort((a, b) => scores[b] - scores[a]);

  return {
    status: 'experimental',
    base,
    distribution: {
      // 눈에 보이는 글자 수는 국이나 합으로 달라지지 않는다 — 옮긴 것은 무게다.
      glyphCount: base.glyphCount,
      counts: base.counts,
      missing: base.missing,
      scores,
      ratios,
      strongest: ranked[0],
      weakest: ranked[ranked.length - 1],
    },
    transformations,
    bureaus,
    shifts,
    adjusted: shifts.length > 0,
  };
}
