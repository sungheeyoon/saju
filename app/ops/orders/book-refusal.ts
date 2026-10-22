import { rpcArgs } from '@/src/lib/db';

import type { supabaseOnServer } from '../../auth/server-client';
import { deniedAmong, isDenialCode, type RefusedTarget } from '../denial';

/**
 * **확정의 거절 줄이 가리킬 주문** (G-111 R-4, ADR 0191).
 *
 * 확정 문(`operator_book_reading_refund`)은 확보 id 만 받는다. 거절 줄에 주문 id 를 실으려면 화면이 든 주문 id 를 그대로 믿지 않고,
 * 이미 있는 운영자 읽기 `operator_reading_refund_hold(주문)` 로 그 주문의 진행 중인 확보가 이 확보인지 본 뒤에만 싣는다. 그 읽기는
 * 제 줄 `credits.refund_status`(`order=<id>`)를 남긴다 — 운영자가 실제로 읽은 것이다.
 *
 * 싣지 못하는 때 — 확보가 이미 닫혔거나(확정 · 준비 취소된 뒤의 거절) 주문이 맞지 않거나 읽기가 실패하면 주문 칸은 빈다.
 * 확정 문이 `42501` 을 냈으면 읽지 않는다(그 줄은 `denied` 이고 대상 칸이 없다). 취소 번호가 비어 확정 문을 부르기 전이면 누가
 * 불렀는지 아직 모른다 — 그때 읽기가 `42501` 이면 그 읽기도 거절된 것이라 제 줄 `credits.refund_status` 를 `denied` 로 남긴다
 * (준비 취소의 읽기와 같다).
 */
export async function bookRefusalTarget(
  supabase: Awaited<ReturnType<typeof supabaseOnServer>>,
  code: string | undefined,
  input: { readonly orderId: string; readonly holdId: string },
): Promise<RefusedTarget> {
  if (isDenialCode(code)) return {};
  const held = await supabase.rpc(
    'operator_reading_refund_hold',
    rpcArgs<'operator_reading_refund_hold'>({ p_order_id: input.orderId }),
  );
  if (await deniedAmong(supabase, 'credits.refund_status', [held])) return {};
  if (held.error) {
    // 싣지 못한 것은 서버 기록에만 — 거절의 답과 거절 줄은 그대로 간다
    console.error('book refusal target', held.error);
    return {};
  }
  return (held.data ?? []).some((row) => row.hold_id === input.holdId) ? { orderId: input.orderId } : {};
}
