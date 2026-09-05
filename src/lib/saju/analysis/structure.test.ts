import { describe, expect, it } from 'vitest';

import { effectiveElementsOf } from '@/src/lib/saju/analysis/effectiveElements';
import { favorabilityOf } from '@/src/lib/saju/analysis/favorability';
import { strengthOf } from '@/src/lib/saju/analysis/strength';
import {
  STRUCTURE_FACTOR_NAMES,
  STRUCTURE_POLICY,
  structureOf,
} from '@/src/lib/saju/analysis/structure';
import { computeSaju } from '@/src/lib/saju';
import { randomInputs } from '@/src/lib/saju/population';
import { eokbuAssessmentOf } from '@/src/lib/saju/analysis/yongsin';
import { GENERATED_BY, CONTROLLED_BY, pillarOf, type Branch, type Stem } from '@/src/lib/saju/constants';

const chart = (year: string, month: string, day: string, hour: string) => {
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
    hour: parse(hour),
    dayMaster: parsedDay.stem,
  };
};

const structure = (year: string, month: string, day: string, hour: string) => {
  const pillars = chart(year, month, day, hour);
  return structureOf(pillars, effectiveElementsOf(pillars).distribution);
};

/**
 * 조건 이름의 정적 목록이 판정과 어긋나지 않는가.
 *
 * `STRUCTURE_FACTOR_NAMES` 는 문장 그물이 읽는 목록인데(`MYEONGRI_LEXICON`),
 * 실제 이름은 `structureOf` 의 `switch` 안에 흩어져 있다. 두 곳이 갈리면 그물이
 * 조용히 새거나 있지도 않은 이름을 지킨다 — 국 이름은 `bureau.ts` 가 조합해서
 * 낼 수 있었지만 이쪽은 손으로 적은 목록이라 시험이 유일한 자물쇠다.
 */
describe('성패 조건 이름', () => {
  it('정적 목록과 판정이 내는 이름이 같은 집합이다', () => {
    const produced = new Set<string>();

    for (const input of randomInputs(1500)) {
      const { structure } = computeSaju(input).analysis;
      for (const factor of [...structure.formingFactors, ...structure.breakingFactors]) {
        produced.add(factor.name);
      }
    }

    // 목록에 없는 이름이 나오면 그물이 그것을 못 잡는다.
    expect([...produced].filter((name) => !STRUCTURE_FACTOR_NAMES.includes(name))).toEqual([]);
    // 반대쪽 — 판정이 안 내는 이름이 목록에 있으면 죽은 값이다.
    expect(STRUCTURE_FACTOR_NAMES.filter((name) => !produced.has(name))).toEqual([]);
  });

  it('이름마다 왜 그렇게 보았는지가 함께 나온다', () => {
    for (const input of randomInputs(200)) {
      const { structure } = computeSaju(input).analysis;
      for (const factor of [...structure.formingFactors, ...structure.breakingFactors]) {
        expect(factor.detail.length, factor.name).toBeGreaterThan(5);
      }
    }
  });
});

describe('격국 — 격을 잡는 법', () => {
  /**
   * 월지 지장간 중 **투출한 것**으로 잡는다. 辰戌丑未의 잡기격이 이 규칙에서
   * 그대로 나온다 — 따로 갈래를 만들지 않았다.
   */
  it('월지 지장간 중 투출한 것으로 잡는다', () => {
    // 辰월. 정기 戊는 안 나오고 여기 乙이 년간에 나와 있다.
    const found = structure('乙亥', '庚辰', '庚申', '丙戌');

    expect(found.source.stem).toBe('乙');
    expect(found.source.role).toBe('餘氣');
    expect(found.revealed).toBe(true);
    expect(found.kind).toBe('正財格');
  });

  it('아무것도 투출하지 않으면 정기로 잡는다', () => {
    // 辰월인데 乙·癸·戊 어느 것도 천간에 없다.
    const found = structure('丙寅', '壬辰', '庚申', '丁丑');

    expect(found.revealed).toBe(false);
    expect(found.source.role).toBe('正氣');
    expect(found.candidates.every((candidate) => !candidate.revealed)).toBe(true);
  });

  /**
   * **월령이 일간 편이면 투출보다 먼저 갈린다.** 순서를 뒤집으면 건록격 명식이
   * 투출한 글자를 따라 정관격·재격으로 잡혀 버린다.
   */
  it('건록·양인은 투출보다 먼저 갈린다', () => {
    // 甲의 녹은 寅이다. 寅중 丙(식신)이 투출해 있어도 건록격이다.
    const lu = structure('丙寅', '庚寅', '甲子', '丙寅');
    expect(lu.kind).toBe('建祿格');

    // 甲의 인은 卯다.
    const blade = structure('丙寅', '辛卯', '甲子', '丙寅');
    expect(blade.kind).toBe('陽刃格');
  });

  /**
   * 戊土의 巳월은 월지 정기가 丙(편인)이지만 戊의 녹이다. 십성으로만 읽으면
   * 이 자리가 편인격이 되어 버린다 — 火土同法을 값으로 적어 둔 까닭이다.
   */
  it('火土同法으로 戊의 巳월을 건록으로 본다', () => {
    const found = structure('丁亥', '乙巳', '戊子', '壬戌');

    expect(found.kind).toBe('建祿格');
    expect(STRUCTURE_POLICY.fireEarthSameCourse).toBe(true);
  });
});

describe('격국 — 성패', () => {
  /**
   * **참·거짓 하나로 접지 않는다.** 이루는 조건과 깨는 조건이 함께 나오는 것이
   * 흔하고(구응救應이 그 이야기다), 그것을 boolean 으로 접으면 판정이 아니라
   * 반올림이 된다.
   */
  it('이루는 조건과 깨는 조건이 섞이면 미정이다', () => {
    const found = structure('乙亥', '庚辰', '庚申', '丙戌');

    if (found.formingFactors.length > 0 && found.breakingFactors.length > 0) {
      expect(found.outcome).toBe('unresolved');
    }
    expect(STRUCTURE_POLICY.outcome).toBe('conditions-listed');
  });

  it('상관격에 정관이 드러나면 파격 쪽 근거가 선다', () => {
    // 癸 일간의 寅월은 상관격이다. 천간에 戊(정관)가 나오면 상관견관이다.
    const found = structure('戊午', '甲寅', '癸卯', '甲寅');

    expect(found.kind).toBe('傷官格');
    expect(found.breakingFactors.map((factor) => factor.name)).toContain('상관견관');
  });

  it('월령이 충을 맞으면 어느 격이든 깨는 근거가 하나 선다', () => {
    const found = structure('甲申', '丙寅', '庚午', '戊寅');

    expect(found.monthClashed).toBe(true);
    expect(found.breakingFactors.map((factor) => factor.name)).toContain('월령충파');
  });

  /**
   * 격국은 억부도 조후도 뒤집지 않는다. 종격과 같은 자리인데 근거는 더 얕다 —
   * 종격은 서른 건 중 열일곱을 잡고 이쪽은 일흔둘 중 쉰여섯이 맞는다. 자세한 행렬은
   * `structure.external.test.ts`.
   */
  it('외부 대조가 0건이라는 것을 값으로 든다', () => {
    expect(STRUCTURE_POLICY.status).toBe('experimental');
    expect(STRUCTURE_POLICY.yongsinOverride).toBe('disabled');
    expect(STRUCTURE_POLICY.externalCheck.cases).toBe(74);
    expect(STRUCTURE_POLICY.externalCheck.passed).toBe(false);
  });
});

describe('희용기구한', () => {
  const favor = (year: string, month: string, day: string, hour: string) => {
    const pillars = chart(year, month, day, hour);
    const elements = effectiveElementsOf(pillars).distribution;
    const eokbu = eokbuAssessmentOf(pillars, strengthOf(pillars), undefined, elements);
    return { eokbu, found: favorabilityOf(eokbu, elements) };
  };

  /**
   * 표 조회라 규칙이랄 것이 없다 — 용신을 생하는 것이 희신, 극하는 것이 기신,
   * 기신을 생하는 것이 구신, 남는 하나가 한신이다.
   */
  it('다섯 자리가 상생상극 표에서 곧장 나온다', () => {
    const { eokbu, found } = favor('乙亥', '庚辰', '庚申', '丙戌');

    expect(found.byRole.yongsin).toBe(eokbu.suggestedElement);
    expect(found.byRole.helper).toBe(GENERATED_BY[found.byRole.yongsin]);
    expect(found.byRole.adversary).toBe(CONTROLLED_BY[found.byRole.yongsin]);
    expect(found.byRole.accomplice).toBe(GENERATED_BY[found.byRole.adversary]);

    // 오행이 다섯이라 남는 것은 언제나 정확히 하나다.
    expect(new Set(Object.values(found.byRole)).size).toBe(5);
  });

  /**
   * **근거를 물려받은 결론이 근거보다 세게 말할 수는 없다.** 용신이 시험값이라
   * 이 배정도 시험값이고, 억부가 아직 못 본 것들을 그대로 들고 나온다.
   */
  it('용신보다 세게 말하지 않는다', () => {
    const { eokbu, found } = favor('乙亥', '庚辰', '庚申', '丙戌');

    expect(found.status).toBe('experimental');
    expect(found.confidence).toBe(eokbu.confidence);
    expect(found.unresolved).toEqual(eokbu.unresolved);
  });

  it('자리마다 그 오행이 원국에 몇 자 있는지 함께 낸다', () => {
    const { found } = favor('乙亥', '庚辰', '庚申', '丙戌');

    for (const seat of found.seats) {
      expect(seat.count).toBeGreaterThanOrEqual(0);
      expect(seat.ratio).toBeGreaterThanOrEqual(0);
      expect(seat.detail.length).toBeGreaterThan(0);
    }
  });
});
