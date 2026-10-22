import type { RpcRow } from '@/src/lib/db';

import { supabaseOnServer } from '../../auth/server-client';
import { dbFailure } from '../../db-error';
import { deniedAmong, type Denied } from '../denial';

/**
 * 오늘 · 이번 주의 숫자가 **브라우저로 내려오는 문** (G-110 ①, ADR 0183).
 *
 * `/ops/survey` 의 문(`app/ops/survey/read.ts`)과 같은 규율이다. **여기서 아무것도 세지 않는다** — 무엇을 어느 기간으로 세는가는
 * DB 의 `operator_today_figures` 하나가 정한다. 기간의 경계(서울 0시 · 서울 월요일 0시)도 DB 가 짓는다 — 서버의 시계는 UTC 라
 * 여기서 지으면 「오늘」이 아홉 시간 어긋난다.
 *
 * **운영자인지 여기서 안 묻는다** — 자료를 청해 거절당하는 것으로 안다(`42501`). 문이 읽을 때마다 DB 가 접속기록에 한 줄
 * (`today.figures`)을 적고, 거절은 아래 `deniedAmong` 이 같은 이름으로 적는다.
 */

export { DENIED } from '../denial';

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

/**
 * 숫자가 이 화면의 본체라 못 읽으면 던진다 — 오류 경계가 받는다(ADR 0078).
 *
 * @returns 거절이면 `DENIED`.
 */
export async function operatorTodayFigures(): Promise<TodayFigures | Denied> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('operator_today_figures');
  const denied = await deniedAmong(supabase, 'today.figures', [{ error }]);
  if (denied) return denied;
  if (error) throw dbFailure(error, 'operator_today_figures');

  const figures = todayFiguresOf(data ?? []);
  if (figures === null) throw new Error('operator_today_figures: 오늘 · 이번 주 두 줄이 아니다');
  return figures;
}
