import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import {
  InvalidSajuInputError,
  SUPPORTED_YEAR_RANGE,
  assertValidSajuInput,
  daysInMonth,
  isLeapYear,
  normalizeSajuInput,
  type SajuInput,
} from '@/src/lib/saju/input';

/**
 * 입력 계약 테스트.
 *
 * 이 파일이 지키는 것은 계산의 정확도가 아니라 **거부**다. 잘못된 입력이
 * 조용히 그럴듯한 사주로 흘러가는 것이 가장 위험한 실패 유형이므로,
 * "던져야 할 때 던지는가"를 값별로 못박는다.
 */

const valid: SajuInput = { year: 2025, month: 6, day: 15, hour: 12, minute: 30, second: 0 };

/** 유효 입력 하나를 특정 필드만 바꿔 망가뜨린다. */
const broken = (patch: Partial<Record<string, unknown>>) =>
  ({ ...valid, ...patch }) as unknown as SajuInput;

describe('윤년 규칙(isLeapYear · daysInMonth)', () => {
  it('4의 배수는 윤년, 100의 배수는 평년, 400의 배수는 다시 윤년', () => {
    expect(isLeapYear(1900)).toBe(false); // 100의 배수
    expect(isLeapYear(2000)).toBe(true); // 400의 배수
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(2100)).toBe(false);
  });

  it('2월의 마지막 날이 윤년 규칙을 따른다', () => {
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
  });

  it('나머지 달은 해와 무관하게 고정이다', () => {
    const lengths = [1, 3, 5, 7, 8, 10, 12].map((m) => daysInMonth(2025, m));
    expect(lengths.every((d) => d === 31)).toBe(true);
    for (const month of [4, 6, 9, 11]) {
      expect(daysInMonth(2025, month), `${month}월`).toBe(30);
    }
  });

  it('달이 아닌 값에는 null 을 낸다', () => {
    expect(daysInMonth(2025, 0)).toBeNull();
    expect(daysInMonth(2025, 13)).toBeNull();
    expect(daysInMonth(2025, 1.5)).toBeNull();
  });
});

describe('입력 검증(assertValidSajuInput)', () => {
  it('정상 입력은 통과시킨다', () => {
    expect(() => assertValidSajuInput(valid)).not.toThrow();
    expect(() => assertValidSajuInput({ ...valid, hour: 0, minute: 0, second: 0 })).not.toThrow();
    expect(() => assertValidSajuInput({ ...valid, hour: 23, minute: 59, second: 59 })).not.toThrow();
  });

  it('존재하지 않는 날짜를 거부한다 — 정규화로 흘려보내지 않는다', () => {
    // JavaScript Date 라면 2025-02-30 을 3월 2일로 바꿔 계산해버린다.
    expect(() => assertValidSajuInput(broken({ month: 2, day: 30 }))).toThrow(
      InvalidSajuInputError,
    );
    expect(() => assertValidSajuInput(broken({ year: 2025, month: 2, day: 29 }))).toThrow(
      InvalidSajuInputError,
    );
    expect(() => assertValidSajuInput(broken({ month: 4, day: 31 }))).toThrow(
      InvalidSajuInputError,
    );
    expect(() => assertValidSajuInput(broken({ day: 0 }))).toThrow(InvalidSajuInputError);
    expect(() => assertValidSajuInput(broken({ month: 13 }))).toThrow(InvalidSajuInputError);
    expect(() => assertValidSajuInput(broken({ month: 0 }))).toThrow(InvalidSajuInputError);
  });

  it('윤년 2월 29일은 통과시킨다', () => {
    expect(() => assertValidSajuInput(broken({ year: 2024, month: 2, day: 29 }))).not.toThrow();
    expect(() => assertValidSajuInput(broken({ year: 2000, month: 2, day: 29 }))).not.toThrow();
    expect(() => assertValidSajuInput(broken({ year: 1900, month: 2, day: 29 }))).toThrow(
      InvalidSajuInputError,
    );
  });

  it('시·분·초의 범위를 강제한다', () => {
    expect(() => assertValidSajuInput(broken({ hour: 24 }))).toThrow(InvalidSajuInputError);
    expect(() => assertValidSajuInput(broken({ hour: -1 }))).toThrow(InvalidSajuInputError);
    expect(() => assertValidSajuInput(broken({ minute: 60 }))).toThrow(InvalidSajuInputError);
    expect(() => assertValidSajuInput(broken({ minute: -1 }))).toThrow(InvalidSajuInputError);
    expect(() => assertValidSajuInput(broken({ second: 60 }))).toThrow(InvalidSajuInputError);
  });

  it('정수가 아니거나 숫자가 아닌 값을 거부한다', () => {
    // null 은 여기 없다 — 그것만은 "시간 미상"이라는 뜻으로 유효하다.
    for (const bad of [1.5, NaN, Infinity, -Infinity, '12', undefined]) {
      expect(() => assertValidSajuInput(broken({ hour: bad })), String(bad)).toThrow(
        InvalidSajuInputError,
      );
    }
    expect(() => assertValidSajuInput(broken({ year: 2025.5 }))).toThrow(InvalidSajuInputError);
    expect(() => assertValidSajuInput(broken({ day: NaN }))).toThrow(InvalidSajuInputError);
  });

  it('지원 연도 범위를 강제한다', () => {
    const { min, max } = SUPPORTED_YEAR_RANGE;
    expect(() => assertValidSajuInput(broken({ year: min }))).not.toThrow();
    expect(() => assertValidSajuInput(broken({ year: max }))).not.toThrow();
    expect(() => assertValidSajuInput(broken({ year: min - 1 }))).toThrow(InvalidSajuInputError);
    expect(() => assertValidSajuInput(broken({ year: max + 1 }))).toThrow(InvalidSajuInputError);
  });

  it('어느 필드가 문제인지 에러에 담는다', () => {
    try {
      assertValidSajuInput(broken({ month: 2, day: 30 }));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidSajuInputError);
      const invalid = error as InvalidSajuInputError;
      expect(invalid.field).toBe('day');
      expect(invalid.value).toBe(30);
      expect(invalid.message).toContain('28일까지');
    }

    try {
      assertValidSajuInput(broken({ year: 1899 }));
      expect.unreachable();
    } catch (error) {
      expect((error as InvalidSajuInputError).field).toBe('year');
      expect((error as InvalidSajuInputError).message).toContain('1900~2100');
    }
  });

  it('시간 미상 입력에서는 분·초를 따지지 않는다', () => {
    expect(() =>
      assertValidSajuInput({ year: 2025, month: 6, day: 15, hour: null }),
    ).not.toThrow();
    // 날짜 검증은 그대로 걸린다
    expect(() =>
      assertValidSajuInput({ year: 2025, month: 2, day: 30, hour: null }),
    ).toThrow(InvalidSajuInputError);
  });
});

describe('입력 정규화(normalizeSajuInput)', () => {
  it('시각을 알면 그대로 쓴다', () => {
    expect(normalizeSajuInput(valid)).toEqual({ civil: valid, hourKnown: true });
  });

  it('시간 미상은 정오로 채우고 표시를 남긴다', () => {
    expect(normalizeSajuInput({ year: 2025, month: 6, day: 15, hour: null })).toEqual({
      civil: { year: 2025, month: 6, day: 15, hour: 12, minute: 0, second: 0 },
      hourKnown: false,
    });
  });
});

describe('엔진 입구(computeSaju) — 계약', () => {
  it('잘못된 입력에 사주를 내주지 않는다', () => {
    expect(() => computeSaju(broken({ month: 2, day: 30 }))).toThrow(InvalidSajuInputError);
    expect(() => computeSaju(broken({ hour: 24 }))).toThrow(InvalidSajuInputError);
    expect(() => computeSaju(broken({ minute: 60 }))).toThrow(InvalidSajuInputError);
    expect(() => computeSaju(broken({ year: 1899 }))).toThrow(InvalidSajuInputError);
    expect(() => computeSaju(broken({ year: 2101 }))).toThrow(InvalidSajuInputError);
  });

  it('경계 연도는 계산해 준다', () => {
    for (const year of [SUPPORTED_YEAR_RANGE.min, SUPPORTED_YEAR_RANGE.max]) {
      const saju = computeSaju({ year, month: 6, day: 15, hour: 12, minute: 0, second: 0 });
      expect(saju.pillars.day.name, `${year}년`).toHaveLength(2);
    }
  });

  it('시간 미상이면 시주와 시주 십성만 빈다', () => {
    const saju = computeSaju({ year: 2025, month: 6, day: 15, hour: null });

    expect(saju.pillars.hour).toBeNull();
    expect(saju.pillars.meta.hourKnown).toBe(false);
    expect(saju.meta.hourKnown).toBe(false);
    expect(saju.analysis.tenGods.hour).toBeNull();

    // 나머지는 그대로 나온다
    expect(saju.pillars.year.name).toBe('乙巳');
    expect(saju.pillars.month.name).toBe('壬午');
    expect(saju.pillars.day.name).toBe('乙卯');
    expect(saju.pillars.dayMaster).toBe('乙');
  });

  it('시간 미상이면 여섯 글자로 센다', () => {
    const saju = computeSaju({ year: 2025, month: 6, day: 15, hour: null });
    const { counts, glyphCount } = saju.analysis.elements;

    expect(glyphCount).toBe(6);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(6);
    // 천간 2자(일간 제외) + 지지 3자
    expect(Object.values(saju.analysis.tenGodCounts).reduce((a, b) => a + b, 0)).toBe(5);
  });

  it('시각을 알면 여덟 글자로 센다', () => {
    const saju = computeSaju(valid);
    expect(saju.analysis.elements.glyphCount).toBe(8);
    expect(Object.values(saju.analysis.elements.counts).reduce((a, b) => a + b, 0)).toBe(8);
    expect(Object.values(saju.analysis.tenGodCounts).reduce((a, b) => a + b, 0)).toBe(7);
  });

  it('시간 미상은 자시 규칙에 흔들리지 않는다', () => {
    const input: SajuInput = { year: 2025, month: 6, day: 15, hour: null };
    const jo = computeSaju(input, { lateNightRule: 'jo' });
    const ya = computeSaju(input, { lateNightRule: 'ya' });

    expect(jo.pillars.day.name).toBe(ya.pillars.day.name);
    expect(jo.pillars.meta.lateNightShiftApplied).toBe(false);
    expect(ya.pillars.meta.lateNightShiftApplied).toBe(false);
  });

  it('입력한 시각과 계산에 쓴 시각을 함께 남긴다', () => {
    const known = computeSaju(valid);
    expect(known.meta.inputTime).toEqual(valid);
    expect(known.meta.resolvedTime).toEqual(valid);

    const unknown = computeSaju({ year: 2025, month: 6, day: 15, hour: null });
    expect(unknown.meta.inputTime.hour).toBeNull();
    expect(unknown.meta.resolvedTime.hour).toBe(12);
  });
});
