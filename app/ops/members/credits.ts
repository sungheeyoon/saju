import { rpcArgs, type RpcRow } from '@/src/lib/db';

import { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';
import { noteDenial } from '../denial';
import type { GrantLedger, HistoryFilter, HistoryLine } from './credit-grant';
import { DENIED } from './read';

/**
 * 회원 한 명의 **무상 지급 장부와 풀이권 이력**이 브라우저로 내려오는 문 (G-111 ①, ADR 0187).
 *
 * 회원 찾기의 문(`read.ts`)과 같은 규율이다 — 운영자인지 여기서 안 묻고, 자료를 청해 거절당하면(`42501`) 화면이 404 가 된다.
 * 문이 읽을 때마다 DB 가 접속기록에 한 줄을 적고(`members.credits` · `members.credit_history`), 거절은 `noteDenial` 이 따로 적는다.
 *
 * 둘 다 부속 정보다 — 못 읽어도 회원 화면은 서고 그 칸만 실패 줄이 선다.
 */

export type MemberGrantLedger = GrantLedger & {
  readonly used: number;
  readonly reserved: number;
};

export const ledgerOf = (row: RpcRow<'operator_member_grant_ledger'>): MemberGrantLedger => ({
  granted: row.granted,
  used: row.used,
  reserved: row.reserved,
  revocable: row.revocable,
  version: row.version,
});

export const historyLineOf = (row: RpcRow<'operator_member_credit_history'>): HistoryLine => ({
  at: row.at,
  kind: row.kind,
  source: row.source,
  delta: row.delta ?? null,
  state: row.state ?? null,
  cause: row.cause ?? null,
  reason: row.reason ?? null,
  note: row.note ?? null,
  orderNumber: row.order_number ?? null,
  actorNickname: row.actor_nickname ?? null,
  reportId: row.report_id ?? null,
  carriedOver: row.carried_over === true,
});

/** 운영 지급분의 지금 — 받은 수 · 사용 · 예약 중 · 회수할 수 있는 수 · 읽은 버전 */
export async function memberGrantLedger(
  userId: string,
): Promise<typeof DENIED | SkippableRead<MemberGrantLedger | null>> {
  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc(
    'operator_member_grant_ledger',
    rpcArgs<'operator_member_grant_ledger'>({ p_user_id: userId }),
  );
  if (error?.code === '42501') {
    await noteDenial(supabase, 'members.credits');
    return DENIED;
  }
  if (error) return unread(error, 'operator_member_grant_ledger');
  const row = data?.[0];
  return read(row === undefined ? null : ledgerOf(row));
}

export type MemberHistory = {
  readonly lines: readonly HistoryLine[];
  /** 더 있다 — 하나 더 청해 안다 */
  readonly more: boolean;
};

/** 풀이권 이력 — 구매 · 환불 · 사용 · 지급 · 회수, 최근 것부터 `limit` 줄 */
export async function memberCreditHistory(
  userId: string,
  filter: HistoryFilter,
  limit: number,
): Promise<typeof DENIED | SkippableRead<MemberHistory>> {
  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc(
    'operator_member_credit_history',
    rpcArgs<'operator_member_credit_history'>({ p_user_id: userId, p_filter: filter, p_limit: limit + 1 }),
  );
  if (error?.code === '42501') {
    await noteDenial(supabase, 'members.credit_history');
    return DENIED;
  }
  if (error) return unread(error, 'operator_member_credit_history');
  const rows = data ?? [];
  return read({ lines: rows.slice(0, limit).map(historyLineOf), more: rows.length > limit });
}
