import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import { pillarIndexOf } from '@/src/lib/saju/constants';
import { daysInMonth, type SajuInput } from '@/src/lib/saju/input';
import {
  dayPillarOf,
  getFourPillars,
  hourBranchOf,
  yearPillarOf,
} from '@/src/lib/saju/pillars';
import { getSolarTerms } from '@/src/lib/saju/solarTerms';
import { resolveWallClock, zoneIntervalAt } from '@/src/lib/saju/timeCorrection';

/**
 * 감사 회귀 테스트 — 2026-08-15 외부 대조 감사에서 손으로 확인했던 항목을
 * 그대로 옮겨 심은 것이다.
 *
 * 그때 통과했다는 사실은 오늘의 코드에 대해 아무것도 보장하지 않는다.
 * 여기 남겨야 다음 리팩터링이 같은 자리를 다시 밟지 않는다.
 */

const MINUTE = 60_000;

describe('절입 경계 — 12절 전부', () => {
  const terms = getSolarTerms(2025);

  it('12절 모두 절입 정각에 월지가 바뀐다', () => {
    for (const [index, term] of terms.entries()) {
      const justBefore = getFourPillars(new Date(term.date.getTime() - MINUTE));
      const exact = getFourPillars(term.date);
      const justAfter = getFourPillars(new Date(term.date.getTime() + MINUTE));

      // 정각은 새 구간에 속한다 — 경계는 닫힌 쪽이 뒤다.
      expect(exact.month.branch, `${term.name} 정각`).toBe(term.branch);
      expect(justAfter.month.branch, `${term.name} +1분`).toBe(term.branch);
      expect(justBefore.month.branch, `${term.name} -1분`).not.toBe(term.branch);

      // 직전 구간의 월지는 이전 절기의 것이어야 한다.
      const previous = index === 0 ? null : terms[index - 1];
      if (previous) {
        expect(justBefore.month.branch, `${term.name} 직전 구간`).toBe(previous.branch);
      }
    }
  });

  it('입춘만 연주까지 가른다', () => {
    const ipchun = terms[0];
    const before = getFourPillars(new Date(ipchun.date.getTime() - MINUTE));
    const after = getFourPillars(ipchun.date);

    expect(before.meta.sajuYear).toBe(2024);
    expect(after.meta.sajuYear).toBe(2025);
    expect(before.year.name).toBe('甲辰');
    expect(after.year.name).toBe('乙巳');

    // 나머지 11절은 연주를 건드리지 않는다.
    for (const term of terms.slice(1)) {
      const justBefore = getFourPillars(new Date(term.date.getTime() - MINUTE));
      const justAfter = getFourPillars(term.date);
      expect(justAfter.year.name, term.name).toBe(justBefore.year.name);
    }
  });

  it('절입 1분 차이로 일주는 흔들리지 않는다', () => {
    for (const term of terms) {
      const before = getFourPillars(new Date(term.date.getTime() - MINUTE));
      const after = getFourPillars(term.date);
      // 자시 경계(23시)를 낀 절입이 아니라면 일주는 같아야 한다.
      if (before.meta.civilTime.hour === after.meta.civilTime.hour) {
        expect(after.day.name, term.name).toBe(before.day.name);
      }
    }
  });
});

describe('시간 미상 절입일 경고 — 자정 부근', () => {
  /** 그 날 하루가 절입일이라는 경고를 받았는가 */
  const warnsTermDay = (year: number, month: number, day: number) =>
    computeSaju({ year, month, day, hour: null }).meta.warnings.some((warning) =>
      warning.includes('절입일'),
    );

  it('절입이 자정 직후여도 그 날에 경고가 붙는다', () => {
    // 1984년 입춘 = 1984-02-05 00:18 KST.
    // 경도 보정(-32분)까지 섞어 날짜를 읽으면 2월 4일 23:46 으로 보여
    // 경고가 하루 앞 날짜에 붙는다. 달력 날짜는 표준시로 읽어야 한다.
    expect(warnsTermDay(1984, 2, 5), '1984-02-05 (입춘 당일)').toBe(true);
    expect(warnsTermDay(1984, 2, 4), '1984-02-04 (입춘 전날)').toBe(false);
    expect(warnsTermDay(1984, 2, 6), '1984-02-06 (입춘 다음날)').toBe(false);
  });

  it('1900~2100 전 구간에서 경고 날짜가 절입의 한국 표준시 날짜와 같다', () => {
    // 자정 부근 절입은 드물지 않다. 한 해라도 어긋나면 여기서 드러난다.
    for (let sajuYear = 1900; sajuYear <= 2100; sajuYear += 1) {
      for (const term of getSolarTerms(sajuYear)) {
        // 그 시절 한국이 실제로 쓰던 표준시로 읽는다. 1908년 이전은 UTC+8:27,
        // 1954~61년은 UTC+8:30 이라 +9 로 고정하면 날짜가 어긋난다.
        const offsetMinutes = zoneIntervalAt(term.date).standardOffsetMinutes;
        const local = new Date(term.date.getTime() + offsetMinutes * 60_000);
        const [year, month, day] = [
          local.getUTCFullYear(),
          local.getUTCMonth() + 1,
          local.getUTCDate(),
        ];
        if (year > 2100) continue; // 2101년 소한은 지원 범위 밖이다

        const label = `${sajuYear} ${term.name} → ${year}-${month}-${day}`;
        expect(warnsTermDay(year, month, day), label).toBe(true);
      }
    }
  });
});

describe('윤년 규칙 — 1900년과 2000년', () => {
  it('1900년 2월은 28일까지다 (100의 배수, 400의 배수가 아님)', () => {
    expect(daysInMonth(1900, 2)).toBe(28);

    const feb28 = dayPillarOf({ year: 1900, month: 2, day: 28 });
    const mar01 = dayPillarOf({ year: 1900, month: 3, day: 1 });
    // 2월 29일이 없으므로 두 날은 붙어 있다.
    expect(mar01.index).toBe((feb28.index + 1) % 60);
  });

  it('2000년 2월은 29일까지다 (400의 배수)', () => {
    expect(daysInMonth(2000, 2)).toBe(29);

    const feb28 = dayPillarOf({ year: 2000, month: 2, day: 28 });
    const feb29 = dayPillarOf({ year: 2000, month: 2, day: 29 });
    const mar01 = dayPillarOf({ year: 2000, month: 3, day: 1 });
    expect(feb29.index).toBe((feb28.index + 1) % 60);
    expect(mar01.index).toBe((feb29.index + 1) % 60);
  });

  it('널리 인용되는 일진과 맞는다', () => {
    expect(dayPillarOf({ year: 1900, month: 1, day: 1 }).name).toBe('甲戌');
    expect(dayPillarOf({ year: 2000, month: 1, day: 1 }).name).toBe('戊午');
    expect(dayPillarOf({ year: 2024, month: 1, day: 1 }).name).toBe('甲子');
    expect(dayPillarOf({ year: 2024, month: 2, day: 29 }).name).toBe('癸亥');
    expect(dayPillarOf({ year: 2025, month: 6, day: 15 }).name).toBe('乙卯');
  });
});

describe('표준자오선 전환 — 분 단위 시각', () => {
  it('1954-03-21 00:00 KST 에 UTC+9 → UTC+8:30', () => {
    // 전환 직전 1초까지는 아직 UTC+9
    expect(zoneIntervalAt(new Date('1954-03-20T14:59:59Z')).standardOffsetMinutes).toBe(540);
    expect(zoneIntervalAt(new Date('1954-03-20T15:00:00Z')).standardOffsetMinutes).toBe(510);
  });

  it('1961-08-10 00:30 KST 에 UTC+8:30 → UTC+9', () => {
    expect(zoneIntervalAt(new Date('1961-08-09T15:29:59Z')).standardOffsetMinutes).toBe(510);
    expect(zoneIntervalAt(new Date('1961-08-09T15:30:00Z')).standardOffsetMinutes).toBe(540);
  });

  it('전환 전후로 경도 보정량이 30분 뛴다', () => {
    const longitudeOf = (input: SajuInput) =>
      computeSaju(input, { useLongitude: true }).meta.corrections.find(
        (c) => c.kind === 'longitude',
      )!.minutes;

    const before = longitudeOf({ year: 1954, month: 3, day: 20, hour: 12, minute: 0, second: 0 });
    const after = longitudeOf({ year: 1954, month: 3, day: 22, hour: 12, minute: 0, second: 0 });

    expect(before).toBeCloseTo(-32.09, 1); // 표준자오선 135°
    expect(after).toBeCloseTo(-2.09, 1); // 표준자오선 127.5°
    expect(after - before).toBeCloseTo(30, 1);
  });
});

describe('서머타임 전환 — 1958년과 1988년', () => {
  it('1958 서머타임은 UTC+8:30 위에 얹혀 +9:30이 된다', () => {
    const before = zoneIntervalAt(new Date('1958-05-03T15:29:59Z'));
    const during = zoneIntervalAt(new Date('1958-05-03T15:30:00Z'));
    const after = zoneIntervalAt(new Date('1958-09-20T14:30:00Z'));

    expect(before.dstOffsetMinutes).toBe(0);
    expect(during.dstOffsetMinutes).toBe(60);
    expect(during.totalOffsetMinutes).toBe(570); // UTC+9:30
    expect(after.dstOffsetMinutes).toBe(0);
    expect(after.totalOffsetMinutes).toBe(510);
  });

  it('1958 전환일의 벽시계에 구멍과 겹침이 생긴다', () => {
    // 시작: 1958-05-04 00:00~01:00 KST 가 통째로 없다
    expect(resolveWallClock({ year: 1958, month: 5, day: 4, hour: 0, minute: 30, second: 0 })
      .nonexistent).toBe(true);
    // 해제: 1958-09-20 23:00~24:00 KST 가 두 번 지나간다
    expect(resolveWallClock({ year: 1958, month: 9, day: 20, hour: 23, minute: 30, second: 0 })
      .ambiguous).toBe(true);
  });

  it('1988 서머타임은 UTC+9 위에서 +10이 된다', () => {
    expect(zoneIntervalAt(new Date('1988-05-07T16:59:59Z')).dstOffsetMinutes).toBe(0);
    expect(zoneIntervalAt(new Date('1988-05-07T17:00:00Z')).dstOffsetMinutes).toBe(60);
    expect(zoneIntervalAt(new Date('1988-05-07T17:00:00Z')).totalOffsetMinutes).toBe(600);
    expect(zoneIntervalAt(new Date('1988-10-08T17:00:00Z')).dstOffsetMinutes).toBe(0);
  });

  it('1988 전환일의 벽시계에 구멍과 겹침이 생긴다', () => {
    // 시작: 1988-05-08 02:00~03:00 KST 가 없다
    expect(resolveWallClock({ year: 1988, month: 5, day: 8, hour: 2, minute: 30, second: 0 })
      .nonexistent).toBe(true);
    // 해제: 1988-10-09 02:00~03:00 KST 가 두 번 지나간다
    expect(resolveWallClock({ year: 1988, month: 10, day: 9, hour: 2, minute: 30, second: 0 })
      .ambiguous).toBe(true);
  });

  it('서머타임 기간 출생은 보정을 켜면 시계가 한 시간 당겨진다', () => {
    const input: SajuInput = { year: 1988, month: 7, day: 15, hour: 14, minute: 0, second: 0 };
    const on = computeSaju(input, { useDst: true, useLongitude: false });
    const off = computeSaju(input, { useDst: false, useLongitude: false });

    expect(on.pillars.meta.civilTime.hour).toBe(13);
    expect(off.pillars.meta.civilTime.hour).toBe(14);
    expect(on.pillars.day.name).toBe('辛未');
    expect(on.pillars.day.name).toBe(off.pillars.day.name);
  });
});

/**
 * 고정 시드 난수 — 시드를 박아두어야 실패를 재현할 수 있다.
 * (mulberry32: 32비트 상태 하나로 도는 작은 PRNG)
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('속성 테스트 — 무작위 1,000건', () => {
  const SEED = 20260815;
  const CASES = 1_000;

  const random = mulberry32(SEED);
  const pick = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

  const inputs: SajuInput[] = Array.from({ length: CASES }, () => {
    const year = pick(1900, 2100);
    const month = pick(1, 12);
    return {
      year,
      month,
      day: pick(1, daysInMonth(year, month)!),
      hour: pick(0, 23),
      minute: pick(0, 59),
      second: 0,
    };
  });

  it('언제나 성립하는 간지 네 개와 일관된 메타를 낸다', () => {
    for (const input of inputs) {
      const label = `${input.year}-${input.month}-${input.day} ${input.hour}:${input.minute}`;
      const saju = computeSaju(input);
      const { pillars } = saju;

      for (const key of ['year', 'month', 'day', 'hour'] as const) {
        const pillar = pillars[key]!;
        expect(pillar, `${label} ${key}`).not.toBeNull();
        expect(pillarIndexOf(pillar.stem, pillar.branch), `${label} ${key}`).toBe(pillar.index);
      }

      // 일간은 일주의 천간이다
      expect(pillars.dayMaster, label).toBe(pillars.day.stem);

      // 연주는 사주년이, 월지는 절기 구간이, 시지는 달력 시각이 정한다
      expect(pillars.year.name, label).toBe(yearPillarOf(pillars.meta.sajuYear).name);
      expect(pillars.month.branch, label).toBe(pillars.meta.monthTerm.branch);
      expect(pillars.hour!.branch, label).toBe(hourBranchOf(pillars.meta.civilTime.hour));

      // 절입 시각과 다음 절입 사이에 놓여 있다
      expect(pillars.meta.monthTerm.date.getTime(), label).toBeLessThanOrEqual(
        saju.meta.instant.getTime(),
      );
      expect(pillars.meta.nextTerm.date.getTime(), label).toBeGreaterThan(
        saju.meta.instant.getTime(),
      );

      // 사주년은 달력연도이거나 그 직전 해다 (입춘 이전 출생)
      expect([input.year - 1, input.year], label).toContain(pillars.meta.sajuYear);
    }
  });

  it('오행 분포와 십성 개수의 합이 언제나 여덟·일곱이다', () => {
    for (const input of inputs) {
      const { elements, tenGodCounts } = computeSaju(input).analysis;
      const label = `${input.year}-${input.month}-${input.day}`;

      expect(elements.glyphCount, label).toBe(8);
      expect(Object.values(elements.counts).reduce((a, b) => a + b, 0), label).toBe(8);
      expect(Object.values(elements.ratios).reduce((a, b) => a + b, 0), label).toBeCloseTo(1, 10);
      expect(Object.values(tenGodCounts).reduce((a, b) => a + b, 0), label).toBe(7);
    }
  });

  it('같은 입력은 언제나 같은 결과를 낸다', () => {
    for (const input of inputs) {
      const first = computeSaju(input);
      const second = computeSaju(input);
      expect(JSON.stringify(second), JSON.stringify(input)).toBe(JSON.stringify(first));
    }
  });

  it('시간 미상 계산도 연·월·일주는 정오 계산과 같다', () => {
    for (const input of inputs) {
      const label = `${input.year}-${input.month}-${input.day}`;
      const { year, month, day } = input;

      const unknown = computeSaju({ year, month, day, hour: null });
      const noon = computeSaju({ year, month, day, hour: 12, minute: 0, second: 0 });

      expect(unknown.pillars.hour, label).toBeNull();
      expect(unknown.pillars.year.name, label).toBe(noon.pillars.year.name);
      expect(unknown.pillars.month.name, label).toBe(noon.pillars.month.name);
      expect(unknown.pillars.day.name, label).toBe(noon.pillars.day.name);
    }
  });
});

describe('일주 연속성 — 표준시가 바뀌어도 끊기지 않는다', () => {
  /** 실제로 존재하는 다음 날짜. `Date` 정규화에 기대지 않는다. */
  const nextDay = (date: { year: number; month: number; day: number }) => {
    if (date.day < daysInMonth(date.year, date.month)!) {
      return { ...date, day: date.day + 1 };
    }
    if (date.month < 12) return { year: date.year, month: date.month + 1, day: 1 };
    return { year: date.year + 1, month: 1, day: 1 };
  };

  it('전환 구간을 가로질러 하루에 한 칸씩만 전진한다', () => {
    // 1954-03-21(자오선 135°→127.5°), 1961-08-10(복귀), 1988-05-08(서머타임 시작)
    for (const start of [
      { year: 1954, month: 3, day: 18 },
      { year: 1961, month: 8, day: 7 },
      { year: 1988, month: 5, day: 5 },
    ]) {
      let date = start;
      let previous: number | null = null;

      for (let offset = 0; offset < 6; offset += 1) {
        // 표준시 이력·경도 보정을 전부 켜고 정오로 계산한다.
        const saju = computeSaju({ ...date, hour: 12, minute: 0, second: 0 });

        if (previous !== null) {
          const label = `${date.year}-${date.month}-${date.day}`;
          expect(saju.pillars.day.index, label).toBe((previous + 1) % 60);
        }
        previous = saju.pillars.day.index;
        date = nextDay(date);
      }
    }
  });
});
