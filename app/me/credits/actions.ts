'use server';

import { readingBundleOf, bundleOrderName } from '@/src/lib/reading/bundle';
import { rpcArgs } from '@/src/lib/db';

import { supabaseOnServer } from '../../auth/server-client';
import { userFacingDbMessage } from '../../db-error';

/** 결제창에 싣는 값 — 금액은 DB 의 가격표에서 왔다. 화면은 금액을 대지 않는다 */
export type OpenedOrder = {
  readonly ok: true;
  /** 가맹점 주문 번호(`rdo_…`) — 결제창의 `paymentId` 이고, 웹훅이 이것으로 주문을 되짚는다 */
  readonly paymentId: string;
  readonly amount: number;
  readonly orderName: string;
};

type OpenAnswer = OpenedOrder | { readonly ok: false; readonly message: string };

/** 판매가 닫힌 사람(심사 계정이 아닌 사람)의 거절 — DB 는 영어로 거절하므로 이 문장으로 옮긴다 */
const SALE_CLOSED = '지금은 결제할 수 없어요.';

/**
 * 풀이권 주문을 연다 — 「결제하기」를 누르면 결제창보다 먼저 (G-21, ADR 0106 · 0171).
 *
 * **판정은 DB 가 한다.** 판매가 이 사람에게 열렸는지(심사 계정인지) · 활성 계정인지 · 파는 묶음인지 · 같은 열쇠의 주문인지는
 * `open_reading_order` 안에 있다. 같은 열쇠로 다시 누르면 같은 주문이 돌아와 결제창이 같은 결제 번호로 다시 뜬다 — PortOne 은
 * 한 결제 번호에 성공을 하나만 받는다.
 */
export async function openReadingOrder(credits: number, idempotencyKey: string): Promise<OpenAnswer> {
  if (readingBundleOf(credits) === null) return { ok: false, message: '고를 수 없는 풀이권이에요.' };

  const supabase = await supabaseOnServer();
  const { data, error } = await supabase
    .rpc(
      'open_reading_order',
      rpcArgs<'open_reading_order'>({
        p_bundle_credits: credits,
        p_provider: 'portone',
        p_idempotency_key: idempotencyKey,
      }),
    )
    .single();

  if (error) {
    const fallback = error.code === '55000' ? SALE_CLOSED : undefined;
    return { ok: false, message: userFacingDbMessage(error, 'open_reading_order', fallback) };
  }

  return { ok: true, paymentId: data.provider_order_id, amount: data.amount, orderName: bundleOrderName(credits) };
}
