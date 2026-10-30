import { userFacingDbMessage } from '@db-error';
import { isDenialCode } from '@ops/denial';
import { GRANT_MAX, NOTE_MAX as GRANT_NOTE_MAX, isGrantReason, type GrantRequest } from '@ops/credit-grant';
import { isRefundReason } from '@ops/order-labels';
import type { PrepareRequest } from '@ops/refund-confirm';
import { NOTE_MAX, WARNING_CATEGORIES, isOutcome, sanctions, type ReviewRequest } from '@ops/report-review';
import { NOTE_MAX as STATUS_NOTE_MAX, isStatusReason, type StatusRequest } from '@ops/suspension';

import { UUID } from '@uuid';

import { supabase } from '@/auth/client';

import { deniedAmong, noteWriteRefusal, writeWithoutSecondFactor, type RefusedTarget, type WriteAction } from './denial';

/**
 * 운영자의 쓰기 — 웹의 `app/ops/*\/actions.ts` 와 같은 문 · 같은 차례다. 판정은 전부 DB 의 문 안에 있고, 여기서 먼저 거르는 것은 부를
 * 것도 없는 모양뿐이다. 내는 값은 확인창에 보인 고정본이다.
 *
 * **준비 취소(`operator_release_reading_refund`)는 부르지 않는다.** 웹은 풀기 전에 서버 열쇠로 PortOne 의 취소 내역을 장부와 견주고
 * (`app/ops/orders/portone-cancellations.ts`), 그 확인 없이 풀면 돈은 나갔는데 회차가 돌아올 수 있다. 앱에서 그 확인을 못 하니 그 동작은
 * 앱에 없다.
 */
export const ACTION_UNREACHED_NOTE = '처리하지 못했어요. 다시 시도해 주세요.';

export type Written<T = { readonly replayed: boolean }> =
  | ({ readonly ok: true } & T)
  | { readonly ok: false; readonly message: string; readonly unreached?: boolean };

/** 응답이 끊겼으면(문이 답하지 않았다) 고정본을 지켜 같은 요청 번호로 다시 낸다 — 웹의 `afterFailure` 와 같은 갈래다 */
type DoorError = { readonly message: string; readonly code?: string };
type DoorAnswer = { readonly status: number };

const refused = async (error: DoorError, answer: DoorAnswer, action: WriteAction, where: string, target: RefusedTarget): Promise<Written<never>> => {
  await noteWriteRefusal(action, error.code, target);
  if (answer.status === 0) {
    console.error(where, error.message);
    return { ok: false, message: ACTION_UNREACHED_NOTE, unreached: true };
  }
  return { ok: false, message: userFacingDbMessage(error, where) };
};

const NOT_READY: Written<never> = { ok: false, message: ACTION_UNREACHED_NOTE, unreached: true };

/** 요청 번호 — 같은 요청을 다시 낼 때 DB 가 알아보는 표지일 뿐, 비밀이 아니다. Hermes 에 `crypto.randomUUID` 가 없을 수 있다 */
export function newRequestId(): string {
  const made = globalThis.crypto?.randomUUID?.();
  if (made !== undefined) return made;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (slot) => {
    const digit = Math.floor(Math.random() * 16);
    return (slot === 'x' ? digit : (digit % 4) + 8).toString(16);
  });
}

export async function holdRefund(input: PrepareRequest): Promise<Written<{ readonly amount: number }>> {
  const problem = !isRefundReason(input.reason)
    ? '환불 사유를 골라 주세요.'
    : !Number.isInteger(input.credits) || input.credits < 1
      ? '걷을 회차를 1장 이상 골라 주세요.'
      : null;
  const target = { orderId: input.orderId };
  const unpassed = await writeWithoutSecondFactor('credits.refund_hold', target);
  if (unpassed !== null) return unpassed;
  if (problem !== null) {
    await noteWriteRefusal('credits.refund_hold', '22023', target);
    return { ok: false, message: problem };
  }
  if (supabase === null) return NOT_READY;
  const answer = await supabase.rpc('operator_hold_reading_refund', {
    p_order_id: input.orderId,
    p_credits: input.credits,
    p_reason: input.reason,
    p_expected_amount: input.expectedAmount,
    p_request_id: input.requestId,
  });
  if (answer.error) return refused(answer.error, answer, 'credits.refund_hold', 'operator_hold_reading_refund', target);
  return { ok: true, amount: answer.data?.[0]?.amount ?? 0 };
}

/** 확정의 거절 줄이 가리킬 주문 — 그 주문의 진행 중인 확보가 이 확보일 때만 싣는다(웹 `book-refusal.ts` 와 같다, ADR 0191) */
async function bookRefusalTarget(code: string | undefined, input: { readonly orderId: string; readonly holdId: string }): Promise<RefusedTarget> {
  if (isDenialCode(code) || supabase === null) return {};
  const held = await supabase.rpc('operator_reading_refund_hold', { p_order_id: input.orderId });
  if (await deniedAmong('credits.refund_status', [held])) return {};
  if (held.error) {
    console.error('book refusal target', held.error);
    return {};
  }
  return (held.data ?? []).some((row) => row.hold_id === input.holdId) ? { orderId: input.orderId } : {};
}

export async function bookRefund(input: { readonly orderId: string; readonly holdId: string; readonly refundId: string }): Promise<Written<{ readonly status: string }>> {
  const refundId = input.refundId.trim();
  const unpassed = await writeWithoutSecondFactor('credits.refund_book', { orderId: input.orderId });
  if (unpassed !== null) return unpassed;
  if (refundId === '') {
    await noteWriteRefusal('credits.refund_book', '22023', await bookRefusalTarget('22023', input));
    return { ok: false, message: 'PG 취소 번호를 적어 주세요.' };
  }
  if (supabase === null) return NOT_READY;
  const answer = await supabase.rpc('operator_book_reading_refund', { p_hold_id: input.holdId, p_provider_refund_id: refundId });
  if (answer.error) {
    const target = await bookRefusalTarget(answer.error.code, input);
    return refused(answer.error, answer, 'credits.refund_book', 'operator_book_reading_refund', target);
  }
  return { ok: true, status: answer.data };
}

const grantProblem = (input: GrantRequest): string | null => {
  if (!isGrantReason(input.kind, input.reason)) return '사유를 골라 주세요.';
  if (!Number.isInteger(input.credits) || input.credits < 1) return '수량을 1장 이상 골라 주세요.';
  if (input.kind === 'grant' && input.credits > GRANT_MAX) return `한 번에 1장에서 ${GRANT_MAX}장까지 지급합니다.`;
  const note = input.note.trim();
  if (note.length === 0 || note.length > GRANT_NOTE_MAX) return `메모를 ${GRANT_NOTE_MAX}자 안으로 적어 주세요.`;
  return null;
};

export async function bookCreditGrant(input: GrantRequest): Promise<Written> {
  const action = input.kind === 'grant' ? 'credits.grant' : 'credits.revoke';
  const problem = grantProblem(input);
  const unpassed = await writeWithoutSecondFactor(action, { userId: input.userId });
  if (unpassed !== null) return unpassed;
  if (problem !== null) {
    await noteWriteRefusal(action, '22023', { userId: input.userId });
    return { ok: false, message: problem };
  }
  if (supabase === null) return NOT_READY;
  const answer =
    input.kind === 'grant'
      ? await supabase.rpc('operator_grant_reading_credits', {
          p_user_id: input.userId,
          p_credits: input.credits,
          p_reason: input.reason,
          p_note: input.note,
          p_report_id: input.reportId as string,
          p_seen_version: input.seenVersion,
          p_request_id: input.requestId,
        })
      : await supabase.rpc('operator_revoke_reading_credits', {
          p_user_id: input.userId,
          p_credits: input.credits,
          p_reason: input.reason,
          p_note: input.note,
          p_seen_version: input.seenVersion,
          p_request_id: input.requestId,
        });
  const where = input.kind === 'grant' ? 'operator_grant_reading_credits' : 'operator_revoke_reading_credits';
  if (answer.error) return refused(answer.error, answer, action, where, { userId: input.userId, reportId: input.reportId ?? undefined });
  return { ok: true, replayed: answer.data?.[0]?.replayed === true };
}

const statusProblem = (input: StatusRequest): string | null => {
  if (input.kind !== 'suspend' && input.kind !== 'unsuspend') return '화면을 새로 열어 주세요.';
  if (!isStatusReason(input.kind, input.reason)) return '사유를 골라 주세요.';
  const note = input.note.trim();
  if (note.length === 0 || note.length > STATUS_NOTE_MAX) return `메모를 ${STATUS_NOTE_MAX}자 안으로 적어 주세요.`;
  if (!Number.isInteger(input.seenVersion) || input.seenVersion < 0) return '읽은 버전이 없습니다. 화면을 새로 열어 주세요.';
  if (!UUID.test(input.userId) || !UUID.test(input.requestId)) return '화면을 새로 열어 주세요.';
  return null;
};

export async function changeMemberStatus(input: StatusRequest): Promise<Written> {
  const action = input.kind === 'unsuspend' ? 'members.unsuspend' : 'members.suspend';
  const problem = statusProblem(input);
  const unpassed = await writeWithoutSecondFactor(action, { userId: input.userId });
  if (unpassed !== null) return unpassed;
  if (problem !== null) {
    await noteWriteRefusal(action, '22023', { userId: input.userId });
    return { ok: false, message: problem };
  }
  if (supabase === null) return NOT_READY;
  const door = input.kind === 'suspend' ? 'operator_suspend_member' : 'operator_unsuspend_member';
  const answer = await supabase.rpc(door, {
    p_user_id: input.userId,
    p_reason: input.reason,
    p_note: input.note.trim(),
    p_seen_version: input.seenVersion,
    p_request_id: input.requestId,
  });
  if (answer.error) return refused(answer.error, answer, action, door, { userId: input.userId });
  return { ok: true, replayed: answer.data?.[0]?.replayed === true };
}

const reviewProblem = (input: ReviewRequest): string | null => {
  if (!isOutcome(input.outcome)) return '처분을 골라 주세요.';
  const note = input.note.trim();
  if (note.length === 0) return '판단 근거를 적어 주세요.';
  if (note.length > NOTE_MAX) return `판단 근거를 ${NOTE_MAX}자 안으로 적어 주세요.`;
  if (sanctions(input.outcome) !== (input.sanctionedUserId !== null)) return '제재 대상을 골라 주세요.';
  if (input.warningCategory !== null && (input.outcome !== 'warning' || !WARNING_CATEGORIES.some((reason) => reason.value === input.warningCategory))) {
    return '경고 갈래를 골라 주세요.';
  }
  if (!Number.isInteger(input.seenVersion) || input.seenVersion < 0) return '읽은 버전이 없습니다. 화면을 새로 열어 주세요.';
  if (!UUID.test(input.reportId) || !UUID.test(input.requestId)) return '화면을 새로 열어 주세요.';
  return null;
};

export async function writeReview(input: ReviewRequest): Promise<Written> {
  const problem = reviewProblem(input);
  const target = { reportId: input.reportId };
  const unpassed = await writeWithoutSecondFactor('reports.review', target);
  if (unpassed !== null) return unpassed;
  if (problem !== null) {
    await noteWriteRefusal('reports.review', '22023', target);
    return { ok: false, message: problem };
  }
  if (supabase === null) return NOT_READY;
  const answer = await supabase.rpc('operator_review_report', {
    p_report_id: input.reportId,
    p_outcome: input.outcome,
    p_note: input.note.trim(),
    p_sanctioned_user_id: input.sanctionedUserId as string,
    p_warning_category: input.warningCategory as string,
    p_seen_version: input.seenVersion,
    p_request_id: input.requestId,
  });
  if (answer.error) return refused(answer.error, answer, 'reports.review', 'operator_review_report', target);
  return { ok: true, replayed: answer.data?.[0]?.replayed === true };
}
