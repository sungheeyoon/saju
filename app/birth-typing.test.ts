import { describe, expect, it } from 'vitest';

import { DEFAULT_QUERY, missingAnswer, type Query } from '@/src/lib/input/query';

import { caretAfterDigits, dateText, missingFieldOf, pastedBirth, timeText, typedDate, typedTime } from './birth-typing';

/** 양력 달 길이 — 폼의 `limitsOf` 와 같은 셈(여기서는 시험용으로 한 줄) */
const solarMaxDay = (year: string, month: string) =>
  year.length === 4 && month.length === 2 ? new Date(Number(year), Number(month), 0).getDate() : 31;

/** 한 자리씩 친다 — 칸이 꾸민 글을 다음 누름의 바탕으로 쓴다 */
const typeDate = (keys: string) =>
  [...keys].reduce((digits, key) => typedDate(digits, `${dateText(digits)}${key}`, solarMaxDay), '');
const typeTime = (keys: string) => [...keys].reduce((digits, key) => typedTime(digits, `${timeText(digits)}${key}`), '');

describe('생년월일은 숫자 여덟 자리를 한 칸에 친다', () => {
  it('치는 대로 점이 들어간다', () => {
    expect(dateText('1990')).toBe('1990');
    expect(dateText('19900')).toBe('1990.0');
    expect(dateText('19900515')).toBe('1990.05.15');
    expect(typeDate('19900515')).toBe('19900515');
  });

  it('두 자리가 될 수 없는 첫 자리에는 0 을 채운다', () => {
    expect(typeDate('19905')).toBe('199005');
    expect(typeDate('1990054')).toBe('19900504');
    // 2월은 29일까지라 「3」도 한 자리다
    expect(typeDate('199023')).toBe('19900203');
  });

  it('두 자리가 될 수 있으면 기다린다 — 1월인지 10~12월인지, 3일인지 30일인지', () => {
    expect(typeDate('19901')).toBe('19901');
    expect(typeDate('1990013')).toBe('1990013');
  });

  it('점을 지운 누름은 그 앞 숫자를 지운다', () => {
    expect(typedDate('199005', '1990.0', solarMaxDay)).toBe('19900');
    expect(typedDate('19900', '1990.', solarMaxDay)).toBe('1990');
  });

  it('한 자리씩 지우는 동안에는 구분자로 다시 읽지 않는다 — 「1990.05.1」은 5월 1일이 아니다', () => {
    expect(typedDate('19900515', '1990.05.1', solarMaxDay)).toBe('1990051');
  });

  it('구분자로 붙여 넣거나 자동완성된 날짜는 구분자로 가른다', () => {
    expect(typedDate('', '1990-5-15', solarMaxDay)).toBe('19900515');
    expect(typedDate('', '1990년 5월 15일', solarMaxDay)).toBe('19900515');
    expect(typedDate('', '19900515', solarMaxDay)).toBe('19900515');
  });
});

describe('출생 시각은 네 자리를 한 칸에 친다', () => {
  it('치는 대로 쌍점이 들어간다', () => {
    expect(timeText('14')).toBe('14');
    expect(timeText('143')).toBe('14:3');
    expect(typeTime('1430')).toBe('1430');
  });

  it('두 자리 시 · 분이 될 수 없는 첫 자리에는 0 을 채운다', () => {
    expect(typeTime('7')).toBe('07');
    expect(typeTime('77')).toBe('0707');
    expect(typeTime('2')).toBe('2');
  });

  it('붙여 넣은 「2:05」 · 「14시 30분」을 읽는다', () => {
    expect(typedTime('', '2:05')).toBe('0205');
    expect(typedTime('', '14시 30분')).toBe('1430');
  });
});

describe('붙여 넣은 생일 한 줄에서 날짜와 시각을 함께 읽는다', () => {
  it.each([
    ['19900515', '19900515', null],
    ['199005151430', '19900515', '1430'],
    ['1990-05-15', '19900515', null],
    ['1990.5.15 14:30', '19900515', '1430'],
    ['1990년 5월 15일 오후 2시 30분', '19900515', '1430'],
    ['1990/05/15 오전 12:10', '19900515', '0010'],
    ['생일: 1990.05.15 PM 2:05', '19900515', '1405'],
  ])('%s', (text, date, time) => {
    expect(pastedBirth(text)).toEqual({ date, time });
  });

  it('날짜가 없으면 읽지 않는다 — 칸이 평소대로 받는다', () => {
    expect(pastedBirth('14:30')).toBeNull();
    expect(pastedBirth('1990')).toBeNull();
  });
});

describe('가운데를 고쳐도 커서가 끝으로 튀지 않는다', () => {
  it('숫자 n 개 뒤의 자리', () => {
    expect(caretAfterDigits('1990.05.15', 0)).toBe(0);
    expect(caretAfterDigits('1990.05.15', 4)).toBe(4);
    expect(caretAfterDigits('1990.05.15', 5)).toBe(6);
    expect(caretAfterDigits('1990.05', 9)).toBe(7);
  });
});

describe('제출을 막은 칸은 거절의 문장과 같은 칸이다', () => {
  const filled: Query = { ...DEFAULT_QUERY, name: '민지', date: '1990-05-15', time: '14:30' };

  it.each<[string, Partial<Query>, string | null]>([
    ['다 채움', {}, null],
    ['이름 없음', { name: ' ' }, 'name'],
    ['날짜 없음', { date: '' }, 'date'],
    ['받지 않는 해', { date: '1850-05-15' }, 'date'],
    ['시각을 안 적음', { time: '' }, 'time'],
    ['시각을 고르지 않음(주소)', { hourKnown: null, time: '' }, 'time'],
    ['시각 모름', { hourKnown: false, time: '' }, null],
  ])('%s', (_, change, field) => {
    const query = { ...filled, ...change };
    expect(missingFieldOf(query)).toBe(field);
    expect(missingAnswer(query) === null).toBe(field === null);
  });
});
