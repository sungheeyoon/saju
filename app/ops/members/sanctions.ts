import { rpcArgs, type RpcRow } from '@/src/lib/db';

import { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';
import { noteDenial } from '../denial';
import { DENIED } from './read';
import { sanctionEntriesOf, type SanctionEntry, type Standing } from './suspension';

/**
 * 회원 한 명의 **처분 이력과 지금 상태**가 브라우저로 내려오는 문 (G-111 ③, ADR 0189).
 *
 * 회원 찾기의 문(`read.ts`)과 같은 규율이다 — 운영자인지 여기서 안 묻고, 자료를 청해 거절당하면(`42501`) 화면이 404 가 된다.
 * 문이 읽을 때마다 DB 가 접속기록에 한 줄을 적고(`members.sanctions`), 거절은 `noteDenial` 이 따로 적는다.
 *
 * 부속 정보다 — 못 읽어도 회원 화면은 서고 그 칸만 실패 줄이 선다. 그때는 정지 · 해제 단추도 서지 않는다(읽은 버전이 없다).
 */

export type MemberSanctions = Standing & { readonly entries: readonly SanctionEntry[] };

export const sanctionsOf = (row: RpcRow<'operator_member_sanctions'>): MemberSanctions => ({
  status: row.status,
  isOperator: row.is_operator === true,
  version: row.version,
  warnings12m: row.warnings_12m,
  entries: sanctionEntriesOf(row.lines ?? null),
});

export async function memberSanctions(
  userId: string,
): Promise<typeof DENIED | SkippableRead<MemberSanctions | null>> {
  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc(
    'operator_member_sanctions',
    rpcArgs<'operator_member_sanctions'>({ p_user_id: userId }),
  );
  if (error?.code === '42501') {
    await noteDenial(supabase, 'members.sanctions');
    return DENIED;
  }
  if (error) return unread(error, 'operator_member_sanctions');
  const row = data?.[0];
  return read(row === undefined ? null : sanctionsOf(row));
}
