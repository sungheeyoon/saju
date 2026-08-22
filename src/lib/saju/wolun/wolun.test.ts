import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import { BRANCHES_BY_MONTH_ORDER, pillarOf, type Branch, type Stem } from '@/src/lib/saju/constants';
import { monthPillarOf } from '@/src/lib/saju/pillars/month';
import { yearPillarOf } from '@/src/lib/saju/pillars/year';
import { InvalidWolunRangeError, computeWolun, wolunChartId } from '@/src/lib/saju/wolun';

/**
 * 월운 테스트.
 *
 * 월운이 틀리는 방식은 셋이다 — 경계를 달력 월로 잡거나, 월간을 오호둔이
 * 아닌 다른 것으로 세거나, 원국 월주와 월운 월주가 뒤섞이거나.
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

/** 1992-11-17 05:20 남 — 壬申 辛亥 丁酉 壬寅 */
const NATAL = chart('壬申', '辛亥', '丁酉', '壬寅');

/** 같은 사람의 대운 표 — 월운 칸이 자기를 감싼 대운과 견준다 */
const DAEUN = computeSaju({
  year: 1992, month: 11, day: 17, hour: 5, minute: 20, second: 0, gender: 'male',
}).daeun;
const BIRTH_DATE = { year: 1992, month: 11, day: 17 };

const wolun = (year: number) =>
  computeWolun({ pillars: NATAL, year, daeun: DAEUN, birthDate: BIRTH_DATE });

describe('열두 달이 절입으로 갈린다', () => {
  it('입춘부터 소한까지 열둘이다', () => {
    const { entries } = wolun(2026);

    expect(entries).toHaveLength(12);
    expect(entries[0].startTerm.name).toBe('입춘');
    expect(entries[11].startTerm.name).toBe('소한');
  });

  it('월지가 인월부터 축월까지 순서대로다', () => {
    expect(wolun(2026).entries.map((e) => e.pillar.branch)).toEqual([
      ...BRANCHES_BY_MONTH_ORDER,
    ]);
    expect(wolun(2026).entries.map((e) => e.monthOrder)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it('한 달의 끝은 다음 절이고, 마지막 달의 끝은 다음 해 입춘이다', () => {
    const { entries } = wolun(2026);

    for (const [index, entry] of entries.entries()) {
      expect(entry.nextTerm.date.getTime()).toBeGreaterThan(entry.startTerm.date.getTime());
      if (index < 11) {
        expect(entry.nextTerm).toEqual(entries[index + 1].startTerm);
      }
    }

    expect(entries[11].nextTerm.name).toBe('입춘');
    expect(entries[11].nextTerm.date.getUTCFullYear()).toBe(2027);
  });

  it('달력 월이 아니다 — 인월이 2월 초에 시작해 3월 초에 끝난다', () => {
    const [tiger] = wolun(2026).entries;

    expect(tiger.startTerm.date.getUTCMonth()).toBe(1); // 2월
    expect(tiger.nextTerm.name).toBe('경칩');
    expect(tiger.nextTerm.date.getUTCMonth()).toBe(2); // 3월
  });

  it('자월·축월은 달력으로 다음 해에 있다', () => {
    const { entries } = wolun(2026);
    const rat = entries.find((e) => e.pillar.branch === '子')!;
    const ox = entries.find((e) => e.pillar.branch === '丑')!;

    // 대설(자월)은 그 해 12월, 소한(축월)은 다음 해 1월이다.
    expect(rat.startTerm.date.getUTCFullYear()).toBe(2026);
    expect(ox.startTerm.date.getUTCFullYear()).toBe(2027);
    // 그래도 둘 다 사주년 2026 에 속한다.
    expect(ox.year).toBe(2026);
  });
});

describe('월간은 오호둔에서 나온다', () => {
  it('2026 丙午년의 열두 달', () => {
    // 丙辛년 → 庚寅월. 거기서부터 천간이 한 칸씩 나아간다.
    expect(wolun(2026).entries.map((e) => e.pillar.name)).toEqual([
      '庚寅', '辛卯', '壬辰', '癸巳', '甲午', '乙未',
      '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑',
    ]);
  });

  it.each([2024, 2025, 2026, 2027, 2028])('%s년 월주가 월주 도출과 같다', (year) => {
    const yearStem = yearPillarOf(year).stem;

    for (const entry of wolun(year).entries) {
      expect(entry.pillar).toEqual(monthPillarOf(yearStem, entry.pillar.branch));
    }
  });
});

describe('원국·세운에서 본 월운', () => {
  it('십성·12운성·12신살이 일간과 원국 기준으로 나온다', () => {
    // 2026 병신월(丙申). 일간 丁 → 丙은 겁재, 申의 정기 庚은 정재.
    const monkey = wolun(2026).entries.find((e) => e.pillar.name === '丙申')!;

    expect(monkey.tenGods.stem).toBe('劫財');
    expect(monkey.tenGods.branch).toBe('正財');
    // 丁은 酉에서 장생해 역행한다 — 酉장생 申목욕 未관대 午건록…
    expect(monkey.stage).toBe('沐浴');
    // 원국 년지 申(申子辰 수국) 기준으로 申은 지살.
    expect(monkey.spirits.year).toBe('地殺');
  });

  it('월운이 낀 관계만 낸다', () => {
    for (const entry of wolun(2026).entries) {
      for (const relation of entry.relations) {
        expect(relation.participants.some((p) => p.chartId === entry.chartId)).toBe(true);
      }
    }
  });

  it('원국과 세운 사이의 관계는 월운 칸에 넣지 않는다', () => {
    // 그것은 세운의 몫이다. scope 만 보고 거르면 딸려 온다.
    for (const entry of wolun(2026).entries) {
      for (const relation of entry.relations) {
        const charts = relation.participants.map((p) => p.chartId);
        expect(charts).toContain(entry.chartId);
      }
    }
  });

  it('원국 월주와 월운 월주가 chartId 로 구별된다', () => {
    // 원국 월지 亥, 2026 기해월(己亥)도 월지 亥 — 자리 이름만으로는 같다.
    const pig = wolun(2026).entries.find((e) => e.pillar.branch === '亥')!;
    const months = pig.relations
      .flatMap((r) => r.participants)
      .filter((p) => p.position === 'month');

    expect(new Set(months.map((p) => p.chartId)).size).toBeGreaterThan(1);
    expect(months.some((p) => p.chartId === 'natal')).toBe(true);
    expect(months.some((p) => p.chartId === pig.chartId)).toBe(true);
  });

  it('세운과도 관계를 맺는다', () => {
    // 2026 丙午년 · 임진월(壬辰)이면 세운 지지 午와는 관계가 없지만,
    // 세운이 계산에 들어와 있다는 것은 어느 달이든 chartId 로 확인된다.
    const withAnnual = wolun(2026).entries.flatMap((e) =>
      e.relations.filter((r) => r.participants.some((p) => p.chartId === 'annual:2026')),
    );

    expect(withAnnual.length).toBeGreaterThan(0);
  });

  it('계산판이 섞인 관계에는 거리가 없다', () => {
    for (const entry of wolun(2026).entries) {
      for (const relation of entry.relations) {
        expect(relation.distance).toBeNull();
        expect(relation.adjacent).toBeNull();
      }
    }
  });
});

describe('범위와 계약', () => {
  it('chartId 규칙이 고정돼 있다', () => {
    expect(wolunChartId(2026, 1)).toBe('monthly:2026-01');
    expect(wolunChartId(2026, 12)).toBe('monthly:2026-12');
    expect(wolun(2026).entries[0].chartId).toBe('monthly:2026-01');
  });

  it('사주년이 정수가 아니면 거부한다', () => {
    expect(() => wolun(2026.5)).toThrow(InvalidWolunRangeError);
  });

  it('computeSaju 가 세운 첫 해의 월운을 함께 낸다', () => {
    const saju = computeSaju({
      year: 1992, month: 11, day: 17, hour: 5, minute: 20, second: 0, gender: 'male',
    });

    expect(saju.wolun.year).toBe(saju.saeun.entries[0].year);
    expect(saju.wolun.entries).toHaveLength(12);
  });

  it('옵션으로 해를 옮긴다', () => {
    const saju = computeSaju(
      { year: 1992, month: 11, day: 17, hour: 5, minute: 20, second: 0, gender: 'male' },
      { wolun: { year: 2030 } },
    );

    expect(saju.wolun.year).toBe(2030);
    expect(saju.wolun.entries[0].chartId).toBe('monthly:2030-01');
  });
});
