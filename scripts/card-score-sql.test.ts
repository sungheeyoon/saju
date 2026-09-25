import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BRANCHES,
  ELEMENTS,
  STEMS,
  chartSnapshotOf,
  computeSaju,
  pillarOf,
  type Branch,
  type Element,
  type Stem,
} from '../src/lib/saju';
import { randomInputs, withoutHour } from '../src/lib/saju/population';

import { dayPillarAxisOf, dayPillarRelationKinds, needTargetsFor } from '../src/lib/discovery/compat-axes';
import type { ElementSummary } from '../src/lib/discovery/element-axes';
import { previewScoreOf } from '../src/lib/discovery';
import { NEED_SUMMARY_RULE, needSummaryOf } from '../src/lib/discovery/need-summary';

/**
 * 후보 카드의 `v2-beta` 점수 — **SQL 과 TS 가 같은 표를 읽는다** (ADR 0113).
 *
 * 카드의 수는 SQL(`discovery_preview_score_v2`)이 내고, 궁합풀이의 기준점과 비교기는 TS 가 낸다. 두 셈을 잇는
 * 것은 `supabase/tests/60_card_score_v2.test.sql` 의 두 표다 — pgTAP 은 SQL 이 표대로 내는지 재고, 이 시험은
 * **그 파일을 열어** 같은 줄을 TS 로 다시 잰다. 표를 옮겨 적지 않으므로 한쪽만 고칠 수 없다.
 *
 * TS 쪽은 진입점 하나(`previewScoreOf`, 후보 카드는 언제나 연인용 정책)로 잰다 — 무게와 반올림을 여기서 다시 적지 않는다.
 */

const PGTAP = readFileSync(join(process.cwd(), 'supabase/tests/60_card_score_v2.test.sql'), 'utf8');

/** `-- 표 시작: 이름` 과 `-- 표 끝: 이름` 사이의 `(…),` 줄들 */
function tableRows(name: string): string[][] {
  const start = PGTAP.indexOf(`-- 표 시작: ${name}`);
  const end = PGTAP.indexOf(`-- 표 끝: ${name}`);
  if (start < 0 || end < start) throw new Error(`표 「${name}」 을 찾지 못했다`);
  return PGTAP.slice(start, end)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('(') && !line.startsWith('(null'))
    .map((line) =>
      line
        .replace(/^\(/, '')
        .replace(/\),?$/, '')
        .split(/,\s(?=')|,\s(?=\d)/)
        .map((cell) => cell.replace(/^'|'$/g, '')),
    );
}

const summaryOf = (counts: string): ElementSummary => {
  const n = counts.split(',').map(Number);
  const glyphCount = n.reduce((sum, one) => sum + one, 0);
  return {
    glyphCount,
    counts: Object.fromEntries(ELEMENTS.map((element, i) => [element, n[i]])) as Record<Element, number>,
    ratios: Object.fromEntries(ELEMENTS.map((element, i) => [element, n[i] / glyphCount])) as Record<Element, number>,
  };
};

const dayOf = (glyphs: string) => {
  const day = pillarOf(glyphs[0] as Stem, glyphs[1] as Branch);
  if (day === null) throw new Error(`60갑자에 없는 일주 ${glyphs}`);
  return { day };
};

const targetsOf = (two: string) => ({
  primary: two[0] as Element,
  heaviest: two[1] as Element,
});

describe('일주 관계 이름 — SQL 표와 엔진이 같다', () => {
  const rows = tableRows('일주 관계');
  const expected = new Map(rows.map(([x, y, kinds]) => [`${x}${y}`, kinds]));

  it('표는 천간 18 줄 · 지지 86 줄이다', () => {
    expect(rows).toHaveLength(104);
  });

  it('천간 100 쌍의 관계 이름이 엔진과 같다', () => {
    for (const x of STEMS) {
      for (const y of STEMS) {
        const kinds = dayPillarRelationKinds(
          { day: { stem: x, branch: '子' } as never },
          { day: { stem: y, branch: '子' } as never },
        );
        expect([...kinds].sort().join(','), `${x}${y}`).toBe(expected.get(`${x}${y}`) ?? '');
      }
    }
  });

  it('지지 144 쌍의 관계 이름이 엔진과 같다', () => {
    for (const x of BRANCHES) {
      for (const y of BRANCHES) {
        const kinds = dayPillarRelationKinds(
          { day: { stem: '甲', branch: x } as never },
          { day: { stem: '甲', branch: y } as never },
        );
        expect([...kinds].sort().join(','), `${x}${y}`).toBe(expected.get(`${x}${y}`) ?? '');
      }
    }
  });
});

describe('카드 점수 — SQL 표와 TS 가 같다', () => {
  const rows = tableRows('카드 점수');

  it('표는 열아홉 쌍이다', () => {
    expect(rows).toHaveLength(19);
  });

  it.each(rows)('%s(%s · %s) × %s 의 일주 축과 점수가 표와 같다', (aDay, aCounts, aNeed, bDay, bCounts, bNeed, dayAxis, score) => {
    const a = { pillars: dayOf(aDay), summary: summaryOf(aCounts), need: targetsOf(aNeed) };
    const b = { pillars: dayOf(bDay), summary: summaryOf(bCounts), need: targetsOf(bNeed) };

    expect(dayPillarAxisOf(a.pillars, b.pillars)).toBe(Number(dayAxis));
    expect(previewScoreOf(a, b, { policy: 'romantic' })).toBe(Number(score));
  });
});

describe('필요한 기운 요약 — 여덟 글자에서 만든 것이 명식에서 만든 것과 같다', () => {
  /**
   * 앱은 제 명식에서, 전환 백필은 `person.current_chart` 에서 요약을 만든다. 둘 다 `needSummaryOf` 를 지나지만
   * 앞의 것은 `meta`(절기 시각)를 든 명식이고 뒤의 것은 글자뿐이다 — 억부가 `meta` 를 안 보는지 여기서 잰다.
   */
  it('시각을 아는 사람 · 모르는 사람 이백 명에서 같다', () => {
    const inputs = randomInputs(100, 20260925);
    for (const input of [...inputs, ...inputs.map(withoutHour)]) {
      const saju = computeSaju(input);
      const fromPillars = needTargetsFor(saju.pillars);
      expect(needSummaryOf(chartSnapshotOf(saju.pillars))).toEqual({
        primary: fromPillars.primary,
        heaviest: fromPillars.heaviest,
        rule: NEED_SUMMARY_RULE,
      });
    }
  });

  /**
   * 요약이 드는 셈 이름이 DB 의 「지금 이름」(`discovery_need_rule()`)과 같다. 엔진이 억부 규칙이나 오행 무게를
   * 올리면 여기가 깨진다 — 그날은 DB 의 이름을 올리는 마이그레이션과 전환 백필이 함께 가야 한다(ADR 0114).
   */
  it('셈 이름이 DB 의 지금 이름과 같다', () => {
    const line = PGTAP.match(/select is\(public\.discovery_need_rule\(\), '([^']+)'/);
    expect(line?.[1]).toBe(NEED_SUMMARY_RULE);
  });
});
