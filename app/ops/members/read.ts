import { rpcArgs } from '@/src/lib/db';
import { memberOf, type MemberRecord } from '@/src/lib/ops/members';

import { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';
import { deniedAmong, type Denied } from '../denial';

/**
 * 회원 한 명이 **브라우저로 내려오는 문** (G-110 ③, ADR 0185).
 *
 * 신고 화면의 문(`../reports/read.ts`)과 같은 규율이다. **운영자인지 여기서 안 묻는다** — 묻는 자리는 DB 의
 * `is_operator()` 하나고, 자료를 청해서 거절당하는 것으로 안다(`42501`). **문이 읽을 때마다 DB 가 접속기록에 한 줄을
 * 적는다** — 성공은 문 안에서(`members.find`), 거절은 아래 `deniedAmong` 이 머리 문의 이름 한 줄로.
 * 기록에는 찾은 말(닉네임)이 안 들어간다 — 무엇으로 찾았나와 찾은 계정 id 만이다.
 *
 * 찾는 열쇠는 닉네임이나 계정 id 다 — 이메일은 문이 받지도 내지도 않는다. 닉네임은 유일하므로 찾으면 한 명이다.
 *
 * 생성 타입은 반환 칸을 전부 `null` 이 아닌 것으로 적는다(`returns table` 의 한계) — 닉네임 칸은 실제로 빈다.
 */

export { DENIED } from '../denial';
export { QUERY_MAX, memberOf, queryOf, type CreditSource, type Member, type MemberCredits } from '@/src/lib/ops/members';

/**
 * 한 명을 찾는다. 없으면 `null` — 화면은 「찾는 회원이 없습니다」를 세운다. 처분 이력(경고 · 이용 정지 결정 · 상태 이력)은
 * `sanctions.ts` 가 따로 청한다(ADR 0189 — 옛 경고 이력 문 `operator_member_warnings` 는 화면이 더는 안 부른다).
 * 못 읽으면 빈 결과가 아니라 실패다 — 신고 목록처럼 운영자 화면이 제 문장을 세운다.
 *
 * 찾는 말이 없어도(`null`) 문을 부른다 — 그때 문은 운영자인가만 묻고 빈 결과를 낸다(적지 않는다). 그래야 찾는 칸만 선
 * 첫 화면도 운영자가 아니면 404 다.
 */
export async function operatorMember(
  query: string | null,
): Promise<Denied | SkippableRead<MemberRecord | null>> {
  const supabase = await supabaseOnServer();
  const found = await supabase.rpc('operator_member', rpcArgs<'operator_member'>({ p_query: query }));

  const denied = await deniedAmong(supabase, 'members.find', [found]);
  if (denied) return denied;
  if (found.error) return unread(found.error, 'operator_member');

  const row = found.data?.[0];
  if (row === undefined) return read(null);

  return read({ member: memberOf(row) });
}
