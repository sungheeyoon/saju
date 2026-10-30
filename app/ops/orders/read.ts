import { rpcArgs } from '@/src/lib/db';
import { NO_ORDER, orderLineOf, refundHoldOf, type RefundBasis } from '@/src/lib/ops/orders';

import { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';
import { deniedAmong, type Denied } from '../denial';

/**
 * 주문 하나와 그 계정의 주문 전부, 그리고 진행 중인 환불이 **환불 셈의 입력으로 내려오는 문** (G-110 ②, ADR 0184).
 *
 * `operator_reading_refund_basis` 를 부른다 — 읽기 전에 풀린 예약을 정리하고, 읽을 때마다 접속기록에 `credits.refund_basis`
 * 한 줄(주문 id 만)을 남긴다(ADR 0106). 신고 화면의 문(`../reports/read.ts`)과 같은 규율이다: 운영자인지 여기서 안 묻고
 * 자료를 청해 **거절당하는 것으로 안다**(`42501`), 거절은 `deniedAmong` 이 따로 적는다.
 *
 * 이메일 · 닉네임은 문이 안 내준다 — 주문은 번호로만 가리킨다(런북 「수동 환불」).
 *
 * 생성 타입은 반환 칸을 전부 `null` 이 아닌 것으로 적는다(`returns table` 의 한계). 승인 · 묶음 칸은 결제 전 주문에서 비므로
 * 여기서 한 번 `null` 로 받아 옮긴다.
 */

export { DENIED } from '../denial';
export {
  NO_ORDER,
  orderLineOf,
  refundForAllUnused,
  refundHoldOf,
  type OrderLine,
  type RefundBasis,
  type RefundHold,
} from '@/src/lib/ops/orders';

/**
 * 주문 id 하나로 청한다. 화면의 본체라 못 읽으면 값으로 낸다 — 운영자 화면이 제 문장을 세운다. 주문도 진행 중인 확보도
 * 없으면 `null`. 산 사람이 떠나 주문이 지워졌어도 진행 중인 확보가 있으면 그것만 선다(ADR 0184).
 */
export async function refundBasis(
  orderId: string,
): Promise<Denied | SkippableRead<RefundBasis | null>> {
  const supabase = await supabaseOnServer();
  const answer = await supabase.rpc(
    'operator_reading_refund_basis',
    rpcArgs<'operator_reading_refund_basis'>({ p_order_id: orderId }),
  );

  const denied = await deniedAmong(supabase, 'credits.refund_basis', [answer]);
  if (denied) return denied;
  if (answer.error) return unread(answer.error, 'operator_reading_refund_basis');

  const rows = answer.data ?? [];
  const asked = rows.find((row) => row.asked);
  if (orderId === NO_ORDER) return read(null);

  // 진행 중인 환불 — 화면을 닫았다 다시 와도 이어서 확정한다. 접속기록에 `credits.refund_status` 한 줄
  const held = await supabase.rpc(
    'operator_reading_refund_hold',
    rpcArgs<'operator_reading_refund_hold'>({ p_order_id: orderId }),
  );
  const deniedHold = await deniedAmong(supabase, 'credits.refund_status', [held]);
  if (deniedHold) return deniedHold;
  if (held.error) return unread(held.error, 'operator_reading_refund_hold');
  const hold = held.data?.[0];
  if (!asked && hold === undefined) return read(null);

  return read({
    asked: asked ? orderLineOf(asked) : null,
    others: rows.filter((row) => !row.asked).map(orderLineOf),
    hold: hold === undefined ? null : refundHoldOf(hold),
  });
}
