import { describe, expect, it } from 'vitest';

import type { RpcRow } from '@/src/lib/db';

import { sinceDay } from '@/src/lib/ops/today-labels';
import { figuresOf, todayFiguresOf } from './read';

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

describe('숫자 한 줄 — bigint 칸이 수로도 글자로도 온다 (G-110 ①)', () => {
  it('수로 온 칸은 그대로 옮긴다', () => {
    expect(figuresOf(row())).toEqual({
      period: 'today',
      since: '2026-10-15T15:00:00+00:00',
      signups: 3,
      readings: 7,
      orders: 2,
      revenue: 17800,
      refunds: 1,
      refunded: 4300,
    });
  });

  it('글자로 온 칸도 같은 수다 — 여섯 칸 모두', () => {
    const figures = figuresOf(
      row({ signups: '3', readings: '7', orders: '2', revenue: '17800', refunds: '1', refunded: '4300' }),
    );
    expect(figures).toMatchObject({ signups: 3, readings: 7, orders: 2, revenue: 17800, refunds: 1, refunded: 4300 });
  });

  it('아무 일도 없던 기간은 0 이다 — 수 0 과 글자 0 모두', () => {
    // 합은 DB 가 coalesce 로 0 을 낸다(`20261210090000`) — 빈 기간이 null 이나 NaN 으로 서지 않는다
    const zero = { signups: 0, readings: 0, orders: 0, revenue: 0, refunds: 0, refunded: 0 };
    expect(figuresOf(row(zero))).toMatchObject(zero);
    expect(figuresOf(row({ revenue: '0', refunded: '0' }))).toMatchObject({ revenue: 0, refunded: 0 });
  });

  it('기간과 시작한 순간은 바꾸지 않는다', () => {
    const week = figuresOf(row({ period: 'week', since: '2026-10-11T15:00:00+00:00' }));
    expect(week.period).toBe('week');
    expect(week.since).toBe('2026-10-11T15:00:00+00:00');
  });
});
