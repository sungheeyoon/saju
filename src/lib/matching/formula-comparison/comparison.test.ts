import { describe, expect, it } from 'vitest';
import {
  DAY_PILLAR_AXIS,
  dayPillarAxisOf,
  needComplementDirectional,
  type NeedTargets,
} from '../../discovery/compat-axes';
import type { ElementSummary } from '../../discovery/element-axes';
import { pillarOf, type Branch, type Stem } from '../../saju';
import { ageOnEvaluationDate, scenarioPairs } from '../../saju/population';
import { FORMULAS, axesOf, previewOf, runScenario, scenarioPeople, scoreOf } from './comparison';

/**
 * 비교기의 약속과 **작은 표본의 머리 수** — 수가 움직이면 무엇이 움직였는지 드러난다.
 *
 * 시험은 쌍 300 · 보는 사람 5 × 후보 50 으로 돈다(몇 초). 노트의 표(쌍 5000 · 보는 사람 30 × 후보 200 ·
 * 시나리오 여섯)는 같은 `runScenario` 를 기본 크기로 부른 값이다 — 여섯을 다 돌면 3 분쯤 걸려 여기서 돌지 않는다.
 */

const day = (name: string) => {
  const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
  if (!pillar) throw new Error(name);
  return { day: pillar };
};

const summary = (counts: Partial<ElementSummary['counts']>, glyphCount = 8): ElementSummary => {
  const full = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0, ...counts };
  return { glyphCount, counts: full, ratios: full };
};

describe('축 — 가설 값이 말한 대로 선다', () => {
  it('일주 · 일지 관계가 없으면 50 이다', () => {
    expect(dayPillarAxisOf(day('甲子'), day('丙寅'))).toBe(DAY_PILLAR_AXIS.neutral);
  });

  it('일지 충 하나는 25 에서 멈춘다 — 무게 40 에서 총점 −10', () => {
    expect(dayPillarAxisOf(day('甲子'), day('甲午'))).toBe(25);
  });

  it('일지 육합 하나는 75, 천간합과 함께면 90 에서 멈춘다', () => {
    expect(dayPillarAxisOf(day('甲子'), day('乙丑'))).toBe(75);
    expect(dayPillarAxisOf(day('甲子'), day('己丑'))).toBe(90);
  });

  it('필요 보완은 드러난 글자 20% 에서 가득 차고, 가장 무거운 오행을 보태면 줄어든다', () => {
    const receiver: NeedTargets = { primary: '水', heaviest: '火', withheld: false };
    expect(needComplementDirectional(receiver, summary({ 水: 2, 土: 6 }))).toBe(100);
    expect(needComplementDirectional(receiver, summary({ 水: 1, 土: 7 }))).toBeCloseTo(62.5);
    expect(needComplementDirectional(receiver, summary({ 水: 2, 火: 2, 土: 4 }))).toBe(70);
    expect(needComplementDirectional(receiver, summary({ 土: 8 }))).toBe(0);
  });
});

describe('모집단 — 시나리오의 가설', () => {
  it('성인 시나리오는 평가일에 만 19~60 세다', () => {
    for (const [a, b] of scenarioPairs('adults', 500)) {
      for (const person of [a, b]) {
        expect(ageOnEvaluationDate(person)).toBeGreaterThanOrEqual(19);
        expect(ageOnEvaluationDate(person)).toBeLessThanOrEqual(60);
      }
    }
  });

  it('±5 연인 시나리오의 나이 차는 5 년 안이고, 부모 · 자녀는 20~40 년이다', () => {
    for (const [a, b] of scenarioPairs('romantic-5', 500)) {
      expect(Math.abs(ageOnEvaluationDate(a) - ageOnEvaluationDate(b))).toBeLessThanOrEqual(5);
    }
    for (const [child, parent] of scenarioPairs('parent-child', 500)) {
      const gap = ageOnEvaluationDate(parent) - ageOnEvaluationDate(child);
      expect(gap).toBeGreaterThanOrEqual(20);
      expect(gap).toBeLessThanOrEqual(40);
    }
  });
});

describe('공식 표', () => {
  it('current 는 discovery-v1 의 previewScoreOf 와 한 점도 다르지 않다', () => {
    const current = FORMULAS.find((f) => f.id === 'current');
    if (!current) throw new Error('current 가 없다');
    for (const [a, b] of scenarioPeople('adults', 300)) {
      expect(scoreOf(current, axesOf(a, b))).toBe(previewOf(a, b));
    }
  });

  it('공식마다 무게의 합이 1 이다', () => {
    for (const formula of FORMULAS) {
      const { dayPillar, need, balance, countComplement } = formula.weights;
      expect(dayPillar + need + balance + countComplement).toBeCloseTo(1);
    }
  });
});

describe('작은 표본의 머리 수 — 성인 시나리오', () => {
  const report = runScenario('adults', { pairs: 300, viewers: 5, candidates: 50 });

  it('분포', () => {
    expect(
      Object.fromEntries(
        Object.entries(report.distribution).map(([id, d]) => [id, [d.mean, d.sd, d.p50, d.in62to68]]),
      ),
    ).toEqual(LOCKED.distribution);
  });

  it('보는 사람의 상위 10 · 세기 후보', () => {
    expect(
      Object.fromEntries(Object.entries(report.viewers).map(([id, v]) => [id, [v.top10Overlap, v.spearman.p50]])),
    ).toEqual(LOCKED.viewers);
    expect(
      Object.fromEntries(Object.entries(report.strength).map(([id, s]) => [id, s.primaryChanged])),
    ).toEqual(LOCKED.primaryChanged);
  });
});

/** 2026-09-25 에 잰 값 — [평균, 표준편차, 중앙값, 62~68 몫] · [상위 10 겹침, Spearman 중앙값] · 억부 1순위가 바뀐 몫 */
const LOCKED = {
  distribution: {
    'v2-romantic': [56.96, 11, 57, 0.18],
    'v2-general': [60.03, 16.21, 61, 0.173],
    current: [63.82, 8.9, 64, 0.283],
    B: [57.32, 12.43, 58, 0.19],
    C: [62.05, 14.7, 63, 0.17],
  },
  viewers: {
    'v2-romantic': [3.2, 0.147],
    'v2-general': [2.8, 0.163],
    current: [10, 1],
    B: [2.8, 0.257],
    C: [3.8, 0.276],
  },
  primaryChanged: { engine: 0, 'month-x2': 0.13, 'hidden-60-30-10': 0.048, both: 0.158 },
};
