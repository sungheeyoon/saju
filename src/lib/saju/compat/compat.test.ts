import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import { tenGodOf } from '@/src/lib/saju/analysis';
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
    expect(analyzeCompatibility(known, unknown).warnings[0]).toContain('두 번째 사람');
    expect(analyzeCompatibility(unknown, known).warnings[0]).toContain('첫 번째 사람');
    expect(analyzeCompatibility(unknown, unknown).warnings[0]).toContain('두 사람 모두');
  });

  /**
   * 甲이 본 辛은 정관이지만 辛이 본 甲은 정재다. 한 방향만 내면 누구 눈으로 본
   * 것인지 잃어버리므로 양쪽을 다 내고, 두 값이 실제로 다르다는 것을 못박는다.
   */
  it('십성은 양방향을 모두 내고 서로 다를 수 있다', () => {
    // 1990-05-15 일간 庚 · 1992-08-20 일간 己 (엔진이 뽑은 값)
    const a = computeSajuOf(1990, 5, 15, 14);
    const b = computeSajuOf(1992, 8, 20, 9);
    const compat = analyzeCompatibility(a, b);

    expect(compat.tenGods.aSeesB).toBe(tenGodOf(a.pillars.dayMaster, b.pillars.dayMaster));
    expect(compat.tenGods.bSeesA).toBe(tenGodOf(b.pillars.dayMaster, a.pillars.dayMaster));
    // 뒤집어 넣으면 값도 뒤집힌다 — 방향이 붙어 있다는 뜻이다.
    expect(analyzeCompatibility(b, a).tenGods.aSeesB).toBe(compat.tenGods.bSeesA);
  });

  it('오행 보완은 있고 없음만 세고 점수로 환산하지 않는다', () => {
    const a = computeSajuOf(1990, 5, 15, 14);
    const b = computeSajuOf(1992, 8, 20, 9);
    const { elementSupport } = analyzeCompatibility(a, b);

    for (const [side, mine, partner] of [
      ['a', a, b],
      ['b', b, a],
    ] as const) {
      const support = elementSupport[side];

      expect(support.missing).toEqual(mine.analysis.elements.missing);
      // 채워지는 것과 못 채우는 것이 합치면 없는 오행 전체다 — 빠뜨리는 칸이 없다.
      expect([...support.supplied, ...support.stillMissing].sort()).toEqual(
        [...support.missing].sort(),
      );
      for (const element of support.supplied) {
        expect(partner.analysis.elements.counts[element]).toBeGreaterThan(0);
      }
      for (const element of support.stillMissing) {
        expect(partner.analysis.elements.counts[element]).toBe(0);
      }
      expect(support.weakest.element).toBe(mine.analysis.elements.weakest);
      expect(support.weakest.partnerRatio).toBe(
        partner.analysis.elements.ratios[mine.analysis.elements.weakest],
      );
    }
  });

  /**
   * 궁합으로 넘어오면서 시험값 딱지가 떨어지면 근거 없는 확신이 결론으로 샌다.
   * 억부가 아직 못 본 것들까지 그대로 물려받는지 본다.
   */
  it('억부 부합은 각자의 억부 판정을 딱지째 물려받는다', () => {
    const a = computeSajuOf(1990, 5, 15, 14);
    const b = computeSajuOf(1992, 8, 20, 9);
    const { eokbuMatch } = analyzeCompatibility(a, b);

    expect(eokbuMatch.a.status).toBe('experimental');
    expect(eokbuMatch.a.element).toBe(a.analysis.eokbu.suggestedElement);
    expect(eokbuMatch.a.role).toBe(a.analysis.eokbu.role);
    expect(eokbuMatch.a.unresolved).toEqual(a.analysis.eokbu.unresolved);
    expect(eokbuMatch.a.unresolved.length).toBeGreaterThan(0);

    // 상대에게 그 오행이 있는지는 상대 원국에서 센다.
    expect(eokbuMatch.a.presentInPartner).toBe(
      b.analysis.elements.counts[a.analysis.eokbu.suggestedElement] > 0,
    );
    expect(eokbuMatch.b.element).toBe(b.analysis.eokbu.suggestedElement);
  });

  it('시간 미상이면 없는 오행이 부풀 수 있다는 것도 함께 경고한다', () => {
    const known = computeSajuOf(1990, 5, 15, 14);
    const unknown = computeSajuOf(1988, 7, 15, null);
    const { warnings } = analyzeCompatibility(known, unknown);

    expect(warnings).toHaveLength(2);
    expect(warnings[1]).toContain('없는 오행');
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
      elementSupport: 'facts-only',
      tenGods: 'both-directions',
      eokbu: 'inherits-experimental',
      spouseSeat: 'display-only',
    });
  });
});
