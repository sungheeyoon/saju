import { rpcArgs } from '@/src/lib/db';
import { sanctionsOf, type MemberSanctions } from '@/src/lib/ops/members';

import { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';
import { deniedAmong, type Denied } from '../denial';

export { sanctionsOf, type MemberSanctions } from '@/src/lib/ops/members';

/**
 * 회원 한 명의 **처분 이력과 지금 상태**가 브라우저로 내려오는 문 (G-111 ③, ADR 0189).
 *
 * 회원 찾기의 문(`read.ts`)과 같은 규율이다 — 운영자인지 여기서 안 묻고, 자료를 청해 거절당하면(`42501`) 화면이 404 가 된다.
 * 문이 읽을 때마다 DB 가 접속기록에 한 줄을 적고(`members.sanctions`), 거절은 `deniedAmong` 이 따로 적는다.
 *
 * 부속 정보다 — 못 읽어도 회원 화면은 서고 그 칸만 실패 줄이 선다. 그때는 정지 · 해제 단추도 서지 않는다(읽은 버전이 없다).
 */

export async function memberSanctions(
  userId: string,
): Promise<Denied | SkippableRead<MemberSanctions | null>> {
  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc(
    'operator_member_sanctions',
    rpcArgs<'operator_member_sanctions'>({ p_user_id: userId }),
  );
  const denied = await deniedAmong(supabase, 'members.sanctions', [{ error }]);
  if (denied) return denied;
  if (error) return unread(error, 'operator_member_sanctions');
  const row = data?.[0];
  return read(row === undefined ? null : sanctionsOf(row));
}
