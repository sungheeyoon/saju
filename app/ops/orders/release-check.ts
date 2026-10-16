/**
 * **준비 취소를 해도 되는가 — PortOne 결제의 취소 상태 · 금액을 장부와 견준다** (G-110 ②, ADR 0184).
 *
 * 확보를 푼 뒤에 콘솔 취소가 있었으면 돈은 나갔는데 회차가 돌아온다. 시각으로는 가르지 않는다 — 확보 전에 요청한 취소가 확보
 * 뒤에 성공할 수도 있고, 확보 전에 콘솔에서 취소하고 장부에 안 적은 것도 같은 위험이다. 그래서 규칙은 상태와 금액이다.
 *
 * 1. `SUCCEEDED` · `FAILED` 밖의 상태(`REQUESTED` 등)인 취소가 하나라도 있으면 막는다 — 돈이 나가는 중이다.
 * 2. `SUCCEEDED` 취소액의 합이 **장부에 적힌 그 주문의 환불액**과 정확히 같을 때만 풀어도 된다. PortOne 의 `amount.cancelled`
 *    도 읽히면 그 합과 같아야 한다.
 * 3. 합이 장부보다 크면 장부에 안 적힌 취소가 있다 — 막고 확정을 권한다. 작거나 읽을 수 없으면 알 수 없다 — 막는다(fail closed).
 *
 * PortOne V2 의 결제 단건은 취소가 있으면 `cancellations` 목록을 든다(취소마다 `status` · `totalAmount`). 결제 완료(`PAID`)이고
 * 그 목록이 없으면 취소가 없는 것이다.
 */

/** PortOne 에서 장부에 없는 취소가 보였다 — 풀면 돈은 나갔는데 회차가 돌아온다 */
export const RELEASE_CANCELLED_NOTE = 'PortOne 에 이 결제의 취소가 있습니다. 준비 취소하지 말고 취소 번호로 장부에 확정해 주세요.';

/** 취소 내역을 확인하지 못했다 — 막는다(fail closed) */
export const RELEASE_UNKNOWN_NOTE =
  'PortOne 에서 취소 내역을 확인하지 못해 준비 취소를 막았습니다. 콘솔을 확인한 뒤 런북의 「준비 취소를 손으로」를 따라 주세요.';

export type ReleaseCheck =
  /** 진행 중인 취소가 없고 성공한 취소액이 장부와 같다 — 풀어도 된다 */
  | { readonly kind: 'clear' }
  /** 진행 중인 취소가 있거나 장부에 없는 취소액이 있다 — 풀지 말고 확정한다 */
  | { readonly kind: 'cancelled' }
  /** 알 수 없다 — 막는다. `why` 는 기록에만 */
  | { readonly kind: 'unknown'; readonly why: string };

const unknown = (why: string): ReleaseCheck => ({ kind: 'unknown', why });

const won = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);

/**
 * @param body 결제 단건 조회의 본문 — 결제가 없으면(404) `null`
 * @param bookedRefund 장부에 적힌 그 주문의 환불액(원) — 지금 확보는 아직 안 적혔으므로 들지 않는다
 */
export function releaseCheckOf(body: unknown, bookedRefund: number): ReleaseCheck {
  if (body === null || typeof body !== 'object') return unknown('no payment');
  const payment = body as Record<string, unknown>;

  let cancellations = payment.cancellations;
  if (cancellations === undefined) {
    if (payment.status !== 'PAID') return unknown(`no cancellation list on ${String(payment.status)}`);
    cancellations = [];
  }
  if (!Array.isArray(cancellations)) return unknown('cancellations is not a list');

  let succeeded = 0;
  for (const one of cancellations) {
    if (one === null || typeof one !== 'object') return unknown('cancellation is not an object');
    const cancellation = one as Record<string, unknown>;
    if (typeof cancellation.status !== 'string') return unknown('cancellation has no status');
    if (cancellation.status === 'FAILED') continue;
    if (cancellation.status !== 'SUCCEEDED') return { kind: 'cancelled' };
    const amount = won(cancellation.totalAmount);
    if (amount === null) return unknown('succeeded cancellation has no amount');
    succeeded += amount;
  }

  const amounts = payment.amount;
  if (amounts !== undefined && amounts !== null && typeof amounts === 'object') {
    const reported = (amounts as Record<string, unknown>).cancelled;
    if (reported !== undefined) {
      const cancelled = won(reported);
      if (cancelled === null || cancelled !== succeeded) return unknown('amount.cancelled differs from the cancellations');
    }
  }

  if (succeeded === bookedRefund) return { kind: 'clear' };
  if (succeeded > bookedRefund) return { kind: 'cancelled' };
  return unknown('PortOne cancelled less than the ledger refunded');
}
