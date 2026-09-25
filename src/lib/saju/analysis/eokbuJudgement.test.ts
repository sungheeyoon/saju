import { describe, expect, it } from 'vitest';

import { computeSaju, type Saju } from '..';
import { BRANCHES, pillarOf, type Branch, type Stem } from '../constants';
import { hourPillarOf } from '../pillars/hour';
import { randomInputs, withoutHour } from '../population';
import { eokbuJudgementOf } from './eokbuJudgement';
import type { Grade } from './needProfileTypes';
import { EOKBU_EXTERNAL_CASES } from './validation/eokbuExternalCases';

/** 1200개 명식(시 있음 600 · 시 없음 600, 시 없음은 열두 시를 다 돈다)이라 기본 5초로는 모자란다 */
const POPULATION_TIMEOUT_MS = 30_000;

function chartOf(id: string) {
  const testCase = EOKBU_EXTERNAL_CASES.find((entry) => entry.id === id);
  if (testCase === undefined) throw new Error(`외부 사례가 없다: ${id}`);
  const parse = (name: string) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
    if (pillar === undefined || pillar === null) throw new Error(`간지가 아니다: ${name}`);
    return pillar;
  };
  const day = parse(testCase.pillars.day);

  return {
    testCase,
    chart: {
      year: parse(testCase.pillars.year),
      month: parse(testCase.pillars.month),
      day,
      hour: parse(testCase.pillars.hour),
      dayMaster: day.stem,
    },
  };
}

const GRADE_RANK: Record<Grade, number> = { low: 0, medium: 1, high: 2 };

describe('억부 판정은 기존 억부 오행을 1순위로 편다', () => {
  /**
   * 모집단 표본(`randomInputs` 시드 20260821, `calibration.test.ts` 와 같은 표본의 앞 600)을
   * 시가 있는 채로 · 시를 지운 채로 둘 다 넣는다. 1순위가 `analyzePillars` 가 낸 억부 오행과
   * 한 건이라도 갈리면 필요 오행 프로필과 원국 화면이 같은 명식에 다른 말을 한다.
   */
  it(
    '1순위 오행은 표본 1200개 명식 전부에서 eokbuAssessmentOf 의 오행과 같다',
    () => {
      const sajus: Saju[] = randomInputs(600).flatMap((input) => [
        computeSaju(input),
        computeSaju(withoutHour(input)),
      ]);
      expect(sajus).toHaveLength(1200);

      for (const saju of sajus) {
        const judgement = eokbuJudgementOf(saju.pillars);

        expect(judgement.candidates[0].rule).toBe('primary');
        expect(judgement.candidates[0].element).toBe(saju.analysis.eokbu.suggestedElement);
        expect(judgement.candidates[0].role).toBe(saju.analysis.eokbu.role);
        expect(judgement.direction).toBe(
          saju.analysis.strength.verdict === 'weak' ? 'support' : 'restrain',
        );
        expect(judgement.verdict).toBe('judged');
        expect(judgement.unresolved).toEqual(saju.analysis.eokbu.unresolved);
      }
    },
    POPULATION_TIMEOUT_MS,
  );

  /**
   * 시를 모르는 명식은 **어느 시를 넣은 판정보다도 신뢰도가 높지 않다.** 열두 시 중 하나라도
   * 1순위가 갈리면 `low` 다.
   */
  it(
    '시 미상은 신뢰도를 낮추거나 그대로 두고 올리지 않는다',
    () => {
      let checked = 0;
      for (const input of randomInputs(200)) {
        const { pillars } = computeSaju(withoutHour(input));
        const hourless = eokbuJudgementOf(pillars);
        if (hourless.hour.hourKnown) throw new Error('시를 지웠는데 시가 있다');

        const completions = BRANCHES.map((branch) =>
          eokbuJudgementOf({ ...pillars, hour: hourPillarOf(pillars.dayMaster, branch) }),
        );
        const same = completions.filter(
          (completion) => completion.candidates[0].element === hourless.candidates[0].element,
        ).length;
        expect(hourless.hour.sameAnswerHours).toBe(same);

        for (const completion of completions) {
          expect(completion.hour).toEqual({ hourKnown: true });
          expect(GRADE_RANK[hourless.confidence]).toBeLessThanOrEqual(
            GRADE_RANK[completion.confidence],
          );
        }
        if (same < 12) expect(hourless.confidence).toBe('low');
        checked += 1;
      }
      expect(checked).toBe(200);
    },
    POPULATION_TIMEOUT_MS,
  );

  /**
   * `8ja-160`(己未 乙亥 丁酉 甲辰) — 시를 알면 `medium` 조건이 다 선다(대안 없음 · 1순위 木이
   * 월간 乙 · 시간 甲에 투간 · 강약 기준 셋이 한쪽 · 종격 안 섬). 시를 지우면 열두 시 중 여덟만
   * 같은 木을 내므로 `low` 로 내려간다. 반대로 `qlmg-lu`(癸未 甲子 丙戌 己亥)는 열두 시가 다
   * 같은 답이고 그 열두 판정이 모두 `medium` 이라 시를 지워도 그대로다.
   */
  it('시를 모르면 열두 시가 같은 답일 때만 신뢰도를 지킨다', () => {
    const lowered = chartOf('8ja-160-weak-jeonghwa').chart;
    expect(eokbuJudgementOf(lowered).confidence).toBe('medium');
    const loweredHourless = eokbuJudgementOf({ ...lowered, hour: null });
    expect(loweredHourless.hour).toEqual({ hourKnown: false, sameAnswerHours: 8 });
    expect(loweredHourless.confidence).toBe('low');

    const kept = chartOf('qlmg-lu-weak-byeonghwa').chart;
    expect(eokbuJudgementOf(kept).confidence).toBe('medium');
    const keptHourless = eokbuJudgementOf({ ...kept, hour: null });
    expect(keptHourless.hour).toEqual({ hourKnown: false, sameAnswerHours: 12 });
    expect(keptHourless.confidence).toBe('medium');
  });
});

describe('후보가 앉은 자리', () => {
  /**
   * `8ja-136`(戊辰 壬戌 甲辰 庚午, 甲木 일간) — 신약에 재성(土)이 가장 무거워 1순위는 비겁 木이다.
   * 그런데 木은 일간 甲 말고는 천간에 없고 지지 본기도 아니다 — 辰 두 개의 여기 乙에만 있다.
   * 후보는 둘(1순위 木 · 대안 水)이지만 1순위는 쓸 글자가 숨어 있고, 출처가 고른 인성 水는
   * 월간 壬으로 드러났다. 「후보가 있다」와 「쓸 수 있다」가 갈리는 자리다.
   */
  it('후보가 둘이어도 1순위가 지장간에만 있으면 그 자리를 그대로 말한다', () => {
    const judgement = eokbuJudgementOf(chartOf('8ja-136-wealth-heavy-gapmok').chart);

    expect(judgement.heaviest).toEqual({ element: '土', role: '財星' });
    expect(judgement.candidates.map(({ element, rule, seat }) => ({ element, rule, seat }))).toEqual([
      { element: '木', rule: 'primary', seat: 'hidden-only' },
      { element: '水', rule: 'alternative', seat: 'revealed' },
    ]);
    expect(judgement.candidates[0].revealedAt).toEqual([]);
    expect(judgement.candidates[0].hiddenAt).toEqual(['year', 'day']);
    expect(judgement.candidates[1].revealedAt).toEqual(['month']);
    // 대안이 선 명식은 `medium` 이 못 된다.
    expect(judgement.confidence).toBe('low');
  });

  /**
   * `dtsm-shuaiwang-mok-soe-geuk`(衰極의 木 일간) — 1순위가 비겁 木인데 일간 자신을 빼면
   * 여덟 글자 어디에도, 지장간에도 木이 없다. 일간을 세면 「있다」가 되어 쓸 글자가 있는 것처럼
   * 보이는 자리라 일간을 뺀다.
   */
  it('일간 말고는 없는 오행은 absent 다', () => {
    const judgement = eokbuJudgementOf(chartOf('dtsm-shuaiwang-mok-soe-geuk').chart);

    expect(judgement.candidates[0]).toMatchObject({
      element: '木',
      seat: 'absent',
      revealedAt: [],
      hiddenAt: [],
    });
  });
});

describe('종격 · 합화', () => {
  /**
   * `8ja-149`(己未 丙子 戊辰 丙辰) — 엔진의 종격 판정이 `true-following` 으로 서는 억부 논리
   * 사례다. 1순위는 여전히 억부의 木이지만(서열은 억부) 방향이 뒤집힐 수 있다고 알린다.
   * 출처도 木을 안 쓰고 水를 쓴다.
   */
  it('종격이 서면 followingMayReverse 가 선다', () => {
    const judgement = eokbuJudgementOf(chartOf('8ja-149-stagnant-muto').chart);

    expect(judgement.followingMayReverse).toBe(true);
    expect(judgement.verdict).toBe('judged');
    expect(judgement.candidates[0].element).toBe('木');
    expect(judgement.confidence).toBe('low');

    // 종격이 안 서는 쪽 — 같은 억부 논리 사례.
    expect(eokbuJudgementOf(chartOf('8ja-160-weak-jeonghwa').chart).followingMayReverse).toBe(false);
  });

  /**
   * `qlmg-ma`(乙酉 丁亥 己丑 甲子, 己土 일간) — 亥子丑 수방이 월지 亥의 木 · 土와 일지 丑의
   * 土를 水로 끌어가고(酉丑 반합이 丑의 土 일부를 金으로), 실효 분포에서 水(재성)가 木(관성)을
   * 앞선다. 그래서 실효로 보면 「신약 · 재성 최다 → 비겁 土」, 글자 그대로 보면 「신약 · 관성
   * 최다 → 인성 火」다. 출처는 火를 쓴다 — 합화 · 국을 끄면 억부 20건 중 이 한 건만 맞게
   * 바뀐다(측정 3). 실효 쪽에서도 火는 대안으로 남는다(월간 丁 투간).
   */
  it('합화 · 국이 가장 무거운 쪽을 바꾸면 1순위가 바뀐다', () => {
    const { chart } = chartOf('qlmg-ma-unstated-gito');
    const effective = eokbuJudgementOf(chart);
    const literal = eokbuJudgementOf(chart, {
      strength: { basis: 'literal' },
      distribution: 'literal',
    });

    expect(effective.heaviest).toEqual({ element: '水', role: '財星' });
    expect(effective.candidates.map(({ element, rule }) => `${rule}:${element}`)).toEqual([
      'primary:土',
      'alternative:火',
    ]);
    expect(literal.heaviest).toEqual({ element: '木', role: '官星' });
    expect(literal.candidates.map(({ element, rule }) => `${rule}:${element}`)).toEqual([
      'primary:火',
    ]);
    // 강약은 두 길 다 신약이다 — 바뀐 것은 「무엇이 가장 무거운가」 하나다.
    expect(effective.direction).toBe('support');
    expect(literal.direction).toBe('support');
  });
});

describe('외부 억부 사례 회귀 (억부 논리 20건)', () => {
  const scored = EOKBU_EXTERNAL_CASES.filter(
    (testCase) =>
      testCase.chartConstruction === 'consistent' &&
      (testCase.yongsinDoctrine ?? 'eokbu') === 'eokbu',
  ).map((testCase) => {
    const { chart } = chartOf(testCase.id);
    return {
      testCase,
      judgement: eokbuJudgementOf(chart),
      hourless: eokbuJudgementOf({ ...chart, hour: null }),
    };
  });

  /**
   * 1순위는 `eokbu.external.test.ts` 가 든 10/20 그대로여야 한다. 1순위나 대안 중 하나가 맞는
   * 수 15/20 은 **대안을 이 스무 건에서 맞췄으니** 성적이 아니라 맞춘 결과다 — 표본 밖 사례
   * 없이는 대안을 1순위로 올릴 근거가 못 된다(ADR 0111).
   */
  it('1순위 10/20, 1순위 또는 대안 15/20', () => {
    expect(scored).toHaveLength(20);
    const hits = (pick: (row: (typeof scored)[number]) => boolean) => scored.filter(pick).length;

    expect(
      hits(({ testCase, judgement }) => judgement.candidates[0].element === testCase.claim.suggestedElement),
    ).toBe(10);
    expect(
      hits(({ testCase, judgement }) =>
        judgement.candidates.some(({ element }) => element === testCase.claim.suggestedElement),
      ),
    ).toBe(15);
  });

  /**
   * `medium` 여섯은 여섯 다 출처와 1순위가 맞고, `low` 열넷은 넷만 맞는다. `medium` 조건은
   * 측정 노트의 사실(투간 16/20 · 대안이 모인 자리 · 종격)에서 골랐지 이 스무 건에 하나씩
   * 맞춘 것이 아니지만, 같은 스무 건을 본 뒤라 이것도 표본 안의 수다.
   */
  it('신뢰도 medium 은 6건이고 6건 다 1순위가 맞는다', () => {
    const tally = (confidence: Grade) => {
      const rows = scored.filter(({ judgement }) => judgement.confidence === confidence);
      return {
        total: rows.length,
        agree: rows.filter(
          ({ testCase, judgement }) =>
            judgement.candidates[0].element === testCase.claim.suggestedElement,
        ).length,
      };
    };

    expect(tally('medium')).toEqual({ total: 6, agree: 6 });
    expect(tally('low')).toEqual({ total: 14, agree: 4 });
    expect(tally('high')).toEqual({ total: 0, agree: 0 });
  });

  /** 측정 노트 7 의 「열두 시를 다 넣어도 억부 오행이 하나 — 8/20」을 이 판정이 다시 센다 */
  it('시를 지우면 열두 시가 모두 같은 1순위인 사례는 8/20 이다', () => {
    const sameHours = scored.map(({ hourless }) =>
      hourless.hour.hourKnown ? null : hourless.hour.sameAnswerHours,
    );

    expect(sameHours).toEqual([5, 12, 12, 8, 9, 8, 6, 6, 6, 12, 12, 11, 6, 6, 12, 12, 12, 12, 9, 10]);
    expect(sameHours.filter((count) => count === 12)).toHaveLength(8);
  });
});
