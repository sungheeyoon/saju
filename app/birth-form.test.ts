import { describe, expect, it } from 'vitest';

import { dateOfParts } from './birth-form';
import { dateRefusal } from '@/src/lib/input/chart';
import { DEFAULT_QUERY, missingAnswer, type Query } from '@/src/lib/input/query';

/**
 * **사용자가 적은 숫자는 폼이 지우지 않는다.**
 *
 * 다 적힌 세 칸은 범위 밖이어도 날짜로 나가고, 달력을 바꿔도 그 날짜는 그대로다 — 무엇이 틀렸는지는 거절의 문장과
 * 붉어진 칸이 말한다(ADR 0132 「2026-10-11 덧」).
 */
describe('적은 숫자는 날짜로 남는다', () => {
  it('다 적힌 세 칸은 범위 밖이어도 날짜로 나간다', () => {
    expect(dateOfParts({ year: '1990', month: '2', day: '30' })).toBe('1990-02-30');
    expect(dateOfParts({ year: '1990', month: '13', day: '5' })).toBe('1990-13-05');
    expect(dateOfParts({ year: '1908', month: '03', day: '01' })).toBe('1908-03-01');
  });

  /** 반쪽은 아직 덜 적은 것이다 — 「생년월일을 입력해 주세요.」는 여기에만 선다 */
  it('덜 적힌 칸이 있으면 아직 날짜가 아니다', () => {
    expect(dateOfParts({ year: '199', month: '05', day: '15' })).toBe('');
    expect(dateOfParts({ year: '1990', month: '', day: '15' })).toBe('');
    expect(dateOfParts({ year: '1990', month: '05', day: '' })).toBe('');
  });
});

describe('다 적은 날짜가 틀리면 어느 칸이 왜 틀렸는지 말한다', () => {
  const filled = (date: string, calendar: Query['calendar'] = 'solar'): Query => ({
    ...DEFAULT_QUERY,
    name: '민수',
    hourKnown: false,
    calendar,
    date,
  });

  it('양력은 그 달의 마지막 날을 말한다 — 윤년과 평년', () => {
    expect(dateRefusal(filled('1990-02-30'))).toEqual({ part: 'day', message: '2월은 28일까지예요.' });
    expect(dateRefusal(filled('2020-02-30'))).toEqual({ part: 'day', message: '2월은 29일까지예요.' });
    expect(dateRefusal(filled('1990-04-31'))).toEqual({ part: 'day', message: '4월은 30일까지예요.' });
    expect(dateRefusal(filled('1990-04-00'))).toEqual({ part: 'day', message: '4월은 1일부터 30일까지예요.' });
    expect(dateRefusal(filled('2020-02-29'))).toBeNull();
  });

  it('없는 달은 달 칸을 짚는다', () => {
    expect(dateRefusal(filled('1990-13-05'))).toEqual({ part: 'month', message: '월은 1~12로 입력해 주세요.' });
    expect(dateRefusal(filled('1990-00-05', 'lunar'))).toEqual({ part: 'month', message: '월은 1~12로 입력해 주세요.' });
  });

  /** 버튼 곁의 문장이 같은 답이다 — 판정하는 자리는 하나다 */
  it('버튼도 같은 문장으로 막는다', () => {
    expect(missingAnswer(filled('1990-02-30'))).toBe('2월은 28일까지예요.');
    expect(missingAnswer(filled('1990-13-05'))).toBe('월은 1~12로 입력해 주세요.');
  });

  /** 양력 1908년을 음력으로 옮기면 지우지 않고 해 칸을 짚는다 */
  it('달력을 바꿔 맞지 않게 된 해는 해 칸이다', () => {
    expect(dateRefusal(filled('1908-03-01'))).toBeNull();
    expect(dateRefusal(filled('1908-03-01', 'lunar'))?.part).toBe('year');
  });

  it('양력 2월 30일은 음력으로 옮기면 음력 표가 다시 본다', () => {
    // 1990년 음력 2월은 30일까지 · 1월은 29일까지다(표) — 양력의 거절이 아니라 음력의 거절이다
    expect(dateRefusal(filled('1990-02-30', 'lunar'))).toBeNull();
    expect(dateRefusal(filled('1990-01-30', 'lunar'))).toMatchObject({ part: 'day', message: expect.stringContaining('29일까지') });
  });

  it('없는 윤달은 달 칸, 음력 달에 없는 날은 날 칸이다', () => {
    expect(dateRefusal(filled('2019-04-01', 'lunar_leap'))).toMatchObject({ part: 'month' });
    expect(dateRefusal(filled('1990-01-31', 'lunar'))).toMatchObject({ part: 'day' });
  });

  it('아직 덜 적은 날짜에는 할 말이 없다', () => {
    expect(dateRefusal(filled(''))).toBeNull();
    expect(dateRefusal(filled('', 'lunar'))).toBeNull();
  });
});
