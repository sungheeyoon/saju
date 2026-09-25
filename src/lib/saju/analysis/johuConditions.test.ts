import { describe, expect, it } from 'vitest';

import { JOHU_TABLE } from '@/src/lib/saju/analysis/johu';
import { JOHU_CONDITIONS, type JohuConditionSpec } from '@/src/lib/saju/analysis/johuConditions';
import { johuJudgementOf } from '@/src/lib/saju/analysis/johuJudgement';
import type { JohuConditionKind } from '@/src/lib/saju/analysis/needProfileTypes';
import {
  BRANCHES,
  SEXAGENARY,
  STEMS,
  STEM_INFO,
  pillarOf,
  type Branch,
  type Stem,
} from '@/src/lib/saju/constants';

const cells = STEMS.flatMap((stem) =>
  BRANCHES.map((branch) => ({
    stem,
    branch,
    specs: JOHU_CONDITIONS[stem][branch],
  })),
);

/** 간지 넷으로 명식을 짓는다 — 시험이 절기 시각까지 알 필요가 없는 자리에서만 */
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

/**
 * 칸 하나를 한 분류에 넣는다 — 측정 노트(2026-09-25 4)의 순서 그대로, 무거운 쪽이 이긴다.
 * 세력 문턱이 하나라도 들면 (b), 없고 적히지 않은 조건이 있으면 (c), 국만 남으면 (a′),
 * 문턱 없는 조건뿐이면 (a), 아무것도 없으면 조건 없음.
 */
function classOf(specs: readonly JohuConditionSpec[]) {
  const kinds = new Set(specs.map((spec) => spec.kind));
  if (kinds.has('force-threshold')) return 'force';
  if (kinds.has('unspecified')) return 'unspecified';
  if (kinds.has('bureau')) return 'bureau';
  if (kinds.size > 0) return 'decidable';
  return 'none';
}

describe('조후 조건표', () => {
  it('120칸 모두 조건 목록이 있고 조건마다 원문 요약이 있다', () => {
    expect(cells).toHaveLength(120);
    for (const { stem, branch, specs } of cells) {
      expect(Array.isArray(specs), `${stem}${branch}`).toBe(true);
      for (const spec of specs) expect(spec.text.length, `${stem}${branch}`).toBeGreaterThan(0);
    }
  });

  it('상 · 하반월 조건은 참고표가 반월을 가른 여섯 칸에만 있다', () => {
    const withHalf = cells.filter(({ specs }) => specs.some((spec) => spec.kind === 'half-month'));
    const tableHalf = cells.filter(({ stem, branch }) => JOHU_TABLE[stem][branch].halfMonth);

    expect(withHalf.map(({ stem, branch }) => `${stem}${branch}`)).toEqual(
      tableHalf.map(({ stem, branch }) => `${stem}${branch}`),
    );
    expect(withHalf).toHaveLength(6);
  });

  /**
   * 측정 노트는 칸 단위로 43 · 24 · 8 · 34 · 11 이었다. 여기는 조건 없음 44 · 적히지 않음 10 이다 —
   * 목록 안의 글자를 「참작한다」고만 한 칸 넷(戊巳 · 辛巳 · 壬巳 · 辛丑)을 한 규칙으로 조건 없음에
   * 두었고, 노트는 그중 어느 하나를 적히지 않음으로 셌는데 어느 칸인지 남기지 않았다.
   */
  it('칸 분류의 수가 측정과 맞는다 — 참작 한 칸만 다르다', () => {
    const counts: Record<string, number> = {};
    for (const { specs } of cells) {
      const found = classOf(specs);
      counts[found] = (counts[found] ?? 0) + 1;
    }

    expect(counts).toEqual({
      none: 44,
      decidable: 24,
      bureau: 8,
      force: 34,
      unspecified: 10,
    });
  });

  /** 조건절 단위(한 칸이 여럿에 든다) — 측정 노트의 첫 표와 같다. 적히지 않음만 12 → 11 */
  it('조건 종류마다 든 칸의 수가 측정과 맞는다', () => {
    const cellsWith = (kind: JohuConditionKind) =>
      cells.filter(({ specs }) => specs.some((spec) => spec.kind === kind)).length;

    expect({
      half: cellsWith('half-month'),
      presence: cellsWith('stem-presence-fallback'),
      rooting: cellsWith('stem-rooting'),
      avoidance: cellsWith('avoidance'),
      bureau: cellsWith('bureau'),
      force: cellsWith('force-threshold'),
      unspecified: cellsWith('unspecified'),
    }).toEqual({
      half: 6,
      presence: 18,
      rooting: 5,
      avoidance: 4,
      bureau: 11,
      force: 34,
      unspecified: 11,
    });
  });

  it('통근과 꺼림은 측정 노트가 짚은 칸 그대로다', () => {
    const where = (kind: JohuConditionKind) =>
      cells
        .filter(({ specs }) => specs.some((spec) => spec.kind === kind))
        .map(({ stem, branch }) => `${stem}${branch}`)
        .sort();

    expect(where('stem-rooting')).toEqual(['丙午', '庚子', '壬申', '癸丑', '癸申'].sort());
    expect(where('avoidance')).toEqual(['乙子', '丙巳', '辛卯', '辛午'].sort());
  });

  /** 대체는 「없으면 같은 오행의 다른 글자」로 적힌 자리에만 선다 */
  it('대체를 말한 조건은 앞 글자 하나가 없을 때 같은 오행 글자 하나를 쓰는 조건이다', () => {
    for (const { stem, branch, specs } of cells) {
      for (const spec of specs) {
        if (spec.kind !== 'stem-presence-fallback') continue;
        const sameElement =
          spec.when === 'absent' &&
          spec.trigger.length === 1 &&
          spec.use.length === 1 &&
          STEM_INFO[spec.trigger[0]].element === STEM_INFO[spec.use[0]].element;
        expect(spec.substitute, `${stem}${branch} ${spec.text}`).toBe(sameElement);
      }
    }
  });

  it('목록 밖 글자를 권하는 대체 처방은 癸寅 · 癸巳 · 庚午 셋이다', () => {
    const outside = cells.filter(({ stem, branch, specs }) =>
      specs.some(
        (spec) =>
          spec.kind === 'stem-presence-fallback' &&
          spec.effect === 'gate' &&
          spec.use.some((used) => !JOHU_TABLE[stem][branch].stems.includes(used)),
      ),
    );

    expect(outside.map(({ stem, branch }) => `${stem}${branch}`).sort()).toEqual(
      ['庚午', '癸寅', '癸巳'].sort(),
    );
  });

  /**
   * 세 칸 모두 앞 글자가 원국 어디에도 없게 지었다.
   * - 癸寅: 丙午 · 甲寅 · 癸卯 · 丁巳 — 辛은 없고 庚은 巳 속에 숨었다.
   * - 癸巳: 丙午 · 丁巳 · 癸卯 · 甲寅 — 같은 여덟 글자를 巳월로 돌렸다.
   * - 庚午: 丙寅 · 甲午 · 庚寅 · 丙戌 — 壬癸가 천간에도 지장간에도 없다.
   */
  it('앞 글자가 없으면 목록 밖 대체 글자가 권해진다', () => {
    const cases = [
      { chart: chart('丙午', '甲寅', '癸卯', '丁巳'), fallback: ['庚'] },
      { chart: chart('丙午', '丁巳', '癸卯', '甲寅'), fallback: ['庚'] },
      { chart: chart('丙寅', '甲午', '庚寅', '丙戌'), fallback: ['戊', '己'] },
    ];

    for (const { chart: pillars, fallback } of cases) {
      const judgement = johuJudgementOf(pillars);
      for (const stem of fallback) {
        const need = judgement.stems.find((candidate) => candidate.stem === stem);
        expect(need?.active, `${judgement.dayMaster}${judgement.monthBranch} ${stem}`).toBe(true);
      }
    }
  });

  it('앞 글자가 있으면 대체 글자는 권해지지 않는다', () => {
    // 癸寅에 辛酉시를 넣었다 — 辛이 드러났으니 庚은 물러난다.
    const judgement = johuJudgementOf(chart('丙午', '甲寅', '癸卯', '辛酉'));

    expect(judgement.stems.find((need) => need.stem === '辛')?.presence).toBe('revealed');
    expect(judgement.stems.find((need) => need.stem === '庚')?.active).toBe(false);
  });

  it('120칸 모두 판정이 조건표의 조건을 하나씩 돌려준다', () => {
    for (const { stem, branch, specs } of cells) {
      const day = SEXAGENARY.find((pillar) => pillar.stem === stem);
      const month = SEXAGENARY.find((pillar) => pillar.branch === branch);
      if (!day || !month) throw new Error(`명식을 못 지었다: ${stem}${branch}`);

      const judgement = johuJudgementOf({
        year: day,
        month,
        day,
        hour: day,
        dayMaster: stem,
      });
      expect(
        judgement.conditions.map((c) => c.kind),
        `${stem}${branch}`,
      ).toEqual(specs.map((spec) => spec.kind));
    }
  });
});
