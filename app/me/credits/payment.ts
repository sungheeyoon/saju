import { orderIdOf } from '../../api/portone/webhook/settle';
import { orderIsPaid, type OrderStatus } from '@/src/lib/reading/order-status';

/**
 * **결제창을 여는 값과 결제창에서 돌아온 값의 판단** (G-21, ADR 0171).
 *
 * 결제창은 PortOne 브라우저 SDK V2 가 띄운다. 그 SDK 가 드는 값 둘 — 상점 번호와 채널 키 — 은 비밀이 아니다(브라우저가
 * 결제창을 열 때 그대로 싣는다). 그래도 `NEXT_PUBLIC_` 으로 빌드에 박지 않고 서버가 읽어 **판매가 열린 사람의 화면에만** 넘긴다 —
 * 판매가 닫힌 동안 다른 계정의 화면에는 결제의 흔적이 안 선다. PG 의 이름은 여기 없다: 어느 PG 로 가는지는 채널 키가 정하고
 * PG 는 아직 안 정했다(G-21).
 */

export type PortoneCheckout = { readonly storeId: string; readonly channelKey: string };

/** 둘 다 있어야 결제 단추가 선다 — 하나라도 없으면 `null` */
export function portoneCheckoutOf(env: {
  PORTONE_STORE_ID: string | undefined;
  PORTONE_CHANNEL_KEY: string | undefined;
}): PortoneCheckout | null {
  const storeId = env.PORTONE_STORE_ID?.trim();
  const channelKey = env.PORTONE_CHANNEL_KEY?.trim();
  if (!storeId || !channelKey) return null;
  return { storeId, channelKey };
}

/**
 * 결제창에서 돌아온 주소의 뜻. 폰의 결제창은 페이지를 옮겨 `redirectUrl?paymentId=…` 로 돌아오고, 실패면 `code` · `message` 가
 * 붙는다. 데스크톱은 화면이 같은 주소로 옮겨 온다. **여기서 결제가 됐다고 정하지 않는다** — 돈이 들어왔는지는 서버가 PortOne 에서
 * 다시 받아 승인한 주문의 상태가 말한다(웹훅, `app/api/portone/webhook/`). 이 값은 어느 주문을 읽을지만 고른다.
 *
 * - `failed` — 결제창이 실패를 돌려줬다(취소 포함)
 * - `order` — 우리 주문 번호(`rdo_…`)다. 그 주문의 상태를 읽는다
 * - `unknown` — 결제 번호가 없거나 우리 주문이 아니다
 */
export type PaymentReturn =
  | { readonly kind: 'failed' }
  | { readonly kind: 'order'; readonly orderId: string }
  | { readonly kind: 'unknown' };

const one = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export function paymentReturnOf(params: Record<string, string | string[] | undefined>): PaymentReturn {
  if (one(params.code)) return { kind: 'failed' };
  const paymentId = one(params.paymentId);
  const orderId = paymentId ? orderIdOf(paymentId) : null;
  return orderId ? { kind: 'order', orderId } : { kind: 'unknown' };
}

/**
 * 결제 뒤 화면의 갈래 — 결제창의 답과 주문의 상태를 함께 본다. 결제창이 성공을 말해도 주문이 대기면 아직 `waiting` 이고,
 * 결제창이 실패를 말하면 주문을 읽지 않는다. 취소로 닫힌 주문은 실패다.
 */
export type PaymentOutcome = 'failed' | 'missing' | 'paid' | 'waiting';

export function paymentOutcomeOf(
  returned: PaymentReturn,
  order: { readonly status: OrderStatus | null } | null,
): PaymentOutcome {
  if (returned.kind === 'failed') return 'failed';
  if (order === null) return 'missing';
  if (orderIsPaid(order.status)) return 'paid';
  return order.status === 'pending' ? 'waiting' : 'failed';
}
