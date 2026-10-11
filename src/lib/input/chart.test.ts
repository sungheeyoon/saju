import { describe, expect, it } from 'vitest';

import { calculateChart, dateRefusal } from './chart';
import { unsupportedForSaving } from './edit';
import { DEFAULT_QUERY, type Query } from './query';

/**
 * **음력 표의 거절도 양력과 같은 말투로 선다**(대장 42 · ADR 0132 「2026-10-11 덧」).
 *
 * 엔진은 갈래(`LunarConversionError.reason`)와 표의 숫자(`lunarMonthsOf`)를 내고, 문장은 입력 층이 짓는다. 엔진의
 * 문장(「음력 1990년 1월은 29일까지입니다: 31일」)은 합쇼체에 디버그 꼬리라 어느 화면에도 서면 안 된다.
 */
describe('음력 날짜가 틀리면 어느 칸이 왜 틀렸는지 해요체로 말한다', () => {
  const filled = (date: string, calendar: Query['calendar']): Query => ({
    ...DEFAULT_QUERY,
    name: '민수',
    hourKnown: false,
    calendar,
    date,
  });

  // 1990년 음력 1월은 29일 · 2020년 윤4월은 29일 · 2017년 윤달은 윤5월 · 2019년에는 윤달이 없다(표)
  it.each([
    ['그 달에 없는 날', filled('1990-01-30', 'lunar'), { part: 'day', message: '음력 1월은 29일까지예요.' }],
    ['윤달에 없는 날', filled('2020-04-30', 'lunar_leap'), { part: 'day', message: '음력 윤4월은 29일까지예요.' }],
    ['0일', filled('1990-01-00', 'lunar'), { part: 'day', message: '음력 1월은 1일부터 29일까지예요.' }],
    ['윤달이 없는 해', filled('2019-04-01', 'lunar_leap'), { part: 'month', message: '2019년에는 윤달이 없어요.' }],
    ['다른 달이 윤달인 해', filled('2017-04-01', 'lunar_leap'), { part: 'month', message: '2017년 윤달은 윤5월이에요.' }],
  ] as const)('%s', (_, query, refusal) => {
    expect(dateRefusal(query)).toEqual(refusal);
    // 계산(첫 화면 · `/saju` · 궁합)과 저장(서버 액션)이 같은 문장을 쓴다
    expect(calculateChart(query)).toEqual({ ok: false, message: refusal.message });
    expect(unsupportedForSaving(query)).toBe(refusal.message);
  });

  it('있는 날은 거절하지 않는다', () => {
    expect(dateRefusal(filled('1990-02-30', 'lunar'))).toBeNull();
    expect(dateRefusal(filled('2017-05-29', 'lunar_leap'))).toBeNull();
  });

  /** 표 밖의 해는 받는 해의 범위가 먼저 거절한다 — 음력 표의 「1912~2100년만 변환합니다」는 서지 않는다 */
  it('표 밖의 해는 해 칸이고 받는 범위를 말한다', () => {
    expect(dateRefusal(filled('1905-04-01', 'lunar'))).toMatchObject({ part: 'year', message: expect.stringContaining('1912~') });
  });

  it('엔진의 합쇼체 문장은 어느 갈래에서도 안 선다', () => {
    for (const query of [filled('1990-01-31', 'lunar'), filled('2019-04-01', 'lunar_leap'), filled('2017-04-01', 'lunar_leap')]) {
      expect(dateRefusal(query)?.message).not.toMatch(/니다|:/);
    }
  });
});
