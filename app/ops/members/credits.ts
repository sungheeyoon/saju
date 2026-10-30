import { rpcArgs } from '@/src/lib/db';
import { historyLineOf, ledgerOf, type MemberGrantLedger } from '@/src/lib/ops/members';

import { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';
import { deniedAmong, type Denied } from '../denial';
import {
  HISTORY_PAGE,
  nextCursor,
  type HistoryCursor,
  type HistoryFilter,
  type HistoryLine,
} from '@/src/lib/ops/credit-grant';

export { historyLineOf, ledgerOf, type MemberGrantLedger } from '@/src/lib/ops/members';

/**
 * 회원 한 명의 **무상 지급 장부와 풀이권 이력**이 브라우저로 내려오는 문 (G-111 ①, ADR 0187).
 *
 * 회원 찾기의 문(`read.ts`)과 같은 규율이다 — 운영자인지 여기서 안 묻고, 자료를 청해 거절당하면(`42501`) 화면이 404 가 된다.
 * 문이 읽을 때마다 DB 가 접속기록에 한 줄을 적고(`members.credits` · `members.credit_history`), 거절은 `deniedAmong` 이 따로 적는다.
 *
 * 둘 다 부속 정보다 — 못 읽어도 회원 화면은 서고 그 칸만 실패 줄이 선다.
 */

/** 운영 지급분의 지금 — 받은 수 · 사용 · 예약 중 · 회수할 수 있는 수 · 읽은 버전 */
export async function memberGrantLedger(
  userId: string,
): Promise<Denied | SkippableRead<MemberGrantLedger | null>> {
  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc(
    'operator_member_grant_ledger',
    rpcArgs<'operator_member_grant_ledger'>({ p_user_id: userId }),
  );
  const denied = await deniedAmong(supabase, 'members.credits', [{ error }]);
  if (denied) return denied;
  if (error) return unread(error, 'operator_member_grant_ledger');
  const row = data?.[0];
  return read(row === undefined ? null : ledgerOf(row));
}

export type MemberHistory = {
  readonly lines: readonly HistoryLine[];
  /** 다음 쪽의 커서 — 더 있으면(하나 더 청해 안다) 이 쪽의 마지막 줄, 없으면 `null` */
  readonly next: HistoryCursor | null;
};

/** 풀이권 이력 한 쪽 — 구매 · 환불 · 사용 · 지급 · 회수, 최근 것부터. 커서가 있으면 그 줄 다음부터 `HISTORY_PAGE` 줄 */
export async function memberCreditHistory(
  userId: string,
  filter: HistoryFilter,
  before: HistoryCursor | null,
): Promise<Denied | SkippableRead<MemberHistory>> {
  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc(
    'operator_member_credit_history',
    rpcArgs<'operator_member_credit_history'>({
      p_user_id: userId,
      p_filter: filter,
      p_limit: HISTORY_PAGE + 1,
      ...(before === null ? {} : { p_before_at: before.at, p_before_key: before.key }),
    }),
  );
  const denied = await deniedAmong(supabase, 'members.credit_history', [{ error }]);
  if (denied) return denied;
  if (error) return unread(error, 'operator_member_credit_history');
  const rows = data ?? [];
  const lines = rows.slice(0, HISTORY_PAGE).map(historyLineOf);
  return read({ lines, next: nextCursor(lines, rows.length > HISTORY_PAGE) });
}
