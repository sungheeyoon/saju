import { describe, expect, it } from 'vitest';

import { DEFAULT_QUERY, type Query } from '@/src/lib/input/query';

import {
  convertedLine,
  digitOutOfRange,
  limitsOf,
  splitDate,
  splitTime,
  timeOfParts,
} from './entry';

/** 출생 정보 폼의 숫자 칸이 값이 되는 규칙 — 칸 조각과 `Query` 사이 */

describe('숫자 한 칸의 범위', () => {
  it('덜 적은 값은 아직 틀린 것이 아니다', () => {
    expect(digitOutOfRange('', 2, 1, 12)).toBe(false);
    expect(digitOutOfRange('1', 2, 1, 12)).toBe(false);
    expect(digitOutOfRange('0', 2, 1, 12)).toBe(false);
  });

  it('자릿수가 차면 범위를 본다', () => {
    expect(digitOutOfRange('12', 2, 1, 12)).toBe(false);
    expect(digitOutOfRange('13', 2, 1, 12)).toBe(true);
    expect(digitOutOfRange('00', 2, 1, 12)).toBe(true);
  });

  it('한 자리로 끝난 값(시 칸의 「3」 — 더 적으면 30 을 넘는다)도 범위 안이면 붉지 않다', () => {
    expect(digitOutOfRange('3', 2, 0, 23)).toBe(false);
    expect(digitOutOfRange('5', 2, 1, 12)).toBe(false);
  });

  it('네 자리 해는 받는 범위 밖이면 붉다', () => {
    expect(digitOutOfRange('1800', 4, 1900, 2030)).toBe(true);
    expect(digitOutOfRange('190', 4, 1900, 2030)).toBe(false);
  });
});

describe('시각은 두 칸이 다 범위 안일 때만 선다', () => {
  it('두 자리로 채워 잇는다', () => {
    expect(timeOfParts({ hour: '9', minute: '5' })).toBe('09:05');
    expect(timeOfParts({ hour: '23', minute: '59' })).toBe('23:59');
    expect(timeOfParts({ hour: '0', minute: '0' })).toBe('00:00');
  });

  it('「25:70」 · 반쪽은 시각이 아니다', () => {
    expect(timeOfParts({ hour: '25', minute: '10' })).toBe('');
    expect(timeOfParts({ hour: '10', minute: '70' })).toBe('');
    expect(timeOfParts({ hour: '10', minute: '' })).toBe('');
  });
});

describe('값을 칸 조각으로 쪼갠다', () => {
  it('꼴이 맞으면 쪼개고, 아니면 빈 칸이다', () => {
    expect(splitDate('1990-05-15')).toEqual({ year: '1990', month: '05', day: '15' });
    expect(splitDate('')).toEqual({ year: '', month: '', day: '' });
    expect(splitDate('1990-5-15')).toEqual({ year: '', month: '', day: '' });
    expect(splitTime('07:30')).toEqual({ hour: '07', minute: '30' });
    expect(splitTime('7:30')).toEqual({ hour: '', minute: '' });
  });
});

describe('달력이 정하는 날의 상한', () => {
  it('양력은 다 적힌 해 · 달의 실제 길이다', () => {
    expect(limitsOf('solar', '2020', '2').maxDay).toBe(29);
    expect(limitsOf('solar', '1990', '2').maxDay).toBe(28);
    expect(limitsOf('solar', '1990', '4').maxDay).toBe(30);
  });

  it('해가 덜 적혔거나 달이 비었으면 31, 음력은 30 이다', () => {
    expect(limitsOf('solar', '199', '2').maxDay).toBe(31);
    expect(limitsOf('solar', '1990', '').maxDay).toBe(31);
    expect(limitsOf('lunar', '1990', '1').maxDay).toBe(30);
  });
});

describe('음력 입력 아래의 한 줄', () => {
  const filled = (date: string, calendar: Query['calendar']): Query => ({ ...DEFAULT_QUERY, calendar, date });

  it('양력이거나 날짜가 없으면 서지 않는다', () => {
    expect(convertedLine(filled('1990-05-15', 'solar'))).toBeNull();
    expect(convertedLine(filled('', 'lunar'))).toBeNull();
  });

  it('바꾼 양력을 말한다', () => {
    expect(convertedLine(filled('1990-01-01', 'lunar'))).toEqual({ ok: true, text: '양력 1990년 1월 27일로 계산해요' });
  });

  it('없는 날은 이유를 말한다', () => {
    expect(convertedLine(filled('1990-01-30', 'lunar'))).toMatchObject({ ok: false, text: expect.stringContaining('29일까지') });
  });
});
