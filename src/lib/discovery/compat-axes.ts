import {
  findCompatRelations,
  needProfileOf,
  type Element,
  type ElementWeights,
  type NeedProfile,
  type Pillars,
  type RelationKind,
} from '../saju';
import type { ElementSummary } from './element-axes';

/**
 * 궁합 점수의 새 축 둘 — **필요한 기운의 보완**(방향별)과 **일주 · 일지 관계.** 0~100.
 *
 * 2026-09-25 조사 아홉 갈래의 종합(`docs/notes/2026-09-25-compat-score-direction.md` 「개정」)이 「가장 무거운
 * 축」으로 든 둘이다. `discovery-v1` 의 두 축(균형 · 개수 보완, `element-axes.ts`)과 같은 0~100 자로 잰다.
 * 여기 적힌 수는 **전부 가설**이고 이름 붙은 매개변수다 — 오프라인 비교기
 * (`src/lib/matching/formula-comparison`)가 같은 모집단에서 나란히 잰 값이 `docs/notes/2026-09-25-compat-formula-comparison.md`
 * 에 있다.
 *
 * DB 도 React 도 모르는 순수 함수다. 필요한 것은 받는 쪽의 **필요 프로필**(`needProfileOf`, 자기 명식에서)과
 * 주는 쪽의 **오행 요약**(`ElementSummary` — 후보 풀이 이미 드는 값), 일주 · 일지 축은 두 사람의 **일주**뿐이다.
 */

// ─── 필요한 기운의 보완 ─────────────────────────────────────────────────────

/**
 * 필요 보완 축의 매개변수.
 *
 * - **공급은 드러난 글자로만 센다** — 일간 · 다른 천간 · 지지 본기. 지장간에만 있는 것은 0 이다(조사: 지장간만을
 *   공급으로 친 출처 0). 드러난 글자 수는 `ElementSummary.counts` 가 그대로 든다 — 지지는 본기 오행으로 세고 일간도
 *   센다(상대의 일간은 그 사람 자체라 뺄 까닭이 없다, ADR 0112).
 * - **공급은 `supplyCap` 에서 포화한다** — `discovery-v1` 의 20% 와 같은 값. 여덟 글자 중 둘이면 가득이다.
 * - **반대 신호**: 주는 쪽이 받는 쪽의 가장 무거운 오행(억부가 「이것이 가장 무겁다」고 본 것)을 드러난 글자로 가졌으면
 *   같은 포화로 재어 `counterWeight` 만큼 뺀다. 출처는 해롭다고 말하지만 근거가 얇아(B1 C2 · 사례 16 방향) 작게 둔다.
 * - **조후는 넣지 않는다** — 궁합에 쓴 근거가 개념 논문 1 · 앱 1 이다.
 */
export const NEED_COMPLEMENT_AXIS = {
  supplyCap: 0.2,
  counterWeight: 0.3,
} as const;

export type NeedComplementParams = { supplyCap: number; counterWeight: number };

/** 받는 쪽에서 이 축이 쓰는 것 — 억부 1순위 오행과 가장 무거운 오행 */
export type NeedTargets = {
  primary: Element;
  heaviest: Element;
  /** 억부가 판정을 거두었다 — 그래도 1순위는 들고 있으므로 셈은 한다. 비교기가 몫을 센다 */
  withheld: boolean;
};

export const needTargetsOf = (profile: Pick<NeedProfile, 'eokbu'>): NeedTargets => ({
  primary: profile.eokbu.candidates[0].element,
  heaviest: profile.eokbu.heaviest.element,
  withheld: profile.eokbu.verdict === 'withheld',
});

/**
 * 세기의 후보 셋 — **엔진 기본은 바꾸지 않는다**(옵션으로만 연다). 월지 ×2 · 지장간 60:30:10 은 방향은 합의,
 * 수는 후보다(`docs/notes/2026-09-25-research-cn-strength-scoring.md`).
 */
export type StrengthVariant = 'engine' | 'month-x2' | 'hidden-60-30-10' | 'both';

export const STRENGTH_VARIANTS: readonly StrengthVariant[] = ['engine', 'month-x2', 'hidden-60-30-10', 'both'];

export const STRENGTH_VARIANT_WEIGHTS: Record<StrengthVariant, Partial<ElementWeights>> = {
  engine: {},
  'month-x2': { monthBranchMultiplier: 2 },
  'hidden-60-30-10': { hiddenStemWeighting: 'sixty-thirty-ten' },
  both: { monthBranchMultiplier: 2, hiddenStemWeighting: 'sixty-thirty-ten' },
};

/** 한 사람의 필요 대상 — 세기 후보 하나로 */
export function needTargetsFor(
  pillars: Parameters<typeof needProfileOf>[0],
  variant: StrengthVariant = 'engine',
  instant?: Date,
): NeedTargets {
  return needTargetsOf(needProfileOf(pillars, { instant, weights: STRENGTH_VARIANT_WEIGHTS[variant] }));
}

const visibleShare = (summary: ElementSummary, element: Element): number =>
  summary.glyphCount > 0 ? summary.counts[element] / summary.glyphCount : 0;

/** 한 방향의 날값 — 공급(0~1) · 반대 신호(0~1) */
export function needSupplyOf(
  receiver: NeedTargets,
  provider: ElementSummary,
  params: NeedComplementParams = NEED_COMPLEMENT_AXIS,
): { supply: number; counter: number } {
  return {
    supply: Math.min(1, visibleShare(provider, receiver.primary) / params.supplyCap),
    counter: Math.min(1, visibleShare(provider, receiver.heaviest) / params.supplyCap),
  };
}

/**
 * **한 방향**(받는 쪽 ← 주는 쪽)의 필요 보완, 0~100. 공급이 가득이고 반대 신호가 없으면 100, 공급이 없으면
 * 반대 신호만큼 0 쪽이다(0 에서 멈춘다).
 */
export function needComplementDirectional(
  receiver: NeedTargets,
  provider: ElementSummary,
  params: NeedComplementParams = NEED_COMPLEMENT_AXIS,
): number {
  const { supply, counter } = needSupplyOf(receiver, provider, params);
  return Math.max(0, Math.min(100, 100 * (supply - params.counterWeight * counter)));
}

/** 두 방향의 평균 — 두 사람에게 같은 수를 내야 하는 자리(점수)에서 쓴다 */
export function needComplementSymmetric(
  a: { targets: NeedTargets; summary: ElementSummary },
  b: { targets: NeedTargets; summary: ElementSummary },
  params: NeedComplementParams = NEED_COMPLEMENT_AXIS,
): number {
  return (
    (needComplementDirectional(a.targets, b.summary, params) +
      needComplementDirectional(b.targets, a.summary, params)) /
    2
  );
}

// ─── 일주 · 일지 관계 ───────────────────────────────────────────────────────

/**
 * 일주 · 일지 축의 매개변수 — **두 일간끼리, 두 일지끼리만** 본다(`findCompatRelations` 를 일주만 넣어 부른다).
 *
 * - 중립은 50 이다. 관계가 없으면 50.
 * - 합(천간합 · 육합 · 반쪽 삼합)은 더하고 충 · 형 · 해 · 원진 · 파는 뺀다. 방합 반쪽 · 귀문은 0 이다(궁합에서 무게를
 *   준 출처가 없다).
 * - **합이 충을 푼다** — 합이 하나라도 서면 충의 감점에 `1 - combinationResolvesClash` 를 곱한다.
 * - **한 번의 충 · 합이 결정적이지 않다** — 축은 `floor` ~ `ceiling` 안에 머문다. S · A 출처는 한 번의 충을 결정적으로
 *   보지 않았다. 무게 40 에서 충 하나는 총점 −10 이다.
 */
export const DAY_PILLAR_AXIS = {
  neutral: 50,
  points: {
    stemCombination: 20,
    branchSixCombination: 25,
    branchTripleCombination: 15,
    branchDirectionalCombination: 0,
    stemClash: -15,
    branchClash: -25,
    branchPunishment: -15,
    branchHarm: -10,
    branchResentment: -10,
    branchDestruction: -5,
    branchGhostGate: 0,
  } satisfies Record<RelationKind, number>,
  combinationResolvesClash: 0.5,
  floor: 25,
  ceiling: 90,
} as const;

export type DayPillarParams = {
  neutral: number;
  points: Record<RelationKind, number>;
  combinationResolvesClash: number;
  floor: number;
  ceiling: number;
};

const COMBINATIONS: readonly RelationKind[] = [
  'stemCombination',
  'branchSixCombination',
  'branchTripleCombination',
];
const CLASHES: readonly RelationKind[] = ['stemClash', 'branchClash'];

type DayOnly = Pick<Pillars, 'day'>;

/** 두 일주 사이의 관계 이름들 — 같은 이름이 둘이면 둘 다 든다(자형 · 형 · 파가 한 쌍에 함께 서기도 한다) */
export function dayPillarRelationKinds(a: DayOnly, b: DayOnly): RelationKind[] {
  return findCompatRelations(
    { year: null, month: null, day: a.day, hour: null },
    { year: null, month: null, day: b.day, hour: null },
  ).map((relation) => relation.kind);
}

/** 두 일주의 관계, 0~100 */
export function dayPillarAxisOf(
  a: DayOnly,
  b: DayOnly,
  params: DayPillarParams = DAY_PILLAR_AXIS,
): number {
  const kinds = dayPillarRelationKinds(a, b);
  const resolved = kinds.some((kind) => COMBINATIONS.includes(kind));
  const sum = kinds.reduce((total, kind) => {
    const point = params.points[kind];
    return total + (resolved && CLASHES.includes(kind) ? point * (1 - params.combinationResolvesClash) : point);
  }, 0);
  return Math.max(params.floor, Math.min(params.ceiling, params.neutral + sum));
}
