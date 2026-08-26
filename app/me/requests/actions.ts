'use server';

import { revalidatePath } from 'next/cache';

import { REQUEST_STATUSES, type RequestStatus } from '@/src/lib/consent';

import { supabaseOnServer } from '../../auth/server-client';
import type { SaveResult } from '../actions';

/**
 * 답한 결과는 **세 갈래**다.
 *
 * 수락·거절 말고 **무효**가 있다. 누른 사람이 수락을 눌렀는데 무효가 나오는 경우가
 * 실재하고(그 사이에 낀 판본 수정), 그때 화면이 「수락했습니다」라고 말하면 사용자는
 * 없는 Match 를 찾게 된다. 그래서 결과를 성공/실패가 아니라 **상태**로 돌려준다.
 */
export type RespondResult =
  | { ok: true; status: RequestStatus }
  | { ok: false; message: string };

function statusOf(value: unknown): RequestStatus | null {
  return REQUEST_STATUSES.find((known) => known === value) ?? null;
}

/**
 * 받은 요청에 답한다.
 *
 * **여기서 판정하지 않는다.** 내가 받는 쪽인가, 아직 pending 인가, 잡아 둔 판본이 지금
 * 판본과 같은가 — 셋 다 RPC 안에 있다. 여기서 다시 물으면 답하는 자리가 둘이 되고,
 * 어긋났을 때 열려 있는 쪽은 언제나 더 바깥이다.
 */
export async function respondToRequest(requestId: string, accept: boolean): Promise<RespondResult> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('respond_to_match_request', {
    p_request_id: requestId,
    p_accept: accept,
  });

  if (error) return { ok: false, message: error.message };

  const status = statusOf(data);
  if (status === null) return { ok: false, message: '답을 남기지 못했습니다.' };

  revalidatePath('/me/requests');
  revalidatePath('/me/discovery');
  return { ok: true, status };
}

/**
 * 보낸 요청을 거둔다.
 *
 * 상대에게 알리지 않는다 — 그 판단도 RPC 안에 있다. 「보냈다 거뒀다」로 상대를 부를 수
 * 있게 되면 알림이 두드리는 도구가 된다.
 */
export async function cancelRequest(requestId: string): Promise<RespondResult> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('cancel_match_request', { p_request_id: requestId });
  if (error) return { ok: false, message: error.message };

  const status = statusOf(data);
  if (status === null) return { ok: false, message: '요청을 거두지 못했습니다.' };

  revalidatePath('/me/requests');
  revalidatePath('/me/discovery');
  return { ok: true, status };
}

/**
 * 차단한다 — **「다시 보지 않기」와 다른 일이다.**
 *
 * 살아 있던 요청까지 거두는 것은 RPC 가 한 트랜잭션에서 한다. 여기서 나눠 부르면
 * 「차단했는데 그 사람의 요청은 그대로 떠 있는」 상태가 실재하게 된다.
 */
export async function blockUser(userId: string): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('block_user', { p_user_id: userId });
  if (error) return { ok: false, message: error.message };

  revalidatePath('/me/requests');
  revalidatePath('/me/discovery');
  return { ok: true };
}

/**
 * 신고한다 — **차단과 나란히 있되 같은 일이 아니다.**
 *
 * 차단은 「내가 안 보겠다」이고 신고는 「운영자가 봐야 한다」이다. 한 문으로 합치면
 * 「보기 싫다」와 「규칙을 어겼다」가 같은 기록이 되어 제재의 근거가 되지 못한다.
 *
 * 사유가 고른 것 중 하나인지, 마주친 적 있는 사람인지는 **RPC 가 묻는다.** 여기서
 * 다시 물으면 판정하는 자리가 둘이 된다.
 */
export async function reportUser(
  userId: string,
  reason: string,
  detail: string,
): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('report_user', {
    p_user_id: userId,
    p_reason: reason,
    // 빈 칸은 「안 적었다」다. 빈 문자열로 넘기면 「없음」이 두 값이 된다.
    p_detail: detail.trim() || null,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath('/me/requests');
  return { ok: true };
}

/**
 * 계정 삭제를 요청한다.
 *
 * **지우지 않는다.** 폐쇄 MVP 에서 실제 삭제는 운영자가 처리하고, 이 문이 즉시 하는
 * 일은 상태를 옮겨 바깥으로 나가는 길을 다 막는 것이다(`request_account_deletion`).
 */
export async function requestAccountDeletion(): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('request_account_deletion');
  if (error) return { ok: false, message: error.message };

  // 상태 하나가 모든 화면의 답을 바꾼다 — 한 자리만 다시 그리면 나머지가 낡는다.
  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * 알림을 읽음으로 바꾼다.
 *
 * **시각은 DB 가 적는다.** 읽은 때는 사건이라 사용자가 적을 값이 아니다 — 참여를 켠
 * 시각을 사용자가 적지 않는 것과 같다.
 */
export async function markNotificationsRead(): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('mark_notifications_read');
  if (error) return { ok: false, message: error.message };

  revalidatePath('/me/requests');
  revalidatePath('/me');
  return { ok: true };
}
