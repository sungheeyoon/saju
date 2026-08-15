import { describe, expect, it } from 'vitest';
import { computeSaju } from '@/src/lib/saju';
import { formatPillars } from '@/src/lib/saju/pillars';
import {
  CITY_LONGITUDES,
  KOREA_ZONE_HISTORY,
  correctTime,
  InvalidLocalTimeError,
  equationOfTimeMinutes,
  longitudeCorrectionMinutes,
  resolveWallClock,
  standardMeridian,
  zoneIntervalAt,
} from '@/src/lib/saju/timeCorrection';

const at = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
) => ({ year, month, day, hour, minute, second: 0 });

describe('표준시 이력(zoneHistory)', () => {
  it('구간이 시간순이고 빈틈 없이 이어진다', () => {
    expect(KOREA_ZONE_HISTORY[0].start).toBeNull();
    expect(KOREA_ZONE_HISTORY[KOREA_ZONE_HISTORY.length - 1].end).toBeNull();

    for (let i = 0; i < KOREA_ZONE_HISTORY.length - 1; i += 1) {
      const current = KOREA_ZONE_HISTORY[i];
      const next = KOREA_ZONE_HISTORY[i + 1];
      expect(current.end).toEqual(next.start);
      expect(next.start!.getTime()).toBeGreaterThan(current.start?.getTime() ?? -Infinity);
    }
  });

  it('총 오프셋은 표준시와 서머타임의 합이다', () => {
    for (const interval of KOREA_ZONE_HISTORY) {
      expect(interval.totalOffsetMinutes).toBe(
        interval.standardOffsetMinutes + interval.dstOffsetMinutes,
      );
      expect([0, 60]).toContain(interval.dstOffsetMinutes);
    }
  });

  it('서머타임은 12회이고 모두 여름을 낀 6개월 이내다', () => {
    const dst = KOREA_ZONE_HISTORY.filter((i) => i.dstOffsetMinutes > 0);
    expect(dst).toHaveLength(12);

    for (const interval of dst) {
      const start = interval.start!;
      const end = interval.end!;
      const months = (end.getTime() - start.getTime()) / (30 * 86_400_000);
      expect(months).toBeGreaterThan(2);
      expect(months).toBeLessThan(6);

      // 월 판정은 현지 시각으로 해야 한다. 예를 들어 1950년 서머타임 시작은
      // 1950-03-31T15:00Z 인데 이는 KST 로 4월 1일이다.
      const localMonth = (d: Date) => new Date(d.getTime() + 9 * 3_600_000).getUTCMonth() + 1;
      expect(localMonth(start), `${start.toISOString()} 시작`).toBeGreaterThanOrEqual(4);
      expect(localMonth(end), `${end.toISOString()} 종료`).toBeLessThanOrEqual(10);
    }
  });

  it('표준자오선이 바뀐 시점을 담고 있다', () => {
    // 1954-03-21 ~ 1961-08-10 은 UTC+8:30
    expect(zoneIntervalAt(new Date('1955-01-01T00:00:00Z')).standardOffsetMinutes).toBe(510);
    expect(zoneIntervalAt(new Date('1960-01-01T00:00:00Z')).standardOffsetMinutes).toBe(510);
    // 그 바깥은 UTC+9
    expect(zoneIntervalAt(new Date('1953-01-01T00:00:00Z')).standardOffsetMinutes).toBe(540);
    expect(zoneIntervalAt(new Date('1962-01-01T00:00:00Z')).standardOffsetMinutes).toBe(540);
    expect(zoneIntervalAt(new Date('2025-01-01T00:00:00Z')).standardOffsetMinutes).toBe(540);
  });

  it('1955~60년 서머타임은 UTC+8:30 위에 얹혀 +9:30이 된다', () => {
    // 손으로 표를 짜면 가장 틀리기 쉬운 구간
    const summer = zoneIntervalAt(new Date('1957-07-15T00:00:00Z'));
    expect(summer.standardOffsetMinutes).toBe(510);
    expect(summer.dstOffsetMinutes).toBe(60);
    expect(summer.totalOffsetMinutes).toBe(570); // UTC+9:30
  });

  it('1987~88년 서머타임은 UTC+9 위에서 +10이 된다', () => {
    const summer = zoneIntervalAt(new Date('1988-07-15T00:00:00Z'));
    expect(summer.standardOffsetMinutes).toBe(540);
    expect(summer.dstOffsetMinutes).toBe(60);
    expect(summer.totalOffsetMinutes).toBe(600);
  });
});

describe('벽시계 해석(resolveWallClock)', () => {
  it('평시에는 표준시로 그대로 되돌린다', () => {
    const { instant, ambiguous, nonexistent } = resolveWallClock(at(2025, 6, 15, 12));
    expect(instant.toISOString()).toBe('2025-06-15T03:00:00.000Z');
    expect(ambiguous).toBe(false);
    expect(nonexistent).toBe(false);
  });

  it('서머타임 기간의 벽시계는 앞당겨진 시계로 읽는다', () => {
    // 1988-07-15 14:00 은 UTC+10 시계였으므로 04:00Z
    expect(resolveWallClock(at(1988, 7, 15, 14)).instant.toISOString()).toBe(
      '1988-07-15T04:00:00.000Z',
    );
  });

  it('서머타임 해제일의 겹친 시각을 모호로 표시한다', () => {
    // 1987-10-11 03:00 에 시계가 02:00 으로 되돌아갔다 → 02:00~03:00 이 두 번
    const result = resolveWallClock(at(1987, 10, 11, 2, 30));
    expect(result.ambiguous).toBe(true);
    expect(result.nonexistent).toBe(false);
    // 앞선 쪽(서머타임 +10)으로 해석하므로 03:00 이 아니라 16:30Z 이다
    expect(result.interval.dstOffsetMinutes).toBe(60);
    expect(result.instant.toISOString()).toBe('1987-10-10T16:30:00.000Z');
  });

  it('겹친 구간 바깥은 모호하지 않다', () => {
    expect(resolveWallClock(at(1987, 10, 11, 1, 30)).ambiguous).toBe(false);
    expect(resolveWallClock(at(1987, 10, 11, 3, 30)).ambiguous).toBe(false);
  });

  it('서머타임 시작일의 건너뛴 시각을 부재로 표시한다', () => {
    // 1987-05-10 02:00 에 시계가 03:00 으로 뛰었다 → 02:00~03:00 이 없음
    const result = resolveWallClock(at(1987, 5, 10, 2, 30));
    expect(result.nonexistent).toBe(true);
    expect(result.ambiguous).toBe(false);
  });
});

describe('경도 보정(longitude)', () => {
  it('표준시 오프셋에서 표준자오선을 끌어낸다', () => {
    expect(standardMeridian(540)).toBe(135);
    expect(standardMeridian(510)).toBe(127.5);
  });

  it('서울은 동경 135° 기준에서 약 -32분이다', () => {
    const minutes = longitudeCorrectionMinutes(CITY_LONGITUDES.서울, 540);
    expect(minutes).toBeCloseTo(-32.09, 1);
  });

  it('UTC+8:30 시기에는 보정이 거의 사라진다', () => {
    // 표준자오선이 127.5° 라 서울(126.98°)과 거의 같았다
    const minutes = longitudeCorrectionMinutes(CITY_LONGITUDES.서울, 510);
    expect(minutes).toBeCloseTo(-2.09, 1);
  });

  it('표준자오선보다 동쪽이면 양수다', () => {
    expect(longitudeCorrectionMinutes(CITY_LONGITUDES.부산, 540)).toBeGreaterThan(
      longitudeCorrectionMinutes(CITY_LONGITUDES.서울, 540),
    );
  });
});

describe('균시차(equationOfTime)', () => {
  it('연중 -14 ~ +16분 범위를 오간다', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let day = 0; day < 365; day += 5) {
      const value = equationOfTimeMinutes(new Date(Date.UTC(2025, 0, 1) + day * 86_400_000));
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    expect(min).toBeGreaterThan(-15);
    expect(min).toBeLessThan(-13);
    expect(max).toBeGreaterThan(15);
    expect(max).toBeLessThan(17);
  });

  it('2월 중순에 가장 작고 11월 초에 가장 크다', () => {
    expect(equationOfTimeMinutes(new Date('2025-02-11T00:00:00Z'))).toBeCloseTo(-14.2, 0);
    expect(equationOfTimeMinutes(new Date('2025-11-03T00:00:00Z'))).toBeCloseTo(16.4, 0);
  });
});

describe('보정 체인(correctTime)', () => {
  it('서머타임을 되돌리면 달력 시각이 한 시간 빠진다', () => {
    const on = correctTime(at(1988, 7, 15, 14), { useDst: true, useLongitude: false });
    expect(on.zoneOffsetMinutes).toBe(540);
    expect(on.corrections.find((c) => c.kind === 'dst')?.minutes).toBe(-60);

    const off = correctTime(at(1988, 7, 15, 14), { useDst: false, useLongitude: false });
    expect(off.zoneOffsetMinutes).toBe(600);
    expect(off.corrections.find((c) => c.kind === 'dst')?.minutes).toBe(0);

    // 절대 시각 자체는 둘 다 같다 — 벽시계가 가리킨 순간은 하나뿐이다
    expect(on.instant).toEqual(off.instant);
  });

  it('서머타임이 아닌 날에는 dst 항목이 없다', () => {
    const result = correctTime(at(2025, 6, 15, 12));
    expect(result.corrections.some((c) => c.kind === 'dst')).toBe(false);
  });

  it('표준자오선 시기에 따라 경도 보정량이 달라진다', () => {
    const modern = correctTime(at(2025, 6, 15, 12), { longitude: CITY_LONGITUDES.서울 });
    const legacy = correctTime(at(1957, 1, 15, 12), { longitude: CITY_LONGITUDES.서울 });

    expect(modern.solarTimeOffsetMinutes).toBeCloseTo(-32.09, 1);
    expect(legacy.solarTimeOffsetMinutes).toBeCloseTo(-2.09, 1);
  });

  it('균시차를 켜면 보정이 합산된다', () => {
    const withoutEot = correctTime(at(2025, 11, 3, 12), { useEquationOfTime: false });
    const withEot = correctTime(at(2025, 11, 3, 12), { useEquationOfTime: true });

    const eot = withEot.solarTimeOffsetMinutes - withoutEot.solarTimeOffsetMinutes;
    expect(eot).toBeCloseTo(16.4, 0);
    expect(withEot.corrections.some((c) => c.kind === 'equationOfTime')).toBe(true);
  });

  it("dstTransitionPolicy 'throw' 는 부재·모호 시각을 거부한다", () => {
    const gap = at(1987, 5, 10, 2, 30);
    const overlap = at(1987, 10, 11, 2, 30);

    expect(() => correctTime(gap, { dstTransitionPolicy: 'throw' })).toThrowError(
      InvalidLocalTimeError,
    );
    expect(() => correctTime(overlap, { dstTransitionPolicy: 'throw' })).toThrowError(
      InvalidLocalTimeError,
    );

    try {
      correctTime(gap, { dstTransitionPolicy: 'throw' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidLocalTimeError);
      expect((error as InvalidLocalTimeError).kind).toBe('nonexistent');
      expect((error as InvalidLocalTimeError).message).toContain('1987-05-10 02:30');
    }

    try {
      correctTime(overlap, { dstTransitionPolicy: 'throw' });
      expect.unreachable();
    } catch (error) {
      expect((error as InvalidLocalTimeError).kind).toBe('ambiguous');
    }
  });

  it("dstTransitionPolicy 'throw' 도 정상 시각은 그대로 통과시킨다", () => {
    expect(() =>
      correctTime(at(2025, 6, 15, 12), { dstTransitionPolicy: 'throw' }),
    ).not.toThrow();
    // 서머타임 기간이어도 전환 순간이 아니면 문제없다
    expect(() =>
      correctTime(at(1987, 7, 15, 12), { dstTransitionPolicy: 'throw' }),
    ).not.toThrow();
  });

  it("기본값 'resolve' 는 해석하고 경고만 남긴다", () => {
    const result = correctTime(at(1987, 5, 10, 2, 30));
    expect(result.warnings.some((w) => w.includes('존재하지 않'))).toBe(true);
    expect(result.instant).toBeInstanceOf(Date);
  });

  it('보정 내역에 표준자오선이 항상 기록된다', () => {
    const result = correctTime(at(2025, 6, 15, 12));
    const meridian = result.corrections.find((c) => c.kind === 'standardMeridian');
    expect(meridian).toBeDefined();
    expect(meridian!.detail).toContain('135');
  });
});

describe('통합(computeSaju) — 보정이 절기를 흔들지 않는다', () => {
  // 2025년 입춘 = 2025-02-03 23:10:29 KST
  const justAfterIpchun = at(2025, 2, 3, 23, 15);

  it('경도 보정을 켜도 연주가 유지된다', () => {
    // 경도 보정 -32분을 절대 시각에 잘못 적용하면 23:15 → 22:43 이 되어
    // 입춘 이전으로 밀리고 연주가 甲辰으로 뒤집힌다. 그러면 안 된다.
    const off = computeSaju(justAfterIpchun, { useLongitude: false });
    const on = computeSaju(justAfterIpchun, { useLongitude: true });

    expect(off.pillars.year.name).toBe('乙巳');
    expect(on.pillars.year.name).toBe('乙巳');
    expect(on.pillars.month.branch).toBe('寅');
    expect(on.pillars.meta.sajuYear).toBe(2025);
  });

  it('그러면서 시주는 경도 보정에 따라 바뀐다', () => {
    const off = computeSaju(justAfterIpchun, { useLongitude: false });
    const on = computeSaju(justAfterIpchun, { useLongitude: true });

    // 23:15 → 子시, 보정 후 22:43 → 亥시
    expect(off.pillars.hour.branch).toBe('子');
    expect(on.pillars.hour.branch).toBe('亥');
  });

  it('보정 총합과 내역을 meta 에 남긴다', () => {
    const saju = computeSaju(at(1988, 7, 15, 14), {
      useLongitude: true,
      useEquationOfTime: true,
    });

    const kinds = saju.meta.corrections.map((c) => c.kind);
    expect(kinds).toContain('standardMeridian');
    expect(kinds).toContain('dst');
    expect(kinds).toContain('longitude');
    expect(kinds).toContain('equationOfTime');

    // 서머타임 -60, 경도 약 -32, 균시차 약 -5.7
    expect(saju.meta.totalCorrectionMinutes).toBeLessThan(-90);
    expect(saju.meta.totalCorrectionMinutes).toBeGreaterThan(-105);
  });

  it('서머타임 출생은 보정 여부로 시주가 갈린다', () => {
    const corrected = computeSaju(at(1988, 7, 15, 14), { useDst: true, useLongitude: false });
    const raw = computeSaju(at(1988, 7, 15, 14), { useDst: false, useLongitude: false });

    expect(corrected.pillars.meta.civilTime.hour).toBe(13);
    expect(raw.pillars.meta.civilTime.hour).toBe(14);
    expect(corrected.pillars.hour.branch).toBe('未'); // 13~15시
    expect(raw.pillars.hour.branch).toBe('未');

    // 같은 시지라도 일주는 동일해야 한다
    expect(corrected.pillars.day.name).toBe(raw.pillars.day.name);
  });

  it('전 구간에서 4주가 성립한다', () => {
    for (const year of [1907, 1910, 1949, 1957, 1960, 1987, 1988, 2025]) {
      const saju = computeSaju(at(year, 7, 15, 14), {
        useLongitude: true,
        useEquationOfTime: true,
      });
      expect(formatPillars(saju.pillars).split(' '), `${year}년`).toHaveLength(4);
    }
  });
});
