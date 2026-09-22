import { ELEMENTS, type Element } from '../saju';

/**
 * 오행 축 — `discovery-v1` 첫인상 점수의 두 축.
 *
 * 보이는 글자 수로 재는 균형과, 서로의 20% 미만 부족분에 상대가 닿는 정도다
 * (ADR 0003 개정). 옛 `match-v0` 의 이진 결손·가중 비율 축은 부르는 곳이 없어 걷었다.
 *
 * **셈이 여기에만 있는 것은 아니다.** 후보 노출은 상대의 오행 요약을 브라우저로
 * 내려보내지 않으므로 DB 안에서 같은 셈을 한 번 더 한다(`discovery_count_balance_v1` ·
 * `discovery_deficit_complement_v1`). 두 언어에 하나씩 있으므로 갈릴 수 있고, 그래서
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

/**
 * discovery-v1 의 균형도 — 가중 비율이 아니라 화면에 보이는 글자 수를 합쳐 잰다.
 *
 * 다섯 비율과 20% 사이 L1 거리의 최댓값은 1.6이다. 한 오행에 전부 몰리면
 * `|1 - .2| + 4 * |0 - .2| = 1.6` 이 된다.
 */
export function combinedCountBalanceOf(a: ElementSummary, b: ElementSummary): number {
  const total = a.glyphCount + b.glyphCount;
  if (total <= 0) return 0;

  const deviation = ELEMENTS.reduce(
    (sum, element) => sum + Math.abs((a.counts[element] + b.counts[element]) / total - 0.2),
    0,
  );
  return Math.max(0, Math.min(100, (1 - deviation / 1.6) * 100));
}

const countRatioOf = (summary: ElementSummary, element: Element): number =>
  summary.glyphCount > 0 ? summary.counts[element] / summary.glyphCount : 0;

/**
 * 한 방향의 부족분 보완 — 상대 비율은 20%에서 포화한다.
 *
 * 상대가 해당 오행을 20%보다 많이 가진다고 보완 효과까지 계속 커지는 것은 아니다.
 * 20%까지는 부족분에 닿는 정도로 보고, 그 뒤의 과다는 추가 가점으로 쓰지 않는다.
 */
export const deficitComplementOneWay = (
  mine: ElementSummary,
  partner: ElementSummary,
): number =>
  ELEMENTS.reduce(
    (sum, element) =>
      sum +
      Math.max(0, 0.2 - countRatioOf(mine, element)) *
        Math.min(1, countRatioOf(partner, element) / 0.2),
    0,
  );

/**
 * discovery-v1 의 상호보완도 — 서로의 20% 미만 부족분에 상대 비율이 얼마나 닿는지 잰다.
 * 상대 비율은 20%에서 포화한다. 양방향 합의 최댓값은 1이므로 0~100으로 옮긴다.
 */
export function mutualDeficitComplementOf(a: ElementSummary, b: ElementSummary): number {
  const raw = deficitComplementOneWay(a, b) + deficitComplementOneWay(b, a);
  return Math.max(0, Math.min(100, raw * 100));
}
