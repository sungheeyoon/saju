'use server';

import { rpcArgs } from '@/src/lib/db';

import { supabaseOnServer } from '../../auth/server-client';
import { userFacingDbMessage } from '../../db-error';
import { refresh } from '../../refresh';
import { noteDenial } from '../denial';
import { isRefundReason } from './labels';

export type RefundInput = {
  readonly orderId: string;
  /** 걷을 회차 */
  readonly credits: number;
  /** 화면이 셈해 운영자에게 보인 금액 — DB 가 다시 셈해 같을 때만 적는다 */
  readonly amount: number;
  readonly reason: string;
  /** PortOne 콘솔에서 취소한 뒤 받은 번호 */
  readonly refundId: string;
};

export type RefundAnswer = { readonly ok: true; readonly status: string } | { readonly ok: false; readonly message: string };

/**
 * 환불을 장부에 적는다 — 운영자가 PortOne 콘솔에서 **먼저 돌려준 뒤에** (G-110 ②, ADR 0184).
 *
 * PG 취소는 부르지 않는다. 판정(운영자인가 · 안 쓴 회차인가 · 금액이 산식과 같은가 · 같은 취소 번호인가)은 전부
 * `operator_refund_reading_order` 안에 있고 그 문이 접속기록에 `credits.refund` 를 남긴다. 거절(`42501`)은 그 줄이 되감기므로
 * `noteDenial` 이 따로 적는다.
 */
export async function bookRefund(input: RefundInput): Promise<RefundAnswer> {
  const refundId = input.refundId.trim();
  if (refundId === '') return { ok: false, message: 'PG 취소 번호를 적어 주세요.' };
  if (!isRefundReason(input.reason)) return { ok: false, message: '환불 사유를 골라 주세요.' };
  if (!Number.isInteger(input.credits) || input.credits < 1) {
    return { ok: false, message: '걷을 회차를 1장 이상 적어 주세요.' };
  }

  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc(
    'operator_refund_reading_order',
    rpcArgs<'operator_refund_reading_order'>({
      p_order_id: input.orderId,
      p_credits: input.credits,
      p_amount: input.amount,
      p_reason: input.reason,
      p_provider_refund_id: refundId,
    }),
  );

  if (error) {
    if (error.code === '42501') await noteDenial(supabase, 'credits.refund');
    return { ok: false, message: userFacingDbMessage(error, 'operator_refund_reading_order') };
  }

  refresh('refund-booked');
  return { ok: true, status: data };
}
