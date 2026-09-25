import { describe, expect, it } from 'vitest';

import { JOHU_TABLE, johuAssessmentOf } from '@/src/lib/saju/analysis/johu';
import { JOHU_SEASON_BY_MONTH, johuJudgementOf } from '@/src/lib/saju/analysis/johuJudgement';
import type { Grade, JohuJudgement } from '@/src/lib/saju/analysis/needProfileTypes';
import { BRANCHES, pillarOf, type Branch, type Stem } from '@/src/lib/saju/constants';
import { getFourPillars } from '@/src/lib/saju/pillars';

/** 간지 넷으로 명식을 짓는다 — 반월을 안 보는 자리에서만 */
const chart = (year: string, month: string, day: string, hour: string | null) => {
  const parse = (name: string) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
    if (!pillar) throw new Error(`간지가 아니다: ${name}`);
    return pillar;
  };
  const parsedDay = parse(day);
  return {
    year: parse(year),
    month: parse(month),
    day: parsedDay,
    hour: hour === null ? null : parse(hour),
    dayMaster: parsedDay.stem,
  };
};

const needOf = (judgement: JohuJudgement, stem: Stem) => {
  const found = judgement.stems.find((need) => need.stem === stem);
  if (!found) throw new Error(`권한 글자에 ${stem} 이 없다`);
  return found;
};

const conditionOf = (judgement: JohuJudgement, kind: JohuJudgement['conditions'][number]['kind']) =>
  judgement.conditions.filter((condition) => condition.kind === kind);

const GRADE_ORDER: readonly Grade[] = ['low', 'medium', 'high'];

describe('조후 판정 — 글자로 말한다', () => {
  /**
   * 乙丑은 丙 하나를 전용한다. 丁卯 · 丁丑 · 乙卯 · 丁亥 — 丙은 천간에도 지장간(丑 癸辛己 ·
   * 卯 甲乙 · 亥 戊甲壬)에도 없고, 같은 불인 丁만 천간에 드러났다. 丁이 丙 자리에 선다고 표가
   * 말하지 않았으므로 대체는 `unresolved` 다.
   */
  it('같은 오행의 다른 글자만 있으면 필요한 글자는 없음이고 옆 글자는 사실로만 선다', () => {
    const judgement = johuJudgementOf(chart('丁卯', '丁丑', '乙卯', '丁亥'));
    const bing = needOf(judgement, '丙');

    expect(bing).toMatchObject({
      element: '火',
      presence: 'absent',
      rooted: null,
      substitutable: 'unresolved',
      active: true,
    });
    expect(bing.sameElementOthers).toEqual([{ stem: '丁', presence: 'revealed' }]);
  });

  /** 丙巳는 「壬이 없으면 癸」 — 표가 같은 오행의 대신을 말했으니 壬은 대체 가능이다 */
  it('표가 같은 오행의 대신을 말한 칸에서만 대체가 참이다', () => {
    const judgement = johuJudgementOf(chart('丙午', '癸巳', '丙寅', '甲午'));

    expect(needOf(judgement, '壬').substitutable).toBe(true);
    expect(needOf(judgement, '壬').presence).toBe('absent');
    expect(needOf(judgement, '癸').active).toBe(true);
    expect(needOf(judgement, '庚').substitutable).toBe('unresolved');
  });

  /**
   * 丙午는 「庚이 申에 통근하면 좋다」. 庚申년이면 申에 뿌리를 두었고, 庚戌년이면 戌의 辛에
   * 뿌리는 있지만 申이 아니라 조건은 서지 않는다 — 뿌리의 사실과 조건의 판정이 따로 간다.
   */
  it('통근 조건은 적힌 지지에 뿌리를 두었을 때만 선다', () => {
    const inShen = johuJudgementOf(chart('庚申', '甲午', '丙子', '戊子'));
    const inXu = johuJudgementOf(chart('庚戌', '甲午', '丙子', '戊子'));

    expect(conditionOf(inShen, 'stem-rooting')[0].evaluation).toBe('met');
    expect(needOf(inShen, '庚').rooted).toBe(true);

    expect(conditionOf(inXu, 'stem-rooting')[0].evaluation).toBe('not-met');
    expect(needOf(inXu, '庚').rooted).toBe(true);
    expect(inXu.unevaluated).toEqual([]);
  });

  /**
   * 辛卯는 「丁의 투출을 꺼린다」. 丁丑년이면 丁이 드러나 꺼림이 서고(met), 乙丑년이면 안 선다.
   * 꺼림은 권한 글자(壬 · 甲)를 끄지 않는다 — 따로 선 사실이다.
   */
  it('꺼림은 사실로 서고 권한 글자를 끄지 않는다', () => {
    const avoided = johuJudgementOf(chart('丁丑', '己卯', '辛酉', '甲午'));
    const clear = johuJudgementOf(chart('乙丑', '己卯', '辛酉', '甲午'));

    expect(conditionOf(avoided, 'avoidance')[0].evaluation).toBe('met');
    expect(conditionOf(clear, 'avoidance')[0].evaluation).toBe('not-met');
    expect(avoided.stems.every((need) => need.active)).toBe(true);
  });

  /** 甲亥의 「수가 왕하면 戊」 — 세력 문턱을 짓지 않으므로 판정하지 않고 종류를 든다 */
  it('세력 문턱 조건은 판정하지 않고 미판정 종류에 든다', () => {
    const judgement = johuJudgementOf(chart('甲子', '乙亥', '甲子', '甲子'));

    expect(conditionOf(judgement, 'force-threshold')[0].evaluation).toBe('not-evaluated');
    expect(judgement.unevaluated).toEqual(['force-threshold']);
    expect(judgement.stems.every((need) => need.active)).toBe(true);
  });

  it('국 조건은 국을 섰다고 볼 등급을 안 골라 판정하지 않는다', () => {
    // 乙辰 「수국이면 戊」 — 申子辰이 다 모여도 판정하지 않는다.
    const judgement = johuJudgementOf(chart('壬申', '庚辰', '乙亥', '丙子'));

    expect(conditionOf(judgement, 'bureau')[0].evaluation).toBe('not-evaluated');
    expect(judgement.unevaluated).toEqual(['bureau']);
  });

  it('계절은 월지 하나에서 나오고 원국 기후 · 급함은 정하지 않는다', () => {
    const judgement = johuJudgementOf(chart('丁卯', '丁丑', '乙卯', '丁亥'));

    expect(judgement.season).toEqual({
      temperature: 'cold',
      moisture: 'wet',
      basis: 'month-branch',
    });
    expect(judgement.chartClimate).toBe('unresolved');
    expect(judgement.urgency).toBe('unresolved');
    expect(judgement.urgencyBasis.length).toBeGreaterThan(0);
    expect(judgement.status).toBe('reference-with-conditions');
    expect(Object.keys(JOHU_SEASON_BY_MONTH).sort()).toEqual([...BRANCHES].sort());
  });
});

describe('조후 판정 — 상 · 하반월', () => {
  /** 2025 소서(7/7)~입추(8/7) 未월에서 甲 · 癸 일간인 날 — 둘 다 반월로 갈리는 칸이다 */
  const days = Array.from({ length: 28 }, (_, index) => {
    const instant = new Date(Date.UTC(2025, 6, 9 + index, 3));
    return { instant, pillars: getFourPillars(instant) };
  }).filter(
    ({ pillars }) => pillars.month.branch === '未' && ['甲', '癸'].includes(pillars.dayMaster),
  );

  it('시각을 주면 그 절반의 글자만 권하고 반월 조건이 선다', () => {
    const halves = new Set<string>();

    for (const { instant, pillars } of days) {
      const judgement = johuJudgementOf(pillars, instant);
      const half = johuAssessmentOf(pillars, instant).half;
      if (half === null) throw new Error('절반을 못 정했다');
      halves.add(half);

      const rule = JOHU_TABLE[pillars.dayMaster].未.halfMonth;
      expect(judgement.stems.map((need) => need.stem)).toEqual(rule?.[half]);
      expect(conditionOf(judgement, 'half-month')[0].evaluation).toBe('met');
      expect(judgement.unevaluated).not.toContain('half-month');
    }

    // 앞 절반 · 뒤 절반을 다 거쳤다.
    expect([...halves].sort()).toEqual(['first', 'second']);
  });

  it('시각이 없으면 반월 조건은 판정하지 않고 표의 글자를 다 든다', () => {
    const [{ pillars }] = days;
    const judgement = johuJudgementOf(pillars);

    expect(judgement.stems.map((need) => need.stem)).toEqual(
      JOHU_TABLE[pillars.dayMaster].未.stems,
    );
    expect(judgement.unevaluated).toContain('half-month');
  });
});

describe('조후 판정 — 시를 모를 때', () => {
  /**
   * 癸寅에서 시를 지우면 辛이 없어 庚이 권해진다. 癸 일간의 시는 壬子부터라 열두 시 중 辛이
   * 들어오는 것은 癸丑(丑 속 辛) · 辛酉 · 壬戌(戌 속 辛) 셋 — 그 셋만 庚이 물러나 답이 바뀐다.
   */
  it('열두 시를 다 넣어 같은 답의 시를 센다', () => {
    const hourless = johuJudgementOf(chart('丙午', '甲寅', '癸卯', null));

    expect(hourless.hour).toEqual({ hourKnown: false, sameAnswerHours: 9 });
    expect(needOf(hourless, '庚').active).toBe(true);
  });

  it('시를 알면 흔들림을 세지 않고 시를 모를 때의 신뢰도가 더 높지 않다', () => {
    const known = johuJudgementOf(chart('丙午', '甲寅', '癸卯', '丁巳'));
    const unknown = johuJudgementOf(chart('丙午', '甲寅', '癸卯', null));

    expect(known.hour).toEqual({ hourKnown: true });
    expect(GRADE_ORDER.indexOf(unknown.confidence)).toBeLessThanOrEqual(
      GRADE_ORDER.indexOf(known.confidence),
    );
    // 조후 외부 대조가 0 건이라 어느 쪽도 `medium` 을 넘지 않는다.
    expect(GRADE_ORDER.indexOf(known.confidence)).toBeLessThanOrEqual(1);
  });
});

describe('조후 판정 — 참고표와 어긋나지 않는다', () => {
  /** 2000~2003 년을 열흘 간격으로 — 월지 열둘 · 일간 열을 고루 지난다 */
  const samples = Array.from({ length: 146 }, (_, index) => {
    const instant = new Date(Date.UTC(2000, 0, 1 + index * 10, (index * 7) % 24));
    return { instant, pillars: getFourPillars(instant) };
  });

  it('참고표의 후보가 같은 순서 · 같은 실재로 앞에 선다', () => {
    for (const { instant, pillars } of samples) {
      const assessment = johuAssessmentOf(pillars, instant);
      const judgement = johuJudgementOf(pillars, instant);

      expect(
        judgement.stems
          .slice(0, assessment.candidates.length)
          .map((need) => [need.stem, need.presence]),
      ).toEqual(assessment.candidates.map((candidate) => [candidate.stem, candidate.presence]));
      expect(judgement.hour).toEqual({ hourKnown: true });
    }
  });

  it('판정하지 않은 조건의 종류가 빠짐없이 미판정에 든다', () => {
    for (const { instant, pillars } of samples) {
      const judgement = johuJudgementOf(pillars, instant);
      const notEvaluated = new Set(
        judgement.conditions.filter((c) => c.evaluation === 'not-evaluated').map((c) => c.kind),
      );
      expect(new Set(judgement.unevaluated)).toEqual(notEvaluated);
    }
  });
});
