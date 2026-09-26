import {
  NEED_COMPLEMENT_AXIS,
  needComplementDirectional,
  type NeedComplementParams,
  type NeedTargets,
} from '../../discovery/compat-axes';
import type { ElementSummary } from '../../discovery/element-axes';
import { elementDistributionOf, pillarOf, type Branch, type Stem } from '../../saju';
import {
  COMPAT_EXTERNAL_CASES,
  type CasePillars,
  type ExternalCompatCase,
} from '../../saju/analysis/validation/compatExternalCases';
import { targetsFor, type ComparisonStrength } from './comparison';
import { auc, bootstrapAucInterval, mean } from './stats';

/**
 * **전문가 판정 합치도** — 정확도가 아니다.
 *
 * 외부 사례 34 쌍(`compatExternalCases.ts`)은 한 사람의 관법이고 정답표가 아니다. 여기서 재는 것은 필요 보완 축의
 * 한 방향 점수가 전문가가 「채운다」고 한 방향을 「못 채운다 · 해친다」고 한 방향보다 높게 놓는가뿐이다.
 *
 * - **한 쌍이 한 표본이다.** 두 방향을 따로 세면 같은 글 · 같은 두 명식이 두 번 든다. 판정이 선 방향이 모두 「채운다」면
 *   양성 쌍, 모두 「못 채운다 · 해친다」면 음성 쌍, 섞였으면 **갈린 쌍**이다. 양성 · 음성 쌍의 점수는 판정이 선 방향의
 *   평균이고 AUC 로 견준다. 갈린 쌍은 쌍 안에서 「채운다」 방향이 더 높은가(일치율)로 따로 센다. 「조금」 · 「섞임」 은 뺀다.
 * - **글쓴이로 묶는다** — 같은 사람의 글은 서로 독립이 아니다.
 * - **글쓴이 하나 빼고 맞추기** — 매개변수(포화 · 반대 신호 무게)를 그 글쓴이 없이 고르고 그 글쓴이에게 잰다.
 */

const parse = (name: string) => {
  const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
  if (!pillar) throw new Error(`간지가 아니다: ${name}`);
  return pillar;
};

const chartOf = (pillars: CasePillars) => {
  const day = parse(pillars.day);
  return {
    year: parse(pillars.year),
    month: parse(pillars.month),
    day,
    hour: pillars.hour === null ? null : parse(pillars.hour),
    dayMaster: day.stem,
  };
};

const summaryOf = (pillars: CasePillars): ElementSummary => {
  const distribution = elementDistributionOf(chartOf(pillars));
  return { glyphCount: distribution.glyphCount, counts: distribution.counts, ratios: distribution.ratios };
};

type Label = 'positive' | 'negative';

const labelOf = (verdict: string): Label | null =>
  verdict === 'supplies' ? 'positive' : verdict === 'does-not' || verdict === 'harms' ? 'negative' : null;

type CaseDirections = {
  testCase: ExternalCompatCase;
  directions: { label: Label; receiver: NeedTargets; provider: ElementSummary }[];
};

function casesWith(variant: ComparisonStrength): CaseDirections[] {
  return COMPAT_EXTERNAL_CASES.map((testCase) => ({
    testCase,
    directions: testCase.directions.flatMap((direction) => {
      const label = labelOf(direction.verdict);
      if (label === null) return [];
      const person = (name: string) => {
        const found = testCase.people.find((p) => p.label === name);
        if (!found) throw new Error(`이름표가 없다: ${name}`);
        return found;
      };
      return [
        {
          label,
          receiver: targetsFor(chartOf(person(direction.receiver).pillars), variant),
          provider: summaryOf(person(direction.provider).pillars),
        },
      ];
    }),
  })).filter(({ directions }) => directions.length > 0);
}

export type Agreement = {
  /** 양성 쌍 · 음성 쌍 · 갈린 쌍의 수 */
  positivePairs: number;
  negativePairs: number;
  splitPairs: number;
  /** 양성 쌍이 음성 쌍보다 높을 확률 — 0.5 가 무작위 */
  auc: number;
  /**
   * AUC 의 부트스트랩 95% 구간(양성 · 음성 따로 복원 추출 2000 번). 양성 19 · 음성 9 에서는 구간이 넓다 — 0.5 를
   * 품으면 이 축이 판정을 가른다고 말할 수 없다.
   */
  aucInterval: { low: number; high: number };
  /** 양성 쌍 평균 − 음성 쌍 평균 */
  meanDiff: number;
  /** 갈린 쌍 안에서 「채운다」 방향이 더 높은 몫(같으면 반) */
  splitConcordance: number;
};

/** `params` 가 배열이면 쌍마다 제 값을 쓴다 — 글쓴이 하나 빼고 맞춘 값을 모을 때 */
function agreementOf(
  cases: readonly CaseDirections[],
  params: NeedComplementParams | readonly NeedComplementParams[],
): Agreement {
  const pos: number[] = [];
  const neg: number[] = [];
  const split: number[] = [];
  for (const [index, { directions }] of cases.entries()) {
    const own = Array.isArray(params) ? params[index] : (params as NeedComplementParams);
    const scored = directions.map((d) => ({
      label: d.label,
      score: needComplementDirectional(d.receiver, d.provider, own),
    }));
    const labels = new Set(scored.map((d) => d.label));
    if (labels.size === 1) {
      (labels.has('positive') ? pos : neg).push(mean(scored.map((d) => d.score)));
    } else {
      const p = mean(scored.filter((d) => d.label === 'positive').map((d) => d.score));
      const n = mean(scored.filter((d) => d.label === 'negative').map((d) => d.score));
      split.push(p > n ? 1 : p === n ? 0.5 : 0);
    }
  }
  return {
    positivePairs: pos.length,
    negativePairs: neg.length,
    splitPairs: split.length,
    auc: Number(auc(pos, neg).toFixed(3)),
    aucInterval: (({ low, high }) => ({ low: Number(low.toFixed(3)), high: Number(high.toFixed(3)) }))(
      bootstrapAucInterval(pos, neg),
    ),
    meanDiff: Number((mean(pos) - mean(neg)).toFixed(1)),
    splitConcordance: split.length === 0 ? Number.NaN : Number(mean(split).toFixed(3)),
  };
}

/** 맞출 매개변수의 격자 — 기본값(0.2 · 0.3)이 들어 있다 */
const PARAM_GRID: readonly NeedComplementParams[] = [0.125, 0.2, 0.25, 0.34].flatMap((supplyCap) =>
  [0, 0.3, 0.6, 1].map((counterWeight) => ({ supplyCap, counterWeight })),
);

const isDefault = (p: NeedComplementParams) =>
  p.supplyCap === NEED_COMPLEMENT_AXIS.supplyCap && p.counterWeight === NEED_COMPLEMENT_AXIS.counterWeight;

/** 격자에서 AUC(없으면 평균 차)가 가장 높은 것 — 같으면 기본값, 그다음 격자 순서 */
function fit(cases: readonly CaseDirections[]): NeedComplementParams {
  const scoreOf = (p: NeedComplementParams) => {
    const a = agreementOf(cases, p);
    return Number.isNaN(a.auc) ? a.meanDiff / 100 : a.auc;
  };
  return PARAM_GRID.reduce((best, p) => {
    const diff = scoreOf(p) - scoreOf(best);
    return diff > 1e-9 || (Math.abs(diff) <= 1e-9 && isDefault(p) && !isDefault(best)) ? p : best;
  });
}

export type ExpertReport = {
  variant: ComparisonStrength;
  overall: Agreement;
  byCredibility: Record<string, Agreement>;
  byAuthor: Record<string, Agreement>;
  /** 모든 글쓴이로 맞춘 값 · 그 값의 합치도(표본 안이라 부풀려진다) */
  fittedAll: { params: NeedComplementParams; agreement: Agreement };
  /** 글쓴이 하나 빼고 맞춘 값으로 그 글쓴이의 쌍을 잰 것을 모은 합치도 · 글쓴이마다 고른 값 */
  leaveOneAuthorOut: { agreement: Agreement; chosen: Record<string, NeedComplementParams> };
};

export function expertAgreement(variant: ComparisonStrength = 'engine'): ExpertReport {
  const cases = casesWith(variant);
  const groupBy = (key: (c: CaseDirections) => string) =>
    cases.reduce<Record<string, CaseDirections[]>>((acc, c) => {
      (acc[key(c)] ??= []).push(c);
      return acc;
    }, {});
  const byAuthorCases = groupBy((c) => c.testCase.practitioner);
  const byCredibilityCases = groupBy((c) => c.testCase.credibility);

  const chosen: Record<string, NeedComplementParams> = {};
  // 빠진 글쓴이의 쌍을 그 글쓴이 없이 고른 값으로 잰다
  const heldOut: CaseDirections[] = [];
  const heldOutParams: NeedComplementParams[] = [];
  for (const [author, authored] of Object.entries(byAuthorCases)) {
    const params = fit(cases.filter((c) => c.testCase.practitioner !== author));
    chosen[author] = params;
    for (const c of authored) {
      heldOut.push(c);
      heldOutParams.push(params);
    }
  }
  const pooled = agreementOf(heldOut, heldOutParams);
  const fittedParams = fit(cases);

  return {
    variant,
    overall: agreementOf(cases, NEED_COMPLEMENT_AXIS),
    byCredibility: Object.fromEntries(
      Object.entries(byCredibilityCases).map(([k, v]) => [k, agreementOf(v, NEED_COMPLEMENT_AXIS)]),
    ),
    byAuthor: Object.fromEntries(
      Object.entries(byAuthorCases).map(([k, v]) => [k, agreementOf(v, NEED_COMPLEMENT_AXIS)]),
    ),
    fittedAll: { params: fittedParams, agreement: agreementOf(cases, fittedParams) },
    leaveOneAuthorOut: { agreement: pooled, chosen },
  };
}
