import { describe, expect, it } from 'vitest';

import {
  ELEMENTS,
  HIDDEN_STEMS,
  STEMS,
  STEM_INFO,
  elementRelation,
  pillarOf,
  principalStem,
  type Branch,
  type Stem,
} from '@/src/lib/saju/constants';
import { twelveStageOf } from '@/src/lib/saju/stages';
import {
  TEN_GOD_GROUP,
  TEN_GOD_KO,
  analyzePillars,
  effectiveElementsOf,
  elementDistributionOf,
  STRENGTH_POLICY,
  YONGSIN_POLICY,
  eokbuAssessmentOf,
  elementRolesOf,
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
) => ({ year, month, day, hour, minute, second: 0, gender: 'male' as const });

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
    expect(saju.analysis.johu.status).toBe('reference');
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

describe('12운성은 신강·신약 점수에 들어가지 않는다', () => {
  /**
   * 되돌리기 쉬운 결정이라 못박는다. 12운성 이름이 강해 보인다고 점수를 주면
   * 통근·계절 판단과 충돌하고, 통근한 자리는 이미 오행 점수가 세고 있어
   * 같은 사실을 두 번 세게 된다.
   */
  const chart = (year: string, month: string, day: string, hour: string) => {
    const parse = (name: string) => {
      const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
      if (!pillar) throw new Error(`간지가 아니다: ${name}`);
      return pillar;
    };
    const day_ = parse(day);
    return {
      year: parse(year),
      month: parse(month),
      day: day_,
      hour: parse(hour),
      dayMaster: day_.stem,
    };
  };

  it('乙의 장생 午는 木의 뿌리가 없어 득령이 되지 않는다', () => {
    // 음양순역에서 乙은 午에서 장생한다. 그러나 午의 지장간은 丙己丁이라
    // 木이 하나도 없다 — 장생이라는 이름이 통근을 뜻하지 않는다.
    //
    // 乙午는 실재하지 않는 간지(乙은 음, 午는 양)라 이 장생은 일주로는
    // 나올 수 없다. 월지·년지·시지에서만 만난다.
    expect(twelveStageOf('乙', '午')).toBe('長生');
    expect(HIDDEN_STEMS['午'].some((h) => STEM_INFO[h.stem].element === '木')).toBe(false);
    expect(pillarOf('乙', '午')).toBeNull();

    const strength = strengthOf(chart('丙午', '甲午', '乙巳', '壬午'));
    const seasonal = strength.criteria.find((c) => c.key === 'seasonal');

    expect(seasonal?.met).toBe(false);
    // 여름 화기가 오히려 목을 설기하므로 아군 세력이 우세할 수 없다.
    expect(strength.ratio).toBeLessThan(0.5);
    expect(strength.verdict).toBe('weak');
  });

  it('甲의 건록 寅이 강한 것은 이름이 아니라 통근이다', () => {
    expect(twelveStageOf('甲', '寅')).toBe('建祿');
    expect(HIDDEN_STEMS['寅'].some((h) => h.stem === '甲')).toBe(true);

    const strength = strengthOf(chart('丙寅', '庚寅', '甲寅', '丙寅'));
    expect(strength.criteria.find((c) => c.key === 'branch')?.met).toBe(true);
  });

  it('판정 근거는 득령·득지·득세 셋뿐이다', () => {
    const strength = strengthOf(chart('丙午', '甲午', '乙巳', '壬午'));

    expect(strength.criteria.map((c) => c.key)).toEqual(['seasonal', 'branch', 'overall']);
    expect(strength.criteria.map((c) => c.label)).toEqual(['득령', '득지', '득세']);
  });

  it('운성 계통을 바꿔도 신강·신약은 한 자리도 움직이지 않는다', () => {
    // 양포태로 보면 乙의 午는 장생이 아니라 사(死)가 된다. 12운성이 통째로
    // 뒤집혀도 강약 판정이 그대로여야 둘이 섞이지 않았다는 뜻이다.
    expect(twelveStageOf('乙', '午')).toBe('長生');
    expect(twelveStageOf('乙', '午', { yinReverse: false })).toBe('死');

    const input = {
      year: 1988,
      month: 7,
      day: 15,
      hour: 14,
      minute: 30,
      second: 0,
      gender: 'male',
    } as const;

    const yinReversed = computeSaju(input);
    const yangOnly = computeSaju(input, { stages: { yinReverse: false } });

    expect(yangOnly.stages).not.toEqual(yinReversed.stages);
    expect(yangOnly.analysis.strength).toEqual(yinReversed.analysis.strength);
  });

  it('채택한 계산법을 결과 곁에 남긴다', () => {
    expect(STRENGTH_POLICY.twelveStageContribution).toBe('none');
    expect(STRENGTH_POLICY.ruleSet).toBe('seasonal-roots-v2');
    // v2 에서 바뀐 것은 세력의 바탕 하나다 — 국과 합화를 반영한 분포로 잰다.
    expect(STRENGTH_POLICY.basis).toBe('effective-distribution');
    // 재어 보고 켜지 않은 것들은 값으로 남는다.
    expect(STRENGTH_POLICY.emergenceBonus).toBe(0);
    expect(STRENGTH_POLICY.unaccounted).toContain('stem-emergence-bonus');
  });
});

const chartOf = (year: string, month: string, day: string, hour: string) => {
  const parse = (name: string) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
    if (!pillar) throw new Error(`간지가 아니다: ${name}`);
    return pillar;
  };
  const day_ = parse(day);
  return {
    year: parse(year),
    month: parse(month),
    day: day_,
    hour: parse(hour),
    dayMaster: day_.stem,
  };
};

describe('억부 후보 (시험값)', () => {
  const eokbu = (year: string, month: string, day: string, hour: string) => {
    const pillars = chartOf(year, month, day, hour);
    return eokbuAssessmentOf(pillars, strengthOf(pillars));
  };

  it('신약에 관성이 무거우면 인성을 쓴다 — 관인상생', () => {
    // 1992-11-17 05:20 남 · 壬申 辛亥 丁酉 壬寅.
    // 丁火 일간에 水(관성)가 가장 무겁다. 외부 만세력의 억부용신도 木이다.
    const found = eokbu('壬申', '辛亥', '丁酉', '壬寅');

    expect(found.suggestedElement).toBe('木');
    expect(found.role).toBe('印星');
    expect(found.reason).toContain('관성');
    // 확정값이 아님을 값으로 못박는다.
    expect(found.status).toBe('experimental');
    expect(found.confidence).toBe('low');
  });

  it('신약에 재성이 무거우면 비겁을 쓴다 — 인성이 극당하기 때문', () => {
    // 甲木 일간에 土(재성)가 사방에 깔린 사주.
    const found = eokbu('戊辰', '戊辰', '甲戌', '甲戌');

    expect(found.role).toBe('比劫');
    expect(found.suggestedElement).toBe('木');
    expect(found.reason).toContain('재성');
  });

  it('신강에 인성이 무거우면 재성을 쓴다 — 재극인', () => {
    // 甲木 일간에 水(인성)가 넘친다.
    const found = eokbu('壬子', '壬子', '甲子', '壬申');

    expect(found.role).toBe('財星');
    expect(found.suggestedElement).toBe('土');
  });

  it('기신은 내지 않는다 — 결과 어디에도 꺼리는 오행이 없다', () => {
    // 오행 상극표 한 줄로 정해지는 것이 아니라, 명식 전체를 봐야 하는 판정이다.
    const found = eokbu('壬申', '辛亥', '丁酉', '壬寅');

    expect(found).not.toHaveProperty('avoid');
    expect(Object.keys(found).sort()).toEqual([
      'confidence',
      'presentInChart',
      'reason',
      'role',
      'status',
      'suggestedElement',
      'unresolved',
    ]);
  });

  it('아직 판정하지 않은 것들을 함께 낸다', () => {
    const found = eokbu('壬申', '辛亥', '丁酉', '壬寅');

    expect([...found.unresolved].sort()).toEqual([
      'climate',
      'combinationEffects',
      'followingPattern',
      'rootQuality',
      'structure',
    ]);
  });

  it('후보 오행이 원국에 있는지는 사실로 낸다', () => {
    // 丁酉일주 사주에 木은 시지 寅으로 들어 있다.
    expect(eokbu('壬申', '辛亥', '丁酉', '壬寅').presentInChart).toBe(true);
  });

  it('용신은 일간에서 본 다섯 자리 중 하나다', () => {
    const found = eokbu('壬申', '辛亥', '丁酉', '壬寅');
    const roles = elementRolesOf('火');

    expect(roles[found.role]).toBe(found.suggestedElement);
  });

  it('시험값이라는 사실을 정책에 남긴다', () => {
    expect(YONGSIN_POLICY.status).toBe('experimental');
    expect(YONGSIN_POLICY.methods).toBe('eokbu-and-johu-reference');
    expect(YONGSIN_POLICY.johu).toBe('qiongtong-baojian-120-reference');
    expect(YONGSIN_POLICY.unfavorable).toBe('not-judged');
  });
});

describe('강약에 등급 이름을 붙이지 않는다', () => {
  it('결과에 등급 필드가 없다', () => {
    // 20%씩 끊은 임의 구간에 태약·중화·태왕 같은 전통 판정 이름을 붙이면
    // 없는 근거를 있는 것처럼 만든다. 세력비를 숫자 그대로 낸다.
    const strength = strengthOf(chartOf('壬申', '辛亥', '丁酉', '壬寅'));

    expect(strength).not.toHaveProperty('grade');
    expect(STRENGTH_POLICY.gradeBands).toBe('none');
  });

  it('세력비와 근거는 그대로 낸다', () => {
    const strength = strengthOf(chartOf('壬申', '辛亥', '丁酉', '壬寅'));

    expect(strength.verdict).toBe('weak');
    expect(strength.ratio).toBeGreaterThan(0);
    expect(strength.ratio).toBeLessThan(0.2);
    expect(strength.criteria.every((c) => !c.met)).toBe(true);
  });
});

describe('강약 v2 — 세력의 바탕', () => {
  /**
   * 종격이 「亥卯未가 木局이라 未를 土로 논하지 않는다」고 세는데 강약이 「未는
   * 土다」로 세면, 한 명식 안에서 같은 세력을 두 번 다르게 세게 된다.
   */
  it('득세 점수를 국·합화를 반영한 분포에서 잰다', () => {
    // 亥卯未 목국. 己土 일간에게 木은 관성이라 자당 몫이 줄어든다.
    const pillars = chartOf('壬寅', '丁未', '己卯', '乙亥');

    const literal = strengthOf(pillars, { basis: 'literal' });
    const effective = strengthOf(pillars);

    expect(effective.ratio).toBeLessThan(literal.ratio);
    expect(STRENGTH_POLICY.basis).toBe('effective-distribution');
  });

  it('바탕을 글자 그대로로 되돌리는 문이 열려 있다', () => {
    const pillars = chartOf('壬寅', '丁未', '己卯', '乙亥');
    expect(strengthOf(pillars, { basis: 'literal' }).ratio).not.toBe(
      strengthOf(pillars).ratio,
    );
  });

  /**
   * 투출 가산은 구현했지만 켜지 않았다 — 억부 외부 대조 스무 건이 갈리지 않아서다.
   * 옵션이 살아 있다는 것과 기본이 0 이라는 것을 둘 다 잠근다.
   */
  it('투출 가산은 열려 있으나 기본값이 0 이다', () => {
    const pillars = chartOf('壬寅', '丁未', '己卯', '乙亥');

    expect(STRENGTH_POLICY.emergenceBonus).toBe(0);
    expect(strengthOf(pillars, { emergenceBonus: 0.5 }).ratio).not.toBe(
      strengthOf(pillars).ratio,
    );
  });

  /**
   * 억부는 강약이 본 것과 **같은 세력**을 보아야 한다. 호출부가 분포를 넘기는
   * 것을 잊어도 어긋나지 않도록 기본값이 같은 쪽을 가리킨다.
   */
  it('억부의 기본 분포가 강약의 바탕과 같다', () => {
    const pillars = chartOf('壬寅', '丁未', '己卯', '乙亥');
    const strength = strengthOf(pillars);

    const implicit = eokbuAssessmentOf(pillars, strength);
    const explicit = eokbuAssessmentOf(
      pillars,
      strength,
      undefined,
      effectiveElementsOf(pillars).distribution,
    );

    expect(implicit.suggestedElement).toBe(explicit.suggestedElement);
  });
});
