import { describe, expect, it } from 'vitest';

import type { RpcRow } from '@/src/lib/db';

import { sinceDay } from './labels';
import { todayFiguresOf } from './read';

/** 문의 한 줄 — `bigint` 칸(매출 · 돌려준 금액)은 PostgREST 설정에 따라 글자로 올 수 있다 */
const row = (over: Partial<Record<keyof RpcRow<'operator_today_figures'>, unknown>> = {}) =>
  ({
    period: 'today',
    since: '2026-10-15T15:00:00+00:00',
    signups: 3,
    readings: 7,
    orders: 2,
    revenue: 17800,
    refunds: 1,
    refunded: 4300,
    ...over,
  }) as unknown as RpcRow<'operator_today_figures'>;

describe('오늘 · 이번 주의 숫자 (G-110 ①)', () => {
  it('두 줄을 기간으로 가른다 — 차례에 기대지 않는다', () => {
    const figures = todayFiguresOf([
      row({ period: 'week', since: '2026-10-11T15:00:00+00:00', signups: 10 }),
      row(),
    ]);
    expect(figures?.today.signups).toBe(3);
    expect(figures?.week.signups).toBe(10);
  });

  it('글자로 온 금액도 수로 옮긴다', () => {
    const figures = todayFiguresOf([row({ revenue: '17800', refunded: '4300' }), row({ period: 'week' })]);
    expect(figures?.today.revenue).toBe(17800);
    expect(figures?.today.refunded).toBe(4300);
  });

  it('한 기간이 빠지면 null 이다 — 문이 약속을 어긴 것이다', () => {
    expect(todayFiguresOf([row()])).toBeNull();
    expect(todayFiguresOf([])).toBeNull();
  });

  it('시작한 날은 서울 날짜다 — 서울 0시는 UTC 로 전날 15시다', () => {
    expect(sinceDay('2026-10-15T15:00:00+00:00')).toBe('10월 16일 (금)');
    expect(sinceDay('2026-10-11T15:00:00+00:00')).toBe('10월 12일 (월)');
  });
});
