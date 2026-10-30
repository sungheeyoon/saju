import type { RpcRow } from '../db';

/** 오늘 · 이번 주의 숫자를 화면의 값으로 옮긴다 — 웹과 앱이 함께 쓴다 (G-110 ①, ADR 0183) */
export type Period = 'today' | 'week';

export type Figures = {
  readonly period: Period;
  /** 그 기간이 시작한 순간 — 서울 0시(이번 주는 월요일 0시) */
  readonly since: string;
  readonly signups: number;
  readonly readings: number;
  /** 승인된 주문 수 */
  readonly orders: number;
  /** 승인된 주문의 결제 금액 합(원) — 나중에 환불된 주문도 든다 */
  readonly revenue: number;
  /** 환불 줄 수 — 한 주문을 두 번 나눠 돌려주면 둘 */
  readonly refunds: number;
  /** 돌려준 금액 합(원) */
  readonly refunded: number;
};

export type TodayFigures = {
  readonly today: Figures;
  readonly week: Figures;
};

/** 문의 한 줄을 화면의 값으로 옮긴다 — `bigint` 칸은 PostgREST 가 수로 내지만 글자로 와도 같은 값이다 */
export const figuresOf = (row: RpcRow<'operator_today_figures'>): Figures => ({
  period: row.period as Period,
  since: row.since,
  signups: Number(row.signups),
  readings: Number(row.readings),
  orders: Number(row.orders),
  revenue: Number(row.revenue),
  refunds: Number(row.refunds),
  refunded: Number(row.refunded),
});

/**
 * 두 줄을 기간으로 가른다 — **둘 다 있어야 한다.** 하나가 빠지면 문이 약속을 어긴 것이다(`null`).
 */
export const todayFiguresOf = (rows: readonly RpcRow<'operator_today_figures'>[]): TodayFigures | null => {
  const figures = rows.map(figuresOf);
  const today = figures.find((one) => one.period === 'today');
  const week = figures.find((one) => one.period === 'week');
  return today && week ? { today, week } : null;
};
