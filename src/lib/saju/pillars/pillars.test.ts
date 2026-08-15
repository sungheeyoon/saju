import { describe, expect, it } from 'vitest';
import { BRANCHES, STEMS, pillarIndexOf, type Stem } from '@/src/lib/saju/constants';
import {
  DAY_ANCHOR,
  KST_OFFSET_MINUTES,
  YEAR_ANCHOR,
  dayPillarOf,
  formatPillars,
  fromCivil,
  getFourPillars,
  hourBranchOf,
  hourStemOf,
  monthStemOf,
  ratHourStem,
  tigerMonthStem,
  toCivil,
  yearPillarOf,
  type FourPillars,
} from '@/src/lib/saju/pillars';

/** 한국 표준시 벽시계 시각을 절대 시각으로 만든다. */
function kst(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) - KST_OFFSET_MINUTES * 60_000,
  );
}

function names(pillars: FourPillars) {
  return {
    year: pillars.year.name,
    month: pillars.month.name,
    day: pillars.day.name,
    hour: pillars.hour.name,
  };
}

describe('달력 시각 변환(civilTime)', () => {
  it('toCivil 과 fromCivil 이 서로의 역함수다', () => {
    const civil = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0 };
    expect(toCivil(fromCivil(civil))).toEqual(civil);
  });

  it('fromCivil 이 한국 표준시 벽시계를 절대 시각으로 옮긴다', () => {
    const instant = fromCivil({
      year: 2025, month: 6, day: 15, hour: 12, minute: 0, second: 0,
    });
    expect(instant.toISOString()).toBe('2025-06-15T03:00:00.000Z');
    expect(instant.getTime()).toBe(kst(2025, 6, 15, 12).getTime());
  });

  it('자정 직전·직후가 다른 날로 갈린다', () => {
    expect(toCivil(fromCivil({
      year: 2025, month: 6, day: 15, hour: 23, minute: 59, second: 0,
    })).day).toBe(15);
    expect(toCivil(fromCivil({
      year: 2025, month: 6, day: 16, hour: 0, minute: 1, second: 0,
    })).day).toBe(16);
  });
});

describe('연주(year)', () => {
  it('기준점 1984년이 갑자년이다', () => {
    expect(YEAR_ANCHOR).toEqual({ sajuYear: 1984, pillarIndex: 0 });
    expect(yearPillarOf(1984).name).toBe('甲子');
  });

  it('알려진 연도의 간지와 일치한다', () => {
    expect(yearPillarOf(2024).name).toBe('甲辰'); // 갑진년
    expect(yearPillarOf(2025).name).toBe('乙巳'); // 을사년
    expect(yearPillarOf(1988).name).toBe('戊辰'); // 무진년
    expect(yearPillarOf(1960).name).toBe('庚子'); // 경자년
  });

  it('60년마다 같은 간지로 돌아온다', () => {
    for (const year of [1900, 1984, 2025]) {
      expect(yearPillarOf(year).name).toBe(yearPillarOf(year + 60).name);
      expect(yearPillarOf(year).name).toBe(yearPillarOf(year - 60).name);
    }
  });
});

describe('월주(month) — 오호둔', () => {
  // 코드에서는 공식으로 구하지만, 규칙 자체는 이 표가 원본이다.
  const TIGER_MONTH_STEM: Record<Stem, Stem> = {
    甲: '丙', 己: '丙',
    乙: '戊', 庚: '戊',
    丙: '庚', 辛: '庚',
    丁: '壬', 壬: '壬',
    戊: '甲', 癸: '甲',
  };

  it('연간마다 인월 천간이 오호둔과 일치한다', () => {
    for (const stem of STEMS) {
      expect(tigerMonthStem(stem), `${stem}년의 인월`).toBe(TIGER_MONTH_STEM[stem]);
    }
  });

  it('인월부터 월지 순서만큼 천간이 전진한다', () => {
    // 乙년 → 戊寅월, 이후 己卯 庚辰 辛巳 壬午 …
    expect(monthStemOf('乙', '寅')).toBe('戊');
    expect(monthStemOf('乙', '卯')).toBe('己');
    expect(monthStemOf('乙', '辰')).toBe('庚');
    expect(monthStemOf('乙', '午')).toBe('壬');
    expect(monthStemOf('乙', '丑')).toBe('己'); // 12번째 월
  });

  it('모든 연간 × 월지 조합이 성립하는 간지를 만든다', () => {
    for (const yearStem of STEMS) {
      for (const branch of BRANCHES) {
        const stem = monthStemOf(yearStem, branch);
        expect(pillarIndexOf(stem, branch), `${yearStem}년 ${branch}월`).not.toBeNull();
      }
    }
  });
});

describe('시주(hour) — 시지와 오서둔', () => {
  it('자시가 23시에 시작해 두 시간씩 나뉜다', () => {
    expect(hourBranchOf(23)).toBe('子');
    expect(hourBranchOf(0)).toBe('子');
    expect(hourBranchOf(1)).toBe('丑');
    expect(hourBranchOf(2)).toBe('丑');
    expect(hourBranchOf(3)).toBe('寅');
    expect(hourBranchOf(11)).toBe('午');
    expect(hourBranchOf(12)).toBe('午');
    expect(hourBranchOf(22)).toBe('亥');
  });

  it('24시간이 12지지를 두 시간씩 정확히 덮는다', () => {
    const counts = new Map<string, number>();
    for (let h = 0; h < 24; h += 1) {
      const b = hourBranchOf(h);
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    expect(counts.size).toBe(12);
    expect([...counts.values()].every((c) => c === 2)).toBe(true);
  });

  const RAT_HOUR_STEM: Record<Stem, Stem> = {
    甲: '甲', 己: '甲',
    乙: '丙', 庚: '丙',
    丙: '戊', 辛: '戊',
    丁: '庚', 壬: '庚',
    戊: '壬', 癸: '壬',
  };

  it('일간마다 자시 천간이 오서둔과 일치한다', () => {
    for (const stem of STEMS) {
      expect(ratHourStem(stem), `${stem}일의 자시`).toBe(RAT_HOUR_STEM[stem]);
    }
  });

  it('모든 일간 × 시지 조합이 성립하는 간지를 만든다', () => {
    for (const dayStem of STEMS) {
      for (const branch of BRANCHES) {
        const stem = hourStemOf(dayStem, branch);
        expect(pillarIndexOf(stem, branch), `${dayStem}일 ${branch}시`).not.toBeNull();
      }
    }
  });
});

describe('일주(day)', () => {
  it('기준점 2000-01-01 이 무오일이다', () => {
    expect(DAY_ANCHOR.pillarIndex).toBe(54);
    expect(dayPillarOf(DAY_ANCHOR.civil).name).toBe('戊午');
  });

  it('널리 인용되는 다른 날짜와도 맞는다', () => {
    expect(dayPillarOf({ year: 1900, month: 1, day: 1 }).name).toBe('甲戌');
    expect(dayPillarOf({ year: 2024, month: 1, day: 1 }).name).toBe('甲子');
  });

  it('하루에 한 칸씩 전진하고 60일마다 돌아온다', () => {
    const start = { year: 2025, month: 3, day: 1 };
    const first = dayPillarOf(start);

    for (let offset = 1; offset <= 60; offset += 1) {
      const at = dayPillarOf({ ...start, day: 1 + offset });
      const expected = (first.index + offset) % 60;
      expect(at.index, `+${offset}일`).toBe(expected);
    }
    expect(dayPillarOf({ ...start, day: 61 }).name).toBe(first.name);
  });

  it('윤년 2월 29일을 건너뛰지 않는다', () => {
    const feb28 = dayPillarOf({ year: 2024, month: 2, day: 28 });
    const feb29 = dayPillarOf({ year: 2024, month: 2, day: 29 });
    const mar01 = dayPillarOf({ year: 2024, month: 3, day: 1 });
    expect(feb29.index).toBe((feb28.index + 1) % 60);
    expect(mar01.index).toBe((feb29.index + 1) % 60);
  });
});

describe('4주 통합 — 절기 경계', () => {
  it('입춘 전후로 연주가 갈린다', () => {
    // 2025년 입춘 = 2025-02-03 23:10:29 KST
    const before = getFourPillars(kst(2025, 2, 3, 12));
    const after = getFourPillars(kst(2025, 2, 4, 12));

    expect(before.meta.sajuYear).toBe(2024);
    expect(before.year.name).toBe('甲辰');
    expect(before.month.branch).toBe('丑');

    expect(after.meta.sajuYear).toBe(2025);
    expect(after.year.name).toBe('乙巳');
    expect(after.month.branch).toBe('寅');
  });

  it('입춘을 분 단위로 가른다', () => {
    const justBefore = getFourPillars(kst(2025, 2, 3, 23, 5));
    const justAfter = getFourPillars(kst(2025, 2, 3, 23, 15));

    expect(justBefore.year.name).toBe('甲辰');
    expect(justAfter.year.name).toBe('乙巳');
    expect(justBefore.day.name).toBe(justAfter.day.name); // 일주는 같은 날
  });

  it('1월 초는 아직 지난 사주년의 자월·축월이다', () => {
    // 2025년 소한 = 2025-01-05 17:23 KST
    const beforeSohan = getFourPillars(kst(2025, 1, 3, 12));
    const afterSohan = getFourPillars(kst(2025, 1, 10, 12));

    expect(beforeSohan.meta.sajuYear).toBe(2024);
    expect(beforeSohan.month.branch).toBe('子');
    expect(afterSohan.meta.sajuYear).toBe(2024);
    expect(afterSohan.month.branch).toBe('丑');
  });

  it('절기 경계 근처에 경고를 남긴다', () => {
    const near = getFourPillars(kst(2025, 2, 3, 23, 15));
    expect(near.meta.warnings.some((w) => w.includes('입춘'))).toBe(true);

    const far = getFourPillars(kst(2025, 6, 15, 12));
    expect(far.meta.warnings).toEqual([]);
  });
});

describe('4주 통합 — 조자시/야자시', () => {
  const lateNight = { year: 2025, month: 6, day: 15, hour: 23, minute: 30 } as const;

  it('조자시는 23시부터 일주를 다음 날로 넘긴다', () => {
    const jo = getFourPillars(
      kst(lateNight.year, lateNight.month, lateNight.day, lateNight.hour, lateNight.minute),
      { lateNightRule: 'jo' },
    );
    expect(jo.meta.lateNightShiftApplied).toBe(true);
    expect(jo.day.name).toBe(dayPillarOf({ year: 2025, month: 6, day: 16 }).name);
    expect(jo.hour.branch).toBe('子');
  });

  it('야자시는 일주를 자정에 넘긴다', () => {
    const ya = getFourPillars(
      kst(lateNight.year, lateNight.month, lateNight.day, lateNight.hour, lateNight.minute),
      { lateNightRule: 'ya' },
    );
    expect(ya.meta.lateNightShiftApplied).toBe(false);
    expect(ya.day.name).toBe(dayPillarOf({ year: 2025, month: 6, day: 15 }).name);
    expect(ya.hour.branch).toBe('子');
  });

  it('두 규칙이 23시대에만 갈린다', () => {
    const at = (h: number, m: number) =>
      (['jo', 'ya'] as const).map((rule) =>
        formatPillars(getFourPillars(kst(2025, 6, 15, h, m), { lateNightRule: rule })),
      );

    const [jo23, ya23] = at(23, 30);
    expect(jo23).not.toBe(ya23);

    for (const [hour, minute] of [[0, 30], [12, 0], [22, 59]] as const) {
      const [jo, ya] = at(hour, minute);
      expect(jo, `${hour}:${minute}`).toBe(ya);
    }
  });

  it('23시대 출생에 경고를 남긴다', () => {
    const pillars = getFourPillars(kst(2025, 6, 15, 23, 30));
    expect(pillars.meta.warnings.some((w) => w.includes('자시'))).toBe(true);
  });
});

describe('4주 통합 — 산출 예시', () => {
  it('2025-06-15 12:00 KST', () => {
    const pillars = getFourPillars(kst(2025, 6, 15, 12));

    expect(names(pillars)).toEqual({
      year: '乙巳',
      month: '壬午',
      day: '乙卯',
      hour: '壬午',
    });
    expect(pillars.dayMaster).toBe('乙');
    expect(pillars.meta.monthTerm.name).toBe('망종');
    expect(pillars.meta.nextTerm.name).toBe('소서');
    // 표기는 시주 일주 월주 년주 순서
    expect(formatPillars(pillars)).toBe('壬午 乙卯 壬午 乙巳');
  });

  it('meta 가 적용된 규칙을 그대로 담는다', () => {
    const pillars = getFourPillars(kst(2025, 6, 15, 12), { lateNightRule: 'ya' });
    expect(pillars.meta.lateNightRule).toBe('ya');
    expect(pillars.meta.civilTime).toEqual({
      year: 2025, month: 6, day: 15, hour: 12, minute: 0, second: 0,
    });
    expect(pillars.meta.sajuYear).toBe(2025);
  });
});

describe('4주 통합 — 구조 불변식', () => {
  it('넓은 구간에서 항상 성립하는 간지 4개를 만든다', () => {
    for (let offset = 0; offset < 800; offset += 1) {
      const instant = kst(2023, 1, 1, 12);
      instant.setUTCDate(instant.getUTCDate() + offset);

      const pillars = getFourPillars(instant);
      for (const key of ['year', 'month', 'day', 'hour'] as const) {
        const pillar = pillars[key];
        expect(
          pillarIndexOf(pillar.stem, pillar.branch),
          `${instant.toISOString()} ${key}=${pillar.name}`,
        ).toBe(pillar.index);
      }
      expect(pillars.dayMaster).toBe(pillars.day.stem);
    }
  });

  it('하루 24시간이 12개 시지를 두 번씩 돈다', () => {
    const branches = Array.from({ length: 24 }, (_, h) =>
      getFourPillars(kst(2025, 6, 15, h), { lateNightRule: 'ya' }).hour.branch,
    );
    expect(new Set(branches).size).toBe(12);
  });
});
