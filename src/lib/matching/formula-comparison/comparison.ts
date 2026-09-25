import { DISCOVERY_V1, legacyPreviewScoreOf } from '../../discovery';
import {
  DAY_PILLAR_AXIS,
  NEED_COMPLEMENT_AXIS,
  STRENGTH_VARIANTS,
  dayPillarAxisOf,
  needComplementDirectional,
  needSupplyOf,
  needTargetsOf,
  type NeedTargets,
  type StrengthVariant,
} from '../../discovery/compat-axes';
import {
  combinedCountBalanceOf,
  mutualDeficitComplementOf,
  type ElementSummary,
} from '../../discovery/element-axes';
import {
  DEFAULT_ELEMENT_WEIGHTS,
  LEGACY_ELEMENT_WEIGHTS,
  computePillars,
  elementDistributionOf,
  needProfileOf,
  type ElementWeights,
  type Pillars,
  type SajuInput,
} from '../../saju';
import { scenarioDraw, scenarioPairs, withoutHour, type PairScenario } from '../../saju/population';
import { collisionRate, mean, quantile, sd, spearman, topOverlap } from './stats';

/**
 * **오프라인 궁합 공식 비교기** — 같은 모집단에서 공식 여럿을 나란히 잰다. 결정하지 않는다.
 *
 * 2026-09-25 에 v2 공식(연인용 · 일반)을 베타 전체에 쓰기로 정했고(운영자), 이 비교기는 그 뒤의 **보정 도구**다
 * — 관문이 아니다. 화면 · DB · 프롬프트 · `discovery-v1` 의 SQL 은 건드리지 않는다.
 *
 * 같은 날 엔진 기본이 월지 ×2 · 지장간 60:30:10 이 됐다(ADR 0114). 그래서 세기 `engine` 은 이제 `both` 와 같고,
 * 옛 기본(월지 ×1 · 사령 일수)은 `legacy` 로 따로 잰다 — 세기 후보의 표는 `legacy` 대비다.
 *
 * 축 넷은 모두 0~100 이다.
 * - `dayPillar` — 일주 · 일지 관계(`dayPillarAxisOf`)
 * - `need` — 필요한 기운의 보완, 두 방향 평균(`needComplementDirectional`)
 * - `balance` — `discovery-v1` 의 합산 균형 그대로
 * - `countComplement` — `discovery-v1` 의 20% 미만 부족분 보완 그대로
 *
 * 수와 결과는 `docs/notes/2026-09-25-compat-formula-comparison.md`.
 */

export type AxisKey = 'dayPillar' | 'need' | 'balance' | 'countComplement';

/**
 * 비교기가 재는 세기 — `discovery/compat-axes` 의 넷에 옛 엔진 기본(`legacy`)을 더한다.
 *
 * 무게는 **여기서 다 적는다.** `compat-axes` 의 `STRENGTH_VARIANT_WEIGHTS` 는 한 가지만 바꾼 부분 무게라 엔진
 * 기본 위에 얹히는데, 기본이 월지 ×2 · 60:30:10 이 된 뒤로(ADR 0114) `month-x2` · `hidden-60-30-10` 이 둘 다
 * `both` 와 같아졌다. 여기서는 둘을 **옛 기본에 하나씩 더한 것**으로 다시 적어 「어느 하나가 얼마를 바꾸는가」를
 * 계속 잰다. `legacy` 는 되돌아갈 문(`LEGACY_ELEMENT_WEIGHTS`)이다.
 */
export type ComparisonStrength = StrengthVariant | 'legacy';

export const COMPARISON_STRENGTHS: readonly ComparisonStrength[] = ['legacy', ...STRENGTH_VARIANTS];

export const COMPARISON_STRENGTH_WEIGHTS: Record<ComparisonStrength, ElementWeights> = {
  legacy: LEGACY_ELEMENT_WEIGHTS,
  engine: DEFAULT_ELEMENT_WEIGHTS,
  'month-x2': { ...LEGACY_ELEMENT_WEIGHTS, monthBranchMultiplier: 2 },
  'hidden-60-30-10': { ...LEGACY_ELEMENT_WEIGHTS, hiddenStemWeighting: 'sixty-thirty-ten' },
  both: { ...LEGACY_ELEMENT_WEIGHTS, monthBranchMultiplier: 2, hiddenStemWeighting: 'sixty-thirty-ten' },
};

/** 한 사람의 필요 대상 — 세기 하나로 */
export function targetsFor(
  pillars: Parameters<typeof needProfileOf>[0],
  variant: ComparisonStrength,
  instant?: Date,
): NeedTargets {
  return needTargetsOf(needProfileOf(pillars, { instant, weights: COMPARISON_STRENGTH_WEIGHTS[variant] }));
}

export type Formula = {
  id: string;
  label: string;
  /** 연인 기준선(일주 · 일지 허용) · 일반 기준선(일주 · 일지 뺌) 중 어디에 드는가 */
  families: readonly ('romantic' | 'general')[];
  /** 합이 1 인 무게 */
  weights: Record<AxisKey, number>;
  /** 필요 보완을 어느 세기로 재는가 */
  strength: ComparisonStrength;
};

const { combinedBalance, complement } = DISCOVERY_V1.weights;

/**
 * 공식 표 — **값이다.** 한 줄을 더하면 모든 표에 한 칸이 선다.
 *
 * v2 둘은 운영자가 2026-09-25 에 정한 것이고 엔진 기본이 월지 ×2 · 지장간 60:30:10 이 됐으므로(ADR 0114)
 * `both` 로 잰다. 일반용은 ADR 0113 개정에서 보완 60 · 균형 40 이 됐다 — 처음 판의 70 · 30 은 참고 줄로 남긴다.
 * 옛 후보 A(40 · 40 · 20)는 v2 연인용과, C(60 · 40)는 v2 일반과 같은 무게라 따로 두지 않았다 — C 는 엔진 세기로
 * 쟀는데 엔진 세기가 이제 `both` 라 한 점도 다르지 않다.
 */
export const FORMULAS: readonly Formula[] = [
  {
    id: 'v2-romantic',
    label: 'v2 연인용 (일주 40 · 보완 40 · 균형 20)',
    families: ['romantic'],
    weights: { dayPillar: 0.4, need: 0.4, balance: 0.2, countComplement: 0 },
    strength: 'both',
  },
  {
    id: 'v2-general',
    label: 'v2 일반 (보완 60 · 균형 40)',
    families: ['general'],
    weights: { dayPillar: 0, need: 0.6, balance: 0.4, countComplement: 0 },
    strength: 'both',
  },
  {
    id: 'v2-general-70-30',
    label: 'v2 일반 처음 판 (보완 70 · 균형 30) — 참고',
    families: ['general'],
    weights: { dayPillar: 0, need: 0.7, balance: 0.3, countComplement: 0 },
    strength: 'both',
  },
  {
    id: 'current',
    label: 'discovery-v1 (균형 70 · 개수 보완 30)',
    families: ['romantic', 'general'],
    weights: { dayPillar: 0, need: 0, balance: combinedBalance, countComplement: complement },
    strength: 'engine',
  },
  {
    id: 'B',
    label: 'B (일주 30 · 보완 50 · 균형 20)',
    families: ['romantic'],
    weights: { dayPillar: 0.3, need: 0.5, balance: 0.2, countComplement: 0 },
    strength: 'engine',
  },
];

/** 한 사람 — 비교기가 쓰는 것만 */
export type Person = {
  input: SajuInput;
  pillars: Pillars;
  hourKnown: boolean;
  summary: ElementSummary;
  targets: Record<ComparisonStrength, NeedTargets>;
};

export function personOf(input: SajuInput): Person {
  const { pillars, instant, hourKnown } = computePillars(input);
  const distribution = elementDistributionOf(pillars);
  return {
    input,
    pillars,
    hourKnown,
    summary: { glyphCount: distribution.glyphCount, counts: distribution.counts, ratios: distribution.ratios },
    targets: Object.fromEntries(
      COMPARISON_STRENGTHS.map((variant) => [variant, targetsFor(pillars, variant, instant)]),
    ) as Record<ComparisonStrength, NeedTargets>,
  };
}

/** 한 쌍의 네 축 — 필요 보완은 세기 후보마다. 한 번 재고 공식마다 무게만 바꿔 쓴다 */
export type PairAxes = {
  dayPillar: number;
  balance: number;
  countComplement: number;
  need: Record<ComparisonStrength, number>;
};

export function axesOf(a: Person, b: Person): PairAxes {
  return {
    dayPillar: dayPillarAxisOf(a.pillars, b.pillars, DAY_PILLAR_AXIS),
    balance: combinedCountBalanceOf(a.summary, b.summary),
    countComplement: mutualDeficitComplementOf(a.summary, b.summary),
    need: Object.fromEntries(
      COMPARISON_STRENGTHS.map((variant) => [
        variant,
        (needComplementDirectional(a.targets[variant], b.summary, NEED_COMPLEMENT_AXIS) +
          needComplementDirectional(b.targets[variant], a.summary, NEED_COMPLEMENT_AXIS)) /
          2,
      ]),
    ) as Record<ComparisonStrength, number>,
  };
}

export function scoreOf(formula: Formula, axes: PairAxes, strength = formula.strength): number {
  const { weights } = formula;
  return Math.round(
    weights.dayPillar * axes.dayPillar +
      weights.need * axes.need[strength] +
      weights.balance * axes.balance +
      weights.countComplement * axes.countComplement,
  );
}

/** `current` 가 옛 판의 셈(`legacyPreviewScoreOf`)과 한 점도 다르지 않은가 — 시험이 든다 */
export const previewOf = (a: Person, b: Person) => legacyPreviewScoreOf(a.summary, b.summary);

/** 시나리오의 쌍 — 시험이 `current` 를 `previewScoreOf` 와 견줄 때 쓴다 */
export const scenarioPeople = (scenario: PairScenario, count: number, seed = 20260925) =>
  scenarioPairs(scenario, count, seed).map(([a, b]) => [personOf(a), personOf(b)] as const);

// ─── 한 시나리오의 보고 ─────────────────────────────────────────────────────

export type Distribution = {
  mean: number;
  sd: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  /** 62~68 에 든 몫 — PRD 가 옛 점수가 그 자리에 몰렸다고 적었다 */
  in62to68: number;
  /** 두 쌍을 무작위로 골랐을 때 정수 점수가 같을 확률 */
  tieRate: number;
};

export type ViewerMetrics = {
  /** 보는 사람마다 현재 공식과 겹친 상위 10 의 수 — 평균 */
  top10Overlap: number;
  /** 상위 10 중 바뀐 수의 중앙값 */
  top10ReplacedMedian: number;
  /** 제품이 남기는 상위 20%(후보 200 중 40)가 현재 공식과 겹친 몫 — 평균 */
  top20pctOverlap: number;
  /** 보는 사람마다의 Spearman — p10 · p50 · p90 */
  spearman: { p10: number; p50: number; p90: number };
};

export type ScenarioReport = {
  scenario: PairScenario;
  pairs: number;
  meanAgeGap: number;
  distribution: Record<string, Distribution>;
  viewers: Record<string, ViewerMetrics>;
  /** 두 사람 다 시를 지우면 5 점 넘게 움직이는 쌍의 몫(시를 아는 사람이 있는 쌍 중), 그리고 쌍 순위의 Spearman */
  hourDrop: Record<string, { moved5: number; spearman: number }>;
  /** 필요 보완 한 방향 점수의 비대칭 — 엔진 세기(ADR 0114 뒤로는 `both` 와 같다)에서 */
  asymmetry: { meanAbsDiff: number; diff50OrMore: number };
  /** D — 점수는 지금 그대로, 「상대가 나에게 채워 주는 것」 이유가 서는 쌍의 몫(보는 쪽 방향, 엔진 세기) */
  reasonShare: { anySupply: number; saturated: number };
  /** 세기 후보마다: 억부 1순위가 바뀐 사람의 몫, 보는 사람의 상위 10 · Spearman(옛 기본 `legacy` 대비, 공식별) */
  strength: Record<
    ComparisonStrength,
    { primaryChanged: number; formulas: Record<string, { top10Overlap: number; spearmanP50: number }> }
  >;
};

const round = (value: number, digits = 3) => Number(value.toFixed(digits));

function distributionOf(scores: readonly number[]): Distribution {
  return {
    mean: round(mean(scores), 2),
    sd: round(sd(scores), 2),
    p5: quantile(scores, 0.05),
    p25: quantile(scores, 0.25),
    p50: quantile(scores, 0.5),
    p75: quantile(scores, 0.75),
    p95: quantile(scores, 0.95),
    in62to68: round(scores.filter((score) => score >= 62 && score <= 68).length / scores.length),
    tieRate: round(collisionRate(scores)),
  };
}

export type ScenarioSizes = { pairs: number; viewers: number; candidates: number };

export const DEFAULT_SIZES: ScenarioSizes = { pairs: 5000, viewers: 30, candidates: 200 };

export function runScenario(
  scenario: PairScenario,
  sizes: ScenarioSizes = DEFAULT_SIZES,
  formulas: readonly Formula[] = FORMULAS,
  seed = 20260925,
): ScenarioReport {
  const pairs = scenarioPairs(scenario, sizes.pairs, seed).map(
    ([a, b]) => [personOf(a), personOf(b)] as const,
  );
  const pairAxes = pairs.map(([a, b]) => axesOf(a, b));
  const scores = (formula: Formula, strength = formula.strength) =>
    pairAxes.map((axes) => scoreOf(formula, axes, strength));

  const distribution = Object.fromEntries(formulas.map((f) => [f.id, distributionOf(scores(f))]));

  // 보는 사람 × 후보 — 시드를 쌍 표본과 떼어 둔다
  const draw = scenarioDraw(scenario, seed + 1);
  const viewers = Array.from({ length: sizes.viewers }, () => {
    const viewerInput = draw.first();
    const viewer = personOf(viewerInput);
    return Array.from({ length: sizes.candidates }, () => axesOf(viewer, personOf(draw.partnerOf(viewerInput))));
  });
  const viewerScores = (formula: Formula, strength = formula.strength) =>
    viewers.map((candidates) => candidates.map((axes) => scoreOf(formula, axes, strength)));

  const current = formulas.find((f) => f.id === 'current');
  if (!current) throw new Error('공식 표에 current 가 없다');
  const currentByViewer = viewerScores(current);
  const keep = Math.round(sizes.candidates * 0.2);

  const viewerMetricsOf = (byViewer: number[][], baseline: number[][]): ViewerMetrics => {
    const overlaps = byViewer.map((s, i) => topOverlap(s, baseline[i], 10));
    const rhos = byViewer.map((s, i) => spearman(s, baseline[i]));
    return {
      top10Overlap: round(mean(overlaps), 2),
      top10ReplacedMedian: quantile(overlaps.map((o) => 10 - o), 0.5),
      top20pctOverlap: round(mean(byViewer.map((s, i) => topOverlap(s, baseline[i], keep) / keep))),
      spearman: {
        p10: round(quantile(rhos, 0.1)),
        p50: round(quantile(rhos, 0.5)),
        p90: round(quantile(rhos, 0.9)),
      },
    };
  };

  const viewerReport = Object.fromEntries(
    formulas.map((f) => [f.id, viewerMetricsOf(viewerScores(f), currentByViewer)]),
  );

  // 시 지우기 — 두 사람 다 지운다. 시를 아는 사람이 하나라도 있는 쌍만 센다
  const dropped = pairs.map(([a, b]) => [
    a.hourKnown ? personOf(withoutHour(a.input)) : a,
    b.hourKnown ? personOf(withoutHour(b.input)) : b,
  ] as const);
  const droppedAxes = dropped.map(([a, b]) => axesOf(a, b));
  const touched = pairs.map(([a, b]) => a.hourKnown || b.hourKnown);
  const hourDrop = Object.fromEntries(
    formulas.map((f) => {
      const before = scores(f);
      const after = droppedAxes.map((axes) => scoreOf(f, axes));
      const idx = before.map((_, i) => i).filter((i) => touched[i]);
      return [
        f.id,
        {
          moved5: round(idx.filter((i) => Math.abs(before[i] - after[i]) >= 5).length / idx.length),
          spearman: round(spearman(idx.map((i) => before[i]), idx.map((i) => after[i]))),
        },
      ];
    }),
  );

  const diffs = pairs.map(([a, b]) =>
    Math.abs(needComplementDirectional(a.targets.engine, b.summary) - needComplementDirectional(b.targets.engine, a.summary)),
  );
  const supplies = pairs.map(([a, b]) => needSupplyOf(a.targets.engine, b.summary).supply);

  const people = pairs.flat();
  const strength = Object.fromEntries(
    COMPARISON_STRENGTHS.map((variant) => [
      variant,
      {
        primaryChanged: round(
          people.filter((p) => p.targets[variant].primary !== p.targets.legacy.primary).length / people.length,
        ),
        formulas: Object.fromEntries(
          formulas
            .filter((f) => f.weights.need > 0)
            .map((f) => {
              const base = viewerScores(f, 'legacy');
              const moved = viewerScores(f, variant);
              return [
                f.id,
                {
                  top10Overlap: round(mean(moved.map((s, i) => topOverlap(s, base[i], 10))), 2),
                  spearmanP50: round(quantile(moved.map((s, i) => spearman(s, base[i])), 0.5)),
                },
              ];
            }),
        ),
      },
    ]),
  ) as ScenarioReport['strength'];

  return {
    scenario,
    pairs: pairs.length,
    meanAgeGap: round(mean(pairs.map(([a, b]) => Math.abs(a.input.year - b.input.year))), 1),
    distribution,
    viewers: viewerReport,
    hourDrop,
    asymmetry: {
      meanAbsDiff: round(mean(diffs), 1),
      diff50OrMore: round(diffs.filter((d) => d >= 50).length / diffs.length),
    },
    reasonShare: {
      anySupply: round(supplies.filter((s) => s > 0).length / supplies.length),
      saturated: round(supplies.filter((s) => s >= 1).length / supplies.length),
    },
    strength,
  };
}
