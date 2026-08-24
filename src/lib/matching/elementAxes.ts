import { ELEMENTS, type Element } from '../saju';

/**
 * 오행 두 축 — **`match-v0` 와 `discovery-v0` 가 같은 자로 잰다.**
 *
 * 두 정책은 하는 일이 다르고 가중치도 다르지만(ADR 0003), 「오행 보완」과 「함께 놓은
 * 균형」이 무엇인가는 하나여야 한다. 정책마다 따로 세면 같은 두 사람이 화면에 따라
 * 다른 보완을 갖게 되고, 그 차이는 어디에도 안 적힌다.
 *
 * **셈이 여기에만 있는 것은 아니다.** 후보 노출은 상대의 오행 요약을 브라우저로
 * 내려보내지 않으므로 DB 안에서 같은 셈을 한 번 더 한다(`discovery_complement` ·
 * `discovery_combined_balance`). 두 언어에 하나씩 있으므로 갈릴 수 있고, 그래서
 * **양쪽 시험이 같은 입력에 같은 기대값**을 든다 — 한쪽만 고치면 다른 쪽이 깨진다.
 */

/**
 * 오행 분포에서 **축이 쓰는 것만** 뽑은 요약.
 *
 * `ElementDistribution` 을 통째로 받지 않는 것은, 이 요약이 그대로 매칭 풀에 실리는
 * 값이기 때문이다(`discovery_profile.element_summary`). 축이 안 보는 것을 요약에
 * 넣어 두면 안 쓰는 자료를 남에게 내주게 된다.
 */
export type ElementSummary = {
  /** 센 글자 수 — 여덟, 시간 미상이면 여섯 */
  glyphCount: number;
  /** 글자의 단순 개수 — 「없는 오행」은 이 기준이다 */
  counts: Record<Element, number>;
  /** 지장간 일수로 가중한 뒤 합 1로 정규화한 비중 */
  ratios: Record<Element, number>;
};

/** 오행 분포에서 요약을 뽑는다 — 고르는 자리를 하나로 둔다 */
export function elementSummaryOf(distribution: ElementSummary): ElementSummary {
  return {
    glyphCount: distribution.glyphCount,
    counts: { ...distribution.counts },
    ratios: { ...distribution.ratios },
  };
}

/** 내 원국에 아예 없는 오행 — 눈에 보이는 글자 기준 */
const missingOf = (summary: ElementSummary): Element[] =>
  ELEMENTS.filter((element) => summary.counts[element] === 0);

/**
 * 상대가 내 없는 오행을 얼마나 채우는가 — 한 방향. 0~100.
 *
 * 빠진 오행이 없다는 것은 상대가 채울 몫도 없다는 뜻이다. 완벽한 궁합으로 올리지 않고
 * 중립값에 둔다. 이 숫자는 제품 선택이며 명리 규칙이 아니다.
 */
export function complementOneWay(mine: ElementSummary, partner: ElementSummary): number {
  const missing = missingOf(mine);
  if (missing.length === 0) return 70;

  const supplied = missing.filter((element) => partner.counts[element] > 0);
  return (supplied.length / missing.length) * 100;
}

/** 양방향 평균 — 어느 쪽을 먼저 넣든 같은 값이다(자리 대칭) */
export const complementOf = (a: ElementSummary, b: ElementSummary): number =>
  (complementOneWay(a, b) + complementOneWay(b, a)) / 2;

/** 내게 없는 오행 중 상대가 가진 개수 — 문장이 쓰는 수 */
export const suppliedCountOf = (mine: ElementSummary, partner: ElementSummary): number =>
  missingOf(mine).filter((element) => partner.counts[element] > 0).length;

/**
 * 두 분포를 합쳤을 때 다섯 축이 얼마나 고른가. 0~100.
 *
 * 각 20% 로부터의 거리 합(최대 1.6)을 뒤집어 정규화한다.
 */
export function combinedBalanceOf(a: ElementSummary, b: ElementSummary): number {
  const deviation = ELEMENTS.reduce(
    (sum, element) => sum + Math.abs((a.ratios[element] + b.ratios[element]) / 2 - 0.2),
    0,
  );
  return (1 - deviation / 1.6) * 100;
}
