import { describe, expect, it } from 'vitest';

import { gapOf, isSettled, parseDateText, parseTimeText } from './birth-entry';
import { BIRTH_YEAR_MAX, DEFAULT_QUERY, missingAnswer } from '@/src/lib/input/query';

const filled = { ...DEFAULT_QUERY, name: '민수', date: '1990-05-15', time: '14:30' };

describe('빈칸은 그 줄에 선다 — 문장은 `missingAnswer` 그대로', () => {
  it('다 채웠으면 빈칸이 없다', () => {
    expect(gapOf(filled)).toBeNull();
  });

  it('이름 → 생년월일 → 출생 시각 차례로 하나만 낸다', () => {
    const blank = { ...DEFAULT_QUERY };
    expect(gapOf(blank)).toEqual({ field: 'name', message: missingAnswer(blank) });
    expect(gapOf({ ...blank, name: '민수' })?.field).toBe('date');
    expect(gapOf({ ...filled, time: '' })?.field).toBe('time');
    expect(gapOf({ ...filled, hourKnown: null, time: '' })?.field).toBe('time');
  });

  it('받지 않는 해는 생년월일 줄의 빈칸이다', () => {
    const late = { ...filled, date: `${BIRTH_YEAR_MAX + 1}-01-01` };
    expect(gapOf(late)).toEqual({ field: 'date', message: missingAnswer(late) });
  });

  it('시각을 모른다고 답했으면 빈칸이 아니다', () => {
    expect(gapOf({ ...filled, hourKnown: false, time: '' })).toBeNull();
  });
});

describe('붙여 넣은 날짜', () => {
  it.each([
    ['1990-05-15', { year: '1990', month: '05', day: '15' }],
    ['1990.5.15', { year: '1990', month: '5', day: '15' }],
    ['1990/05/15', { year: '1990', month: '05', day: '15' }],
    ['19900515', { year: '1990', month: '05', day: '15' }],
    [' 1990년 5월 15일 ', { year: '1990', month: '5', day: '15' }],
    ['1990. 5. 15.', { year: '1990', month: '5', day: '15' }],
  ])('%s 를 읽는다', (text, parts) => {
    expect(parseDateText(text)).toEqual(parts);
  });

  it.each(['90.05.15', '1990', '오월', '1990-05', '1990-05-15 14:30'])('%s 는 읽지 않는다', (text) => {
    expect(parseDateText(text)).toBeNull();
  });
});

describe('붙여 넣은 시각 — 24시간으로만', () => {
  it.each([
    ['14:30', { hour: '14', minute: '30' }],
    ['1430', { hour: '14', minute: '30' }],
    ['9:05', { hour: '9', minute: '05' }],
    ['14시 30분', { hour: '14', minute: '30' }],
    ['14시', { hour: '14', minute: '00' }],
  ])('%s 를 읽는다', (text, parts) => {
    expect(parseTimeText(text)).toEqual(parts);
  });

  it.each(['오후 2시', '2pm', '143'])('%s 는 읽지 않는다', (text) => {
    expect(parseTimeText(text)).toBeNull();
  });
});

describe('다 적힌 칸', () => {
  it('자릿수를 채웠거나 한 자리로 더 적을 수 없으면 다 적었다', () => {
    expect(isSettled('', 2, 12)).toBe(false);
    expect(isSettled('1', 2, 12)).toBe(false);
    expect(isSettled('5', 2, 12)).toBe(true);
    expect(isSettled('12', 2, 12)).toBe(true);
    expect(isSettled('199', 4, 2030)).toBe(false);
    expect(isSettled('3', 2, 31)).toBe(false);
    expect(isSettled('4', 2, 31)).toBe(true);
  });
});
