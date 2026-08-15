import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import { pillarOf, type Branch, type Stem } from '@/src/lib/saju/constants';
import {
  DEFAULT_SAEUN_COUNT,
  InvalidSaeunRangeError,
  computeSaeun,
  saeunChartId,
} from '@/src/lib/saju/saeun';
import { yearPillarOf } from '@/src/lib/saju/pillars/year';

/**
 * 세운 테스트.
 *
 * 세운이 틀리는 방식은 셋이다 — 해의 경계를 양력 1월 1일로 잡거나, 간지가
 * 연주와 어긋나거나, 원국과의 관계에서 어느 쪽 년주인지 뒤섞이거나.
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
const BIRTH_YEAR = 1992;

const saeun = (options = {}) =>
  computeSaeun({ pillars: NATAL, birthSajuYear: BIRTH_YEAR }, options);

describe('간지는 연주 도출과 같은 함수에서 나온다', () => {
  it('세운 간지가 그 해의 연주와 언제나 같다', () => {
    for (const entry of saeun({ fromYear: 2020, count: 12 }).entries) {
      expect(entry.pillar).toEqual(yearPillarOf(entry.year));
    }
  });

  it('알려진 해의 간지', () => {
    const byYear = Object.fromEntries(
      saeun({ fromYear: 2024, count: 4 }).entries.map((e) => [e.year, e.pillar.name]),
    );

    expect(byYear).toEqual({
      2024: '甲辰',
      2025: '乙巳',
      2026: '丙午',
      2027: '丁未',
    });
  });

  it('육십 년마다 같은 간지로 돌아온다', () => {
    const [first] = saeun({ fromYear: 1984, count: 1 }).entries;
    const [later] = saeun({ fromYear: 2044, count: 1 }).entries;

    expect(later.pillar.name).toBe(first.pillar.name);
  });
});

describe('해의 경계는 입춘이다', () => {
  it('시작 절기가 입춘이고 2월 초에 있다', () => {
    for (const entry of saeun({ fromYear: 2024, count: 3 }).entries) {
      expect(entry.startTerm.name).toBe('입춘');
      expect(entry.startTerm.date.getUTCMonth()).toBe(1); // 2월
    }
  });

  it('입춘 전에 태어나면 사주년이 전 해라 세운도 전 해부터 시작한다', () => {
    // 2025-02-03 23:10 은 입춘 직전이라 사주년이 2024다.
    const before = computeSaju({
      year: 2025, month: 2, day: 3, hour: 23, minute: 10, second: 0, gender: 'male',
    });
    const after = computeSaju({
      year: 2025, month: 2, day: 3, hour: 23, minute: 11, second: 0, gender: 'male',
    });

    expect(before.saeun.entries[0].year).toBe(2024);
    expect(before.saeun.entries[0].pillar.name).toBe('甲辰');
    expect(after.saeun.entries[0].year).toBe(2025);
    expect(after.saeun.entries[0].pillar.name).toBe('乙巳');
  });
});

describe('원국에서 본 세운', () => {
  it('십성·12운성·12신살이 일간과 원국 기준으로 나온다', () => {
    // 2027 丁未. 일간 丁 → 천간 丁은 비견, 지지 未의 정기 己는 식신.
    const [entry] = saeun({ fromYear: 2027, count: 1 }).entries;

    expect(entry.pillar.name).toBe('丁未');
    expect(entry.tenGods.stem).toBe('比肩');
    expect(entry.tenGods.branch).toBe('食神');
    // 丁은 酉 장생 역행 — 未는 관대다.
    expect(entry.stage).toBe('冠帶');
    // 년지 申(申子辰 수국) 기준으로 未는 천살.
    expect(entry.spirits.year).toBe('天殺');
  });

  it('나이는 만 나이로 센다', () => {
    const entries = saeun({ fromYear: BIRTH_YEAR, count: 3 }).entries;
    expect(entries.map((e) => e.age)).toEqual([0, 1, 2]);
  });

  it('출생 전 해는 나이가 음수다', () => {
    expect(saeun({ fromYear: 1990, count: 1 }).entries[0].age).toBe(-2);
  });
});

describe('세운과 원국의 관계', () => {
  it('세운이 낀 관계만 낸다 — 원국 안에서 닫힌 관계는 빼고', () => {
    for (const entry of saeun({ fromYear: 2020, count: 8 }).entries) {
      for (const relation of entry.relations) {
        expect(relation.scope).not.toBe('withinChart');
        expect(relation.participants.some((p) => p.chartId === entry.chartId)).toBe(true);
      }
    }
  });

  it('원국 년주와 세운 년주가 chartId 로 구별된다', () => {
    // 2026 丙午. 원국 시지 寅과 寅午 반합, 원국 년지 申과 자오충이 아니라…
    // 어느 쪽 년주인지가 chartId 로 갈린다.
    const [entry] = saeun({ fromYear: 2026, count: 1 }).entries;
    const positions = entry.relations.flatMap((r) => r.participants);

    expect(positions.some((p) => p.chartId === 'natal' && p.position === 'year')).toBe(true);
    expect(positions.some((p) => p.chartId === 'annual:2026' && p.position === 'year')).toBe(
      true,
    );
    // 자리 이름만 보면 둘 다 'year' 라 구별되지 않는다.
    expect(new Set(positions.filter((p) => p.position === 'year').map((p) => p.chartId)).size)
      .toBeGreaterThan(1);
  });

  it('계산판이 섞인 관계에는 거리가 없다', () => {
    for (const entry of saeun({ fromYear: 2020, count: 8 }).entries) {
      for (const relation of entry.relations) {
        expect(relation.distance).toBeNull();
        expect(relation.adjacent).toBeNull();
      }
    }
  });

  it('세운 지지가 원국 지지와 충하면 잡힌다', () => {
    // 원국 시지 寅. 2028 戊申 의 申이 寅申충이다.
    const [entry] = saeun({ fromYear: 2028, count: 1 }).entries;
    const clash = entry.relations.find((r) => r.ko === '인신충');

    expect(entry.pillar.name).toBe('戊申');
    expect(clash).toBeDefined();
    expect(clash?.scope).toBe('betweenCharts');
  });

  it('세 글자가 합쳐 이룬 구조는 따로 표시된다', () => {
    // 원국에 亥·寅이 있고 세운이 卯면 亥卯未가 아니라 亥卯 반합이 두 판에 걸린다.
    const found = saeun({ fromYear: 2020, count: 12 }).entries.flatMap((e) =>
      e.relations.filter((r) => r.scope === 'combinedFormation'),
    );

    for (const relation of found) {
      expect(relation.participants.length).toBe(3);
      expect(new Set(relation.participants.map((p) => p.chartId)).size).toBeGreaterThan(1);
    }
  });
});

describe('범위와 계약', () => {
  it('기본은 출생년부터 열 해다', () => {
    const { entries } = saeun();

    expect(entries).toHaveLength(DEFAULT_SAEUN_COUNT);
    expect(entries[0].year).toBe(BIRTH_YEAR);
  });

  it('chartId 규칙이 고정돼 있다', () => {
    expect(saeunChartId(2027)).toBe('annual:2027');
    expect(saeun({ fromYear: 2027, count: 1 }).entries[0].chartId).toBe('annual:2027');
  });

  it.each([0, -1, 1.5, NaN])('개수 %s 는 거부한다', (count) => {
    expect(() => saeun({ count })).toThrow(InvalidSaeunRangeError);
  });

  it('시작 연도가 정수가 아니면 거부한다', () => {
    expect(() => saeun({ fromYear: 2020.5 })).toThrow(InvalidSaeunRangeError);
  });

  it('computeSaju 가 세운을 함께 낸다', () => {
    const saju = computeSaju({
      year: 1992, month: 11, day: 17, hour: 5, minute: 20, second: 0, gender: 'male',
    });

    expect(saju.saeun.entries[0].year).toBe(saju.pillars.meta.sajuYear);
    expect(saju.saeun.entries).toHaveLength(DEFAULT_SAEUN_COUNT);
  });

  it('옵션이 엔진 입구까지 이어진다', () => {
    const saju = computeSaju(
      { year: 1992, month: 11, day: 17, hour: 5, minute: 20, second: 0, gender: 'male' },
      { saeun: { fromYear: 2030, count: 3 } },
    );

    expect(saju.saeun.entries.map((e) => e.year)).toEqual([2030, 2031, 2032]);
  });
});
