'use server';

import { rpcArgs } from '@/src/lib/db';

import { supabaseOnServer } from '../../auth/server-client';
import { userFacingDbMessage } from '../../db-error';
import { refresh } from '../../refresh';
import { noteDenial, noteWriteRefusal, type RefusedTarget, type WriteAction } from '../denial';
import { bookRefusalTarget } from './book-refusal';
import { isRefundReason } from './labels';
import type { PrepareRequest } from './refund-confirm';
import { cancellationCheck } from './portone-cancellations';
import { RELEASE_CANCELLED_NOTE, RELEASE_UNKNOWN_NOTE } from './release-check';

/**
 * 환불 세 걸음의 누름 — **확보 → (PortOne 콘솔에서 취소) → 확정**, 확정 전에는 준비 취소 (G-110 ②, ADR 0184).
 *
 * PG 취소는 부르지 않는다. 판정(운영자인가 · 안 쓴 회차인가 · 진행 중이 하나인가 · 같은 취소 번호인가)과 금액은 전부 DB 의
 * 문 안에 있고, 문마다 접속기록에 제 동작을 남긴다. 거절은 그 줄이 되감기므로 따로 적는다 — 운영자가 아니면(`42501`) `denied`,
 * 확보 · 확정 · 준비 취소의 그 밖의 거절은 `refused`(`noteWriteRefusal`, G-111 R-4). 읽기(진행 중인 환불)의 거절은 `denied` 만이다.
 * 어느 누름이든 주문 화면의 진행 상태가 바뀌므로 그 화면을 다시 그린다(`refund-moved`).
 */

type Answer<T = null> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

type Supabase = Awaited<ReturnType<typeof supabaseOnServer>>;

const refused = async (
  supabase: Supabase,
  error: { readonly message: string; readonly code?: string },
  action: WriteAction,
  where: string,
  target: RefusedTarget,
): Promise<{ readonly ok: false; readonly message: string }> => {
  await noteWriteRefusal(supabase, action, error.code, target);
  return { ok: false, message: userFacingDbMessage(error, where) };
};

/**
 * 확보 — 돌려줄 회차를 잠그고 금액을 정한다. 내는 값은 확인창에 보인 고정본이다(`preparePlan`): DB 가 금액을 다시 셈해 보인
 * 금액과 다르면 거절하고, 같은 요청 번호로 다시 오면(응답이 끊긴 재시도) 같은 확보를 돌려준다.
 */
export async function holdRefund(input: PrepareRequest): Promise<Answer<{ readonly amount: number }>> {
  const problem = !isRefundReason(input.reason)
    ? '환불 사유를 골라 주세요.'
    : !Number.isInteger(input.credits) || input.credits < 1
      ? '걷을 회차를 1장 이상 골라 주세요.'
      : null;
  const supabase = await supabaseOnServer();
  if (problem !== null) {
    await noteWriteRefusal(supabase, 'credits.refund_hold', '22023', { orderId: input.orderId });
    return { ok: false, message: problem };
  }

  const { data, error } = await supabase.rpc(
    'operator_hold_reading_refund',
    rpcArgs<'operator_hold_reading_refund'>({
      p_order_id: input.orderId,
      p_credits: input.credits,
      p_reason: input.reason,
      p_expected_amount: input.expectedAmount,
      p_request_id: input.requestId,
    }),
  );
  if (error) return refused(supabase, error, 'credits.refund_hold', 'operator_hold_reading_refund', { orderId: input.orderId });

  refresh('refund-moved');
  return { ok: true, value: { amount: data?.[0]?.amount ?? 0 } };
}

/**
 * 확정 — PortOne 콘솔에서 취소한 뒤 그 취소 번호로 확보를 장부에 적는다. 같은 번호로 다시 눌러도 한 번만 적힌다.
 * 주문 id 는 문에 가지 않는다 — 거절 줄에 실을 때만 쓰고, 그때도 그 주문의 진행 중인 확보인지 본 뒤다(`bookRefusalTarget`).
 */
export async function bookRefund(input: {
  readonly orderId: string;
  readonly holdId: string;
  readonly refundId: string;
}): Promise<Answer<{ readonly status: string }>> {
  const refundId = input.refundId.trim();
  const supabase = await supabaseOnServer();
  if (refundId === '') {
    await noteWriteRefusal(supabase, 'credits.refund_book', '22023', await bookRefusalTarget(supabase, '22023', input));
    return { ok: false, message: 'PG 취소 번호를 적어 주세요.' };
  }

  const { data, error } = await supabase.rpc(
    'operator_book_reading_refund',
    rpcArgs<'operator_book_reading_refund'>({ p_hold_id: input.holdId, p_provider_refund_id: refundId }),
  );
  if (error) {
    const target = await bookRefusalTarget(supabase, error.code, input);
    return refused(supabase, error, 'credits.refund_book', 'operator_book_reading_refund', target);
  }

  refresh('refund-moved');
  return { ok: true, value: { status: data } };
}

/**
 * 준비 취소 — 확정 전의 확보를 풀어 잠근 회차를 돌려놓는다. **풀기 전에 PortOne 에 그 결제의 취소 내역을 묻는다** —
 * 진행 중인 취소가 있거나, 성공한 취소액이 장부의 환불액과 다르거나, 조회가 실패 · 결과를 알 수 없으면(열쇠가 없는 환경
 * 포함) 막는다(ADR 0184). 장부의 환불액은 DB 가 낸다 — 화면이 대지 않는다.
 */
export async function releaseRefund(input: { readonly orderId: string; readonly holdId: string }): Promise<Answer> {
  const supabase = await supabaseOnServer();

  const held = await supabase.rpc(
    'operator_reading_refund_hold',
    rpcArgs<'operator_reading_refund_hold'>({ p_order_id: input.orderId }),
  );
  if (held.error) {
    // 운영자가 아니면 그 읽기의 `denied`, 그 밖의 실패(`22P02` · `57014` …)는 준비 취소가 거절된 것이다
    if (held.error.code === '42501') await noteDenial(supabase, 'credits.refund_status');
    else await noteWriteRefusal(supabase, 'credits.refund_release', held.error.code, { orderId: input.orderId });
    return { ok: false, message: userFacingDbMessage(held.error, 'operator_reading_refund_hold') };
  }
  const hold = (held.data ?? []).find((row) => row.hold_id === input.holdId);
  if (!hold) {
    await noteWriteRefusal(supabase, 'credits.refund_release', 'P0002', { orderId: input.orderId });
    return { ok: false, message: '진행 중인 환불을 찾지 못했습니다. 화면을 새로 열어 주세요.' };
  }

  // 생성 타입은 `returns table` 칸을 늘 있다고 적는다 — 보관된 결제마저 없으면 비고, 그때는 견줄 장부가 없어 막는다
  const booked: number | null = hold.booked_refund ?? null;
  const check =
    booked === null
      ? ({ kind: 'unknown', why: 'no ledger refund to compare' } as const)
      : await cancellationCheck(hold.provider_order_id, booked);
  // PortOne 확인이 막은 준비 취소도 거절된 쓰기다 — 취소가 있으면 상태 거절(`55000`), 알 수 없으면 `other`
  if (check.kind === 'cancelled') {
    await noteWriteRefusal(supabase, 'credits.refund_release', '55000', { orderId: input.orderId });
    return { ok: false, message: RELEASE_CANCELLED_NOTE };
  }
  if (check.kind === 'unknown') {
    console.error('refund release blocked', check.why);
    await noteWriteRefusal(supabase, 'credits.refund_release', 'other', { orderId: input.orderId });
    return { ok: false, message: RELEASE_UNKNOWN_NOTE };
  }

  const { error } = await supabase.rpc(
    'operator_release_reading_refund',
    rpcArgs<'operator_release_reading_refund'>({ p_hold_id: input.holdId }),
  );
  if (error) return refused(supabase, error, 'credits.refund_release', 'operator_release_reading_refund', { orderId: input.orderId });

  refresh('refund-moved');
  return { ok: true, value: null };
}
