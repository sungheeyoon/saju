'use server';

import { rpcArgs } from '@/src/lib/db';

import { supabaseOnServer } from '../../auth/server-client';
import { userFacingDbMessage } from '../../db-error';
import { refresh } from '../../refresh';
import { noteDenial, type DeniedAction } from '../denial';
import { isRefundReason } from './labels';
import { cancellationCheck } from './portone-cancellations';
import { RELEASE_CANCELLED_NOTE, RELEASE_UNKNOWN_NOTE } from './release-check';

/**
 * 환불 세 걸음의 누름 — **확보 → (PortOne 콘솔에서 취소) → 확정**, 확정 전에는 준비 취소 (G-110 ②, ADR 0184).
 *
 * PG 취소는 부르지 않는다. 판정(운영자인가 · 안 쓴 회차인가 · 진행 중이 하나인가 · 같은 취소 번호인가)과 금액은 전부 DB 의
 * 문 안에 있고, 문마다 접속기록에 제 동작을 남긴다. 거절(`42501`)은 그 줄이 되감기므로 `noteDenial` 이 따로 적는다.
 * 어느 누름이든 주문 화면의 진행 상태가 바뀌므로 그 화면을 다시 그린다(`refund-moved`).
 */

type Answer<T = null> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

type Supabase = Awaited<ReturnType<typeof supabaseOnServer>>;

const refused = async (
  supabase: Supabase,
  error: { readonly message: string; readonly code?: string },
  action: DeniedAction,
  where: string,
): Promise<{ readonly ok: false; readonly message: string }> => {
  if (error.code === '42501') await noteDenial(supabase, action);
  return { ok: false, message: userFacingDbMessage(error, where) };
};

/** 확보 — 돌려줄 회차를 잠그고 금액을 정한다. 금액은 DB 가 셈한다 */
export async function holdRefund(input: {
  readonly orderId: string;
  readonly credits: number;
  readonly reason: string;
}): Promise<Answer<{ readonly amount: number }>> {
  if (!isRefundReason(input.reason)) return { ok: false, message: '환불 사유를 골라 주세요.' };
  if (!Number.isInteger(input.credits) || input.credits < 1) {
    return { ok: false, message: '걷을 회차를 1장 이상 골라 주세요.' };
  }

  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc(
    'operator_hold_reading_refund',
    rpcArgs<'operator_hold_reading_refund'>({
      p_order_id: input.orderId,
      p_credits: input.credits,
      p_reason: input.reason,
    }),
  );
  if (error) return refused(supabase, error, 'credits.refund_hold', 'operator_hold_reading_refund');

  refresh('refund-moved');
  return { ok: true, value: { amount: data?.[0]?.amount ?? 0 } };
}

/** 확정 — PortOne 콘솔에서 취소한 뒤 그 취소 번호로 확보를 장부에 적는다. 같은 번호로 다시 눌러도 한 번만 적힌다 */
export async function bookRefund(input: {
  readonly holdId: string;
  readonly refundId: string;
}): Promise<Answer<{ readonly status: string }>> {
  const refundId = input.refundId.trim();
  if (refundId === '') return { ok: false, message: 'PG 취소 번호를 적어 주세요.' };

  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc(
    'operator_book_reading_refund',
    rpcArgs<'operator_book_reading_refund'>({ p_hold_id: input.holdId, p_provider_refund_id: refundId }),
  );
  if (error) return refused(supabase, error, 'credits.refund_book', 'operator_book_reading_refund');

  refresh('refund-moved');
  return { ok: true, value: { status: data } };
}

/**
 * 준비 취소 — 확정 전의 확보를 풀어 잠근 회차를 돌려놓는다. **풀기 전에 PortOne 에 그 결제의 취소 내역을 묻는다** —
 * 확보 뒤의 취소가 성공 · 요청 중이거나, 조회가 실패하거나 결과를 알 수 없으면(열쇠가 없는 환경 포함) 막는다(ADR 0184).
 */
export async function releaseRefund(input: { readonly orderId: string; readonly holdId: string }): Promise<Answer> {
  const supabase = await supabaseOnServer();

  const held = await supabase.rpc(
    'operator_reading_refund_hold',
    rpcArgs<'operator_reading_refund_hold'>({ p_order_id: input.orderId }),
  );
  if (held.error) return refused(supabase, held.error, 'credits.refund_status', 'operator_reading_refund_hold');
  const hold = (held.data ?? []).find((row) => row.hold_id === input.holdId);
  if (!hold) return { ok: false, message: '진행 중인 환불을 찾지 못했습니다. 화면을 새로 열어 주세요.' };

  const check = await cancellationCheck(hold.provider_order_id, new Date(hold.held_at));
  if (check.kind === 'cancelled') return { ok: false, message: RELEASE_CANCELLED_NOTE };
  if (check.kind === 'unknown') {
    console.error('refund release blocked', check.why);
    return { ok: false, message: RELEASE_UNKNOWN_NOTE };
  }

  const { error } = await supabase.rpc(
    'operator_release_reading_refund',
    rpcArgs<'operator_release_reading_refund'>({ p_hold_id: input.holdId }),
  );
  if (error) return refused(supabase, error, 'credits.refund_release', 'operator_release_reading_refund');

  refresh('refund-moved');
  return { ok: true, value: null };
}
