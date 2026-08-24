import { describe, expect, it } from 'vitest';

import { LUNAR_SUPPORTED_YEAR_RANGE, solarFromLunar } from './index';
import {
  LUNAR_TABLE_PROVENANCE,
  LUNAR_YEARS_RAW,
  NEAR_MIDNIGHT_DONGJI,
  NEAR_MIDNIGHT_NEW_MOONS,
} from './lunarTable.generated';
import {
  KASI_LEAP_MONTHS,
  KASI_MONTH_FIRST_DAYS,
  KASI_NEAR_MIDNIGHT_DONGJI,
  KASI_NEAR_MIDNIGHT_NEW_MOONS,
  KASI_PRE_1912_MISMATCHES,
} from './validation/kasiCases';

const DAY_MS = 86_400_000;

function dayNumberOf(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`) / DAY_MS;
}

function secondsBetween(a: string, b: string): number {
  return Math.abs(Date.parse(`${a.replace(' ', 'T')}Z`) - Date.parse(`${b.replace(' ', 'T')}Z`)) / 1000;
}

describe('음력 표의 모양', () => {
  it('범위 안의 모든 해가 빠짐없이 한 번씩 있다', () => {
    const { min, max } = LUNAR_SUPPORTED_YEAR_RANGE;
    expect(LUNAR_YEARS_RAW).toHaveLength(max - min + 1);
    expect(LUNAR_TABLE_PROVENANCE.firstYear).toBe(1912);
    expect(LUNAR_TABLE_PROVENANCE.lastYear).toBe(2100);
  });

  it('달은 열둘 아니면 열셋이고, 열셋인 해에만 윤달이 있다', () => {
    for (const [index, year] of LUNAR_YEARS_RAW.entries()) {
      const label = `${LUNAR_SUPPORTED_YEAR_RANGE.min + index}년`;
      expect(year.monthDays.length, label).toBe(year.leapMonth === 0 ? 12 : 13);
      expect(year.leapMonth, label).toBeGreaterThanOrEqual(0);
      expect(year.leapMonth, label).toBeLessThanOrEqual(12);
    }
  });

  it('한 달은 29일 아니면 30일이다 — 삭에서 삭까지가 그만큼이다', () => {
    for (const year of LUNAR_YEARS_RAW) {
      for (const days of year.monthDays) expect([29, 30]).toContain(days);
    }
  });

  it('해와 해가 맞물린다 — 한 해의 마지막 날 다음이 그 다음 해 초하루다', () => {
    for (let i = 0; i + 1 < LUNAR_YEARS_RAW.length; i += 1) {
      const total = LUNAR_YEARS_RAW[i].monthDays.reduce((sum, days) => sum + days, 0);
      expect(dayNumberOf(LUNAR_YEARS_RAW[i].startSolar) + total).toBe(
        dayNumberOf(LUNAR_YEARS_RAW[i + 1].startSolar),
      );
      // 평년 353~355일, 윤년 383~385일. 이 밖이면 달 하나가 새거나 겹친 것이다.
      expect(total).toBeGreaterThanOrEqual(LUNAR_YEARS_RAW[i].leapMonth === 0 ? 353 : 383);
      expect(total).toBeLessThanOrEqual(LUNAR_YEARS_RAW[i].leapMonth === 0 ? 355 : 385);
    }
  });

  it('설날은 늘 양력 1월 21일에서 2월 21일 사이에 있다', () => {
    for (const year of LUNAR_YEARS_RAW) {
      const [, month, day] = year.startSolar.split('-').map(Number);
      const dayOfYear = month === 1 ? day : 31 + day;
      expect(dayOfYear, year.startSolar).toBeGreaterThanOrEqual(21);
      expect(dayOfYear, year.startSolar).toBeLessThanOrEqual(52);
    }
  });
});

/**
 * 여기부터가 이 표의 근거다.
 *
 * 위의 시험들은 표가 **스스로 앞뒤가 맞는지**만 본다. 규칙을 통째로 잘못
 * 이해했어도 전부 통과한다. 밖에서 온 자료와 맞춰 보는 것은 아래뿐이다.
 */
describe('KASI 자료 대조', () => {
  it('윤달이 든 해와 그 달이 KASI 표와 정확히 같다', () => {
    const ours: Record<number, number> = {};
    for (const [index, year] of LUNAR_YEARS_RAW.entries()) {
      if (year.leapMonth !== 0) ours[LUNAR_SUPPORTED_YEAR_RANGE.min + index] = year.leapMonth;
    }
    expect(ours).toEqual(KASI_LEAP_MONTHS);
    // 189해에 69번 — 19년 7윤(69.6)에 가깝다. 개수만 맞고 배치가 틀릴 수 있으므로
    // 위의 `toEqual` 이 본체이고 이 줄은 눈으로 보는 값이다.
    expect(Object.keys(ours)).toHaveLength(69);
  });

  it('한국과 중국이 갈린 61개 달의 초하루가 KASI 가 적은 날과 같다', () => {
    // 이 달들은 모두 삭이 한국표준시 0시~1시에 들었다. 기준 시각을 한 시간
    // 잘못 잡으면 여기서 전부 하루씩 어긋난다.
    for (const kasi of KASI_MONTH_FIRST_DAYS) {
      const solar = solarFromLunar({
        year: kasi.year,
        month: kasi.month,
        day: 1,
        leap: kasi.leap,
      });
      const iso = `${solar.year}-${String(solar.month).padStart(2, '0')}-${String(solar.day).padStart(2, '0')}`;
      expect(iso, `음력 ${kasi.year}년 ${kasi.leap ? '윤' : ''}${kasi.month}월 초하루`).toBe(kasi.solar);
    }
    expect(KASI_MONTH_FIRST_DAYS).toHaveLength(61);
  });

  it('자정에 붙은 삭이 KASI 와 같은 날로 떨어진다', () => {
    // KASI 는 DE430, 우리는 astronomy-engine 이라 시각은 초 단위로 다르다.
    // 같아야 하는 것은 **어느 날로 배정했는가**다.
    const ours = NEAR_MIDNIGHT_NEW_MOONS.filter((m) => m.newMoonKst >= '2050');
    expect(ours.map(({ lunarDate, solarDate }) => ({ lunarDate, solarDate }))).toEqual(
      KASI_NEAR_MIDNIGHT_NEW_MOONS.map(({ lunarDate, solarDate }) => ({ lunarDate, solarDate })),
    );

    for (const [index, kasi] of KASI_NEAR_MIDNIGHT_NEW_MOONS.entries()) {
      // 두 천체력의 차이가 1분을 넘으면 표 전체를 다시 봐야 한다.
      expect(secondsBetween(ours[index].newMoonKst, kasi.newMoonKst), kasi.lunarDate).toBeLessThan(60);
    }
  });

  it('자정에 붙은 동지도 KASI 와 같은 날로 떨어진다', () => {
    expect(NEAR_MIDNIGHT_DONGJI.map(({ solarDate }) => solarDate)).toEqual(
      KASI_NEAR_MIDNIGHT_DONGJI.map(({ solarDate }) => solarDate),
    );
    expect(
      secondsBetween(NEAR_MIDNIGHT_DONGJI[0].dongjiKst, KASI_NEAR_MIDNIGHT_DONGJI[0].dongjiKst),
    ).toBeLessThan(60);
  });

  it('역서와 어긋나는 여덟 건은 전부 표 밖이다 — 그래서 하한이 1912년이다', () => {
    for (const mismatch of KASI_PRE_1912_MISMATCHES) {
      const year = Number(mismatch.lunarDate.slice(0, 4));
      expect(year, mismatch.lunarDate).toBeLessThan(LUNAR_SUPPORTED_YEAR_RANGE.min);
      // 어긋난 방향도 남긴다: 역서가 하루 이르고 계산이 하루 늦다.
      expect(dayNumberOf(mismatch.calculated) - dayNumberOf(mismatch.almanac)).toBe(1);
    }
    expect(KASI_PRE_1912_MISMATCHES).toHaveLength(8);
  });
});
