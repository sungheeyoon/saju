import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import {
  COMPAT_CHART_ID,
  COMPAT_POLICY,
  analyzeCompatibility,
  compatSideOf,
  findCompatRelations,
} from '@/src/lib/saju/compat';
import { pillarOf, type Branch, type Stem } from '@/src/lib/saju/constants';

function chart(year: string, month: string, day: string, hour: string | null) {
  const parse = (name: string) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
    if (!pillar) throw new Error(`간지가 아니다: ${name}`);
    return pillar;
  };

  return {
    year: parse(year),
    month: parse(month),
    day: parse(day),
    hour: hour === null ? null : parse(hour),
  };
}

const kosOf = (relations: readonly { ko: string }[]) => relations.map((r) => r.ko);

describe('두 원국 사이의 관계', () => {
  /**
   * 궁합의 몫은 **사이**에 성립하는 것뿐이다. 각자의 원국 안에서 닫힌 관계는
   * 각자의 원국 카드가 이미 보여줬으므로 여기서 또 세면 같은 사실이 두 번 읽힌다.
   */
  it('각자의 원국 안에서 닫힌 관계는 빼고 사이 것만 낸다', () => {
    // A 안에 자오충(년지 子 · 일지 午)이 이미 있다. 그것은 궁합이 아니다.
    const a = chart('丙子', '丁酉', '甲午', '乙丑');
    const b = chart('壬申', '癸卯', '己巳', '甲戌');

    const relations = findCompatRelations(a, b);

    expect(kosOf(relations)).not.toContain('자오충');
    expect(relations.every((relation) => relation.scope !== 'withinChart')).toBe(true);
  });

  it('두 사람의 글자가 짝지으면 누구의 어느 자리인지 함께 낸다', () => {
    // A 일지 午 ↔ B 일지 子 — 자오충. 양쪽에 子·午가 하나씩만 있게 골랐다.
    const relations = findCompatRelations(
      chart('壬申', '丙寅', '庚午', '丁丑'),
      chart('壬申', '丙寅', '庚子', '丁丑'),
    );
    const clash = relations.find((relation) => relation.ko === '자오충');

    expect(clash?.scope).toBe('betweenCharts');
    expect(clash?.participants).toEqual([
      { chartId: COMPAT_CHART_ID.a, position: 'day', char: '午' },
      { chartId: COMPAT_CHART_ID.b, position: 'day', char: '子' },
    ]);
  });

  /**
   * 두 사람의 기둥 사이에는 선형 거리라는 것이 없다. 0 이나 큰 수로 채우면 없는
   * 사실을 지어내는 것이라 `null` 이고, 화면은 거리 대신 자리로 말해야 한다.
   */
  it('계산판이 다르므로 거리와 인접은 언제나 null 이다', () => {
    const relations = findCompatRelations(
      chart('壬申', '丙寅', '庚午', '丁丑'),
      chart('壬申', '丙寅', '庚子', '丁丑'),
    );

    expect(relations.length).toBeGreaterThan(0);
    for (const relation of relations) {
      expect(relation.distance, relation.ko).toBeNull();
      expect(relation.adjacent, relation.ko).toBeNull();
    }
  });

  /**
   * 두 사람의 글자가 합쳐 세 글자 구조를 이루는 것은 쌍 관계와 무게가 다르고,
   * 인정할지 자체가 계통 선택이라 따로 모아 둔다.
   */
  it('두 사람의 글자가 합쳐 이룬 삼합은 따로 표시된다', () => {
    // A 가 申子, B 가 辰 — 셋이 모여야 申子辰 수국이 된다.
    const relations = findCompatRelations(
      chart('壬申', '丙寅', '庚子', '丙寅'),
      chart('甲辰', '丙寅', '甲寅', '丙寅'),
    );
    const combined = relations.find((relation) => relation.ko.includes('수국'));

    expect(combined?.scope).toBe('combinedFormation');
    expect(combined?.full).toBe(true);
    // 두 사람의 글자가 함께 들어가야 '합쳐서 이룸' 이다.
    expect(new Set(combined?.participants.map((participant) => participant.chartId)).size).toBe(2);
  });
});

describe('궁합 결과의 계약', () => {
  /** 실제 입력으로 사주 한 벌 — 시각을 주지 않으면 시간 미상이다 */
  const computeSajuOf = (year: number, month: number, day: number, hour: number | null) =>
    computeSaju(
      hour === null
        ? { year, month, day, hour: null, gender: 'female' }
        : { year, month, day, hour, minute: 0, second: 0, gender: 'female' },
    );

  it('합쳐서 이룬 것은 전체 목록에서 골라낸 것이지 따로 센 것이 아니다', () => {
    const compat = analyzeCompatibility(
      computeSajuOf(1990, 5, 15, 14),
      computeSajuOf(1992, 8, 20, 9),
    );

    for (const formation of compat.combinedFormations) {
      expect(compat.relations).toContain(formation);
      expect(formation.scope).toBe('combinedFormation');
    }
  });

  it('시간 미상이면 관계가 덜 나온다는 사실을 경고로 남긴다', () => {
    const known = computeSajuOf(1990, 5, 15, 14);
    const unknown = computeSajuOf(1988, 7, 15, null);

    expect(analyzeCompatibility(known, known).warnings).toEqual([]);
    expect(analyzeCompatibility(known, unknown).warnings).toHaveLength(1);
    expect(analyzeCompatibility(known, unknown).warnings[0]).toContain('두 번째 사람');
    expect(analyzeCompatibility(unknown, known).warnings[0]).toContain('첫 번째 사람');
    expect(analyzeCompatibility(unknown, unknown).warnings[0]).toContain('두 사람 모두');
  });

  it('두 사람을 서로 다른 이름으로 가리킨다', () => {
    expect(COMPAT_CHART_ID.a).not.toBe(COMPAT_CHART_ID.b);
    expect(compatSideOf(COMPAT_CHART_ID.a)).toBe('a');
    expect(compatSideOf(COMPAT_CHART_ID.b)).toBe('b');
    // 원국 하나짜리 계산의 이름과도 달라야 한다.
    expect(compatSideOf('natal')).toBeNull();
  });

  it('채택한 규칙 묶음을 결과 곁에 남긴다', () => {
    expect(COMPAT_POLICY).toEqual({
      ruleSet: 'compat-facts-v1',
      scoring: 'not-scored',
      combinedFormation: 'included-and-marked',
      detection: 'shared-with-natal-relations',
    });
  });
});
