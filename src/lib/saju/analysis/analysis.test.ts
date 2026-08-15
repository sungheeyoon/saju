import { describe, expect, it } from 'vitest';

import {
  ELEMENTS,
  STEMS,
  STEM_INFO,
  elementRelation,
  principalStem,
  type Stem,
} from '@/src/lib/saju/constants';
import {
  TEN_GOD_GROUP,
  TEN_GOD_KO,
  analyzePillars,
  elementDistributionOf,
  strengthOf,
  tenGodChartOf,
  tenGodOf,
  tenGodOfBranch,
  type TenGod,
} from '@/src/lib/saju/analysis';
import { computeSaju } from '@/src/lib/saju';
import { getFourPillars, fromCivil, type FourPillars } from '@/src/lib/saju/pillars';

const at = (
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
) => ({ year, month, day, hour, minute, second: 0 });

/** 보정 없이 순수 4주만 얻는다 — 분석 테스트는 보정과 무관해야 한다 */
function pillarsOf(year: number, month: number, day: number, hour = 12): FourPillars {
  return getFourPillars(fromCivil(at(year, month, day, hour)));
}

describe('십성(tenGods) — 도출 규칙', () => {
  // 甲(양목) 일간에서 본 10천간. 명리 입문서의 기본 표 그대로다.
  const FROM_GAP: Record<Stem, TenGod> = {
    甲: '比肩', // 같은 오행, 같은 음양
    乙: '劫財', // 같은 오행, 다른 음양
    丙: '食神', // 목생화, 같은 음양
    丁: '傷官', // 목생화, 다른 음양
    戊: '偏財', // 목극토, 같은 음양
    己: '正財', // 목극토, 다른 음양
    庚: '偏官', // 금극목, 같은 음양
    辛: '正官', // 금극목, 다른 음양
    壬: '偏印', // 수생목, 같은 음양
    癸: '正印', // 수생목, 다른 음양
  };

  it('甲 일간의 십성표와 일치한다', () => {
    for (const stem of STEMS) {
      expect(tenGodOf('甲', stem), `甲 → ${stem}`).toBe(FROM_GAP[stem]);
    }
  });

  it('乙(음목) 일간은 음양이 뒤집혀 정편이 바뀐다', () => {
    // 같은 오행 관계라도 일간 음양이 바뀌면 정↔편이 뒤집힌다
    expect(tenGodOf('乙', '丙')).toBe('傷官'); // 甲→丙 은 식신
    expect(tenGodOf('乙', '丁')).toBe('食神');
    expect(tenGodOf('乙', '庚')).toBe('正官'); // 甲→庚 은 편관
    expect(tenGodOf('乙', '辛')).toBe('偏官');
  });

  it('일간 자신은 항상 비견이다', () => {
    for (const stem of STEMS) {
      expect(tenGodOf(stem, stem)).toBe('比肩');
    }
  });

  it('10천간 각각에서 십성 10개가 하나씩 나온다', () => {
    for (const dayMaster of STEMS) {
      const gods = STEMS.map((s) => tenGodOf(dayMaster, s));
      expect(new Set(gods).size, `${dayMaster} 일간`).toBe(10);
    }
  });

  it('음양이 같으면 편(偏) 계열, 다르면 정(正) 계열이다', () => {
    const SAME_POLARITY: TenGod[] = ['比肩', '食神', '偏財', '偏官', '偏印'];

    for (const dayMaster of STEMS) {
      for (const target of STEMS) {
        const samePolarity = STEM_INFO[dayMaster].yinYang === STEM_INFO[target].yinYang;
        const god = tenGodOf(dayMaster, target);
        expect(SAME_POLARITY.includes(god), `${dayMaster}→${target} ${god}`).toBe(samePolarity);
      }
    }
  });

  it('십성 계열이 오행 관계와 일대일로 대응한다', () => {
    const EXPECTED = {
      same: '比劫',
      generates: '食傷',
      controls: '財星',
      controlledBy: '官星',
      generatedBy: '印星',
    } as const;

    for (const dayMaster of STEMS) {
      for (const target of STEMS) {
        const relation = elementRelation(
          STEM_INFO[dayMaster].element,
          STEM_INFO[target].element,
        );
        expect(TEN_GOD_GROUP[tenGodOf(dayMaster, target)]).toBe(EXPECTED[relation]);
      }
    }
  });

  it('지지의 십성은 체 음양이 아니라 지장간 정기를 경유한다', () => {
    // 子는 체로는 陽이지만 정기가 癸(陰水)다. 정기를 써야 맞다.
    expect(tenGodOfBranch('甲', '子')).toBe(tenGodOf('甲', principalStem('子')));
    expect(tenGodOfBranch('甲', '子')).toBe('正印'); // 癸(음수) → 정인
    // 체 음양(陽水=壬)으로 잘못 판정하면 편인이 나온다
    expect(tenGodOfBranch('甲', '子')).not.toBe('偏印');

    expect(tenGodOfBranch('甲', '午')).toBe('傷官'); // 정기 丁(음화)
    expect(tenGodOfBranch('甲', '巳')).toBe('食神'); // 정기 丙(양화)
  });
});

describe('십성(tenGods) — 사주 배치', () => {
  const pillars = pillarsOf(2025, 6, 15);
  const chart = tenGodChartOf(pillars);

  it('일간 자리만 십성이 비어 있다', () => {
    expect(chart.day.stem).toBeNull();
    expect(chart.year.stem).not.toBeNull();
    expect(chart.month.stem).not.toBeNull();
    expect(chart.hour!.stem).not.toBeNull();
  });

  it('네 기둥 모두 지장간의 십성을 갖는다', () => {
    for (const key of ['year', 'month', 'day', 'hour'] as const) {
      const hidden = chart[key]!.hiddenStems;
      expect(hidden.length).toBeGreaterThanOrEqual(2);
      for (const h of hidden) {
        expect(h.tenGod).toBe(tenGodOf(pillars.dayMaster, h.stem));
      }
      // 지지의 십성은 정기의 십성과 같아야 한다
      const principal = hidden.find((h) => h.role === '正氣')!;
      expect(chart[key]!.branch).toBe(principal.tenGod);
    }
  });
});

describe('오행 분포(fiveElements)', () => {
  const pillars = pillarsOf(2025, 6, 15);

  it('단순 개수의 합이 여덟 글자다', () => {
    const { counts } = elementDistributionOf(pillars);
    const total = ELEMENTS.reduce((sum, e) => sum + counts[e], 0);
    expect(total).toBe(8);
  });

  it('가중 점수의 합이 여덟이다 (천간 4 + 지지 4)', () => {
    const { scores } = elementDistributionOf(pillars);
    const total = ELEMENTS.reduce((sum, e) => sum + scores[e], 0);
    expect(total).toBeCloseTo(8, 10);
  });

  it('비율의 합이 1이다', () => {
    const { ratios } = elementDistributionOf(pillars);
    const total = ELEMENTS.reduce((sum, e) => sum + ratios[e], 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('지장간을 펼치므로 본기만 세는 것과 다르다', () => {
    // 寅은 본기가 甲(목)이지만 지장간에 戊(토)·丙(화)를 품는다.
    // 甲寅년 기준으로 화·토 점수가 0이 아니어야 한다.
    const withTiger = getFourPillars(fromCivil(at(2024, 2, 20)));
    const { scores } = elementDistributionOf(withTiger);
    expect(withTiger.month.branch).toBe('寅');
    expect(scores['火']).toBeGreaterThan(0);
    expect(scores['土']).toBeGreaterThan(0);
  });

  it('월지 가중치를 올리면 그 오행 비중이 커진다', () => {
    const plain = elementDistributionOf(pillars);
    const heavy = elementDistributionOf(pillars, { monthBranchMultiplier: 3 });

    const monthElement = STEM_INFO[principalStem(pillars.month.branch)].element;
    expect(heavy.ratios[monthElement]).toBeGreaterThan(plain.ratios[monthElement]);
  });

  it('없는 오행은 여덟 글자 기준으로 판정한다', () => {
    const { counts, missing } = elementDistributionOf(pillars);
    for (const element of missing) {
      expect(counts[element]).toBe(0);
    }
    for (const element of ELEMENTS) {
      if (counts[element] > 0) expect(missing).not.toContain(element);
    }
  });

  it('strongest 와 weakest 가 점수 순서와 맞는다', () => {
    const { scores, strongest, weakest } = elementDistributionOf(pillars);
    for (const element of ELEMENTS) {
      expect(scores[strongest]).toBeGreaterThanOrEqual(scores[element]);
      expect(scores[weakest]).toBeLessThanOrEqual(scores[element]);
    }
  });
});

describe('신강·신약(strength)', () => {
  const pillars = pillarsOf(2025, 6, 15);

  it('세 기준을 모두 판정하고 근거를 남긴다', () => {
    const strength = strengthOf(pillars);
    expect(strength.criteria.map((c) => c.key)).toEqual(['seasonal', 'branch', 'overall']);
    for (const criterion of strength.criteria) {
      expect(criterion.detail.length).toBeGreaterThan(0);
    }
    expect(strength.metCount).toBe(strength.criteria.filter((c) => c.met).length);
  });

  it('충족 기준 수가 임계치 이상이면 신강이다', () => {
    for (const required of [1, 2, 3]) {
      const strength = strengthOf(pillars, { requiredCriteria: required });
      expect(strength.verdict).toBe(strength.metCount >= required ? 'strong' : 'weak');
    }
  });

  it('아군과 적군 점수가 전체를 남김없이 나눈다', () => {
    const strength = strengthOf(pillars, { includeDayMaster: true });
    const { scores } = elementDistributionOf(pillars);
    const total = ELEMENTS.reduce((sum, e) => sum + scores[e], 0);
    expect(strength.supportScore + strength.opposeScore).toBeCloseTo(total, 10);
  });

  it('일간 자신을 빼면 아군 점수가 정확히 1 줄어든다', () => {
    const withSelf = strengthOf(pillars, { includeDayMaster: true });
    const withoutSelf = strengthOf(pillars, { includeDayMaster: false });
    expect(withSelf.supportScore - withoutSelf.supportScore).toBeCloseTo(1, 10);
  });

  it('신강이면 빼는 오행이, 신약이면 보태는 오행이 필요하다', () => {
    // 여러 사주를 훑어 두 갈래가 모두 나오는지 본다
    const samples = [
      pillarsOf(2025, 6, 15),
      pillarsOf(1990, 5, 15),
      pillarsOf(1988, 7, 15),
      pillarsOf(2024, 2, 29),
      pillarsOf(2000, 1, 1),
    ];

    const verdicts = new Set<string>();
    for (const sample of samples) {
      const strength = strengthOf(sample);
      verdicts.add(strength.verdict);

      const dayElement = STEM_INFO[sample.dayMaster].element;
      if (strength.verdict === 'weak') {
        expect(strength.neededElements).toContain(dayElement);
        expect(strength.neededElements).toHaveLength(2);
      } else {
        expect(strength.neededElements).not.toContain(dayElement);
        expect(strength.neededElements).toHaveLength(3);
      }
    }
    // 표본이 한쪽으로만 쏠려 있으면 판정이 굳은 것이다
    expect(verdicts.size).toBe(2);
  });

  it('득령·득지가 십성 계열과 일치한다', () => {
    const strength = strengthOf(pillars);
    const seasonal = strength.criteria.find((c) => c.key === 'seasonal')!;
    const monthGod = tenGodOfBranch(pillars.dayMaster, pillars.month.branch);
    expect(seasonal.met).toBe(['比劫', '印星'].includes(TEN_GOD_GROUP[monthGod]));
    expect(seasonal.detail).toContain(TEN_GOD_KO[monthGod]);
  });
});

describe('통합(analyzePillars)', () => {
  it('computeSaju 가 분석 결과를 함께 낸다', () => {
    const saju = computeSaju(at(1990, 5, 15, 14, 30));
    expect(saju.analysis.strength.verdict).toMatch(/strong|weak/);
    expect(saju.analysis.elements.counts).toBeDefined();
    expect(saju.analysis.tenGods.day.stem).toBeNull();
  });

  it('십성 개수 합이 7이다 (여덟 글자에서 일간 제외)', () => {
    const { analysis } = computeSaju(at(1990, 5, 15, 14, 30));
    const total = Object.values(analysis.tenGodCounts).reduce((a, b) => a + b, 0);
    expect(total).toBe(7);
  });

  it('오행 가중치가 분포와 신강 판정에 함께 반영된다', () => {
    const pillars = pillarsOf(2025, 6, 15);
    const weights = { monthBranchMultiplier: 5 };

    const analysis = analyzePillars(pillars, { weights });
    const direct = strengthOf(pillars, { weights });

    // 같은 가중치를 쓰므로 두 경로의 결과가 어긋나면 안 된다
    expect(analysis.strength.ratio).toBeCloseTo(direct.ratio, 10);
    expect(analysis.strength.verdict).toBe(direct.verdict);
  });

  it('넓은 구간에서 분석이 깨지지 않는다', () => {
    for (let year = 1950; year <= 2030; year += 7) {
      const saju = computeSaju(at(year, 6, 15, 14, 30));
      const { elements, strength, tenGodCounts } = saju.analysis;

      expect(ELEMENTS.reduce((s, e) => s + elements.counts[e], 0), `${year}`).toBe(8);
      expect(Object.values(tenGodCounts).reduce((a, b) => a + b, 0)).toBe(7);
      expect(strength.ratio).toBeGreaterThanOrEqual(0);
      expect(strength.ratio).toBeLessThanOrEqual(1);
    }
  });
});
