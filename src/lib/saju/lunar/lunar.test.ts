import { describe, expect, it } from 'vitest';

import {
  CALENDARS,
  LUNAR_SUPPORTED_YEAR_RANGE,
  LunarConversionError,
  lunarFromSolar,
  solarFromLunar,
  type LunarDate,
} from './index';
import { LUNAR_YEARS_RAW } from './lunarTable.generated';

function iso({ year, month, day }: { year: number; month: number; day: number }): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function refusalOf(run: () => unknown): LunarConversionError {
  try {
    run();
  } catch (error) {
    if (error instanceof LunarConversionError) return error;
    throw error;
  }
  throw new Error('거부하지 않았습니다');
}

describe('음력 → 양력', () => {
  it('평달과 윤달은 서로 다른 날이다', () => {
    // 1984년은 윤10월이 있는 해다. 같은 「10월 5일」이 두 번 온다.
    const plain = solarFromLunar({ year: 1984, month: 10, day: 5, leap: false });
    const leap = solarFromLunar({ year: 1984, month: 10, day: 5, leap: true });

    // 두 삭: 1984-10-24 21:08 KST 와 1984-11-23 07:57 KST 가 각각 여는 달이다.
    expect(iso(plain)).toBe('1984-10-28');
    expect(iso(leap)).toBe('1984-11-27');
    // 한 삭망월만큼 떨어져 있다.
    expect(Date.UTC(leap.year, leap.month - 1, leap.day) - Date.UTC(plain.year, plain.month - 1, plain.day)).toBe(
      30 * 86_400_000,
    );
  });

  it('윤달을 플래그로 흘리면 한 달을 잃는다 — 그래서 요구한다', () => {
    // `leap` 없이 「음력 1984-10-05」만 넘길 수 있게 두면 이 두 날 중 하나가
    // 조용히 사라진다. 타입이 `leap: boolean` 을 요구하는 이유다.
    const dates: LunarDate[] = [
      { year: 1984, month: 10, day: 5, leap: false },
      { year: 1984, month: 10, day: 5, leap: true },
    ];
    expect(new Set(dates.map((date) => iso(solarFromLunar(date)))).size).toBe(2);
  });

  it('표의 첫날과 마지막 날을 낸다', () => {
    expect(iso(solarFromLunar({ year: 1912, month: 1, day: 1, leap: false }))).toBe(
      LUNAR_YEARS_RAW[0].startSolar,
    );

    const last = LUNAR_YEARS_RAW[LUNAR_YEARS_RAW.length - 1];
    const lastDay = last.monthDays[last.monthDays.length - 1];
    expect(iso(solarFromLunar({ year: 2100, month: 12, day: lastDay, leap: false }))).toBe('2101-01-28');
  });
});

describe('양력 → 음력', () => {
  it('표가 덮는 모든 날이 되돌아온다', () => {
    // 6만 9천 날을 하나씩 왕복시킨다. 한 달이라도 길이가 어긋나 있으면 그 뒤가
    // 통째로 밀리므로, 표본이 아니라 전수로 본다.
    let checked = 0;
    for (const [index, record] of LUNAR_YEARS_RAW.entries()) {
      const year = LUNAR_SUPPORTED_YEAR_RANGE.min + index;
      let number = 1;
      record.monthDays.forEach((days, position) => {
        const leap = record.leapMonth !== 0 && position === record.leapMonth;
        const month = leap ? record.leapMonth : number;
        for (let day = 1; day <= days; day += 1) {
          const lunar = { year, month, day, leap };
          expect(lunarFromSolar(solarFromLunar(lunar))).toEqual(lunar);
          checked += 1;
        }
        if (!leap) number += 1;
      });
    }
    expect(checked).toBeGreaterThan(68_000);
  });

  it('알려진 날을 읽는다', () => {
    // 2024년 설날은 양력 2월 10일이었다.
    expect(lunarFromSolar({ year: 2024, month: 2, day: 10 })).toEqual({
      year: 2024,
      month: 1,
      day: 1,
      leap: false,
    });
  });
});

describe('거부', () => {
  it('표 밖의 해는 이유를 밝히고 거부한다', () => {
    for (const year of [1911, 2101]) {
      const refusal = refusalOf(() => solarFromLunar({ year, month: 1, day: 1, leap: false }));
      expect(refusal.reason).toBe('out-of-range');
      expect(refusal.message).toContain('1912~2100');
    }
  });

  it('양력 1912년 1월은 음력으로 1911년이라 읽지 않는다', () => {
    // 엔진의 지원 범위(1900~)와 음력 표의 범위(1912~)가 다르다는 것이 여기서 보인다.
    expect(refusalOf(() => lunarFromSolar({ year: 1912, month: 1, day: 1 })).reason).toBe('out-of-range');
    expect(refusalOf(() => lunarFromSolar({ year: 2101, month: 3, day: 1 })).reason).toBe('out-of-range');
  });

  it('없는 윤달은 있는 윤달을 알려주며 거부한다', () => {
    // 2024년에는 윤달이 없다.
    const none = refusalOf(() => solarFromLunar({ year: 2024, month: 4, day: 1, leap: true }));
    expect(none.reason).toBe('no-such-leap-month');
    expect(none.message).toContain('윤달이 없습니다');

    // 2023년의 윤달은 윤2월 하나뿐이다.
    const other = refusalOf(() => solarFromLunar({ year: 2023, month: 4, day: 1, leap: true }));
    expect(other.reason).toBe('no-such-leap-month');
    expect(other.message).toContain('윤2월');
  });

  it('29일까지인 달의 30일은 거부한다 — 조용히 다음 달로 넘기지 않는다', () => {
    const year = LUNAR_YEARS_RAW.findIndex((record) => record.monthDays[0] === 29);
    expect(year).toBeGreaterThanOrEqual(0);

    const refusal = refusalOf(() =>
      solarFromLunar({ year: LUNAR_SUPPORTED_YEAR_RANGE.min + year, month: 1, day: 30, leap: false }),
    );
    expect(refusal.reason).toBe('no-such-day');
    expect(refusal.message).toContain('29일까지입니다');
  });

  it('음력에는 13월도 0일도 없다', () => {
    expect(refusalOf(() => solarFromLunar({ year: 2024, month: 13, day: 1, leap: false })).reason).toBe(
      'no-such-day',
    );
    expect(refusalOf(() => solarFromLunar({ year: 2024, month: 1, day: 0, leap: false })).reason).toBe(
      'no-such-day',
    );
  });
});

describe('달력 형식', () => {
  it('양력·음력 평달·음력 윤달 셋뿐이다 — DB 의 검사식과 같은 낱말', () => {
    expect(CALENDARS).toEqual(['solar', 'lunar', 'lunar_leap']);
  });
});
