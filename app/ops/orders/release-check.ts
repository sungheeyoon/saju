/**
 * **준비 취소를 해도 되는가 — PortOne 결제의 취소 내역으로 가른다** (G-110 ②, ADR 0184).
 *
 * 확보를 푼 뒤에 콘솔 취소가 있었으면 돈은 나갔는데 회차가 돌아온다. 그래서 확보 시각 뒤에 들어온 취소가 하나라도
 * `SUCCEEDED` · `REQUESTED`(또는 모르는 상태)면 막는다. 조회 결과를 읽을 수 없으면 — 결제가 없음 · 모양이 다름 · 시각을 못
 * 읽음 — 역시 막는다(fail closed). 실패한 취소(`FAILED`)와 확보 전의 취소만 지나간다.
 *
 * PortOne V2 의 결제 단건은 취소가 있으면 `cancellations` 목록을 든다(취소마다 `status` · `requestedAt` · `cancelledAt`). 결제
 * 완료(`PAID`)이고 그 목록이 없으면 취소가 없는 것이다.
 */

/** PortOne 에서 확보 뒤의 취소가 보였다 — 풀면 돈은 나갔는데 회차가 돌아온다 */
export const RELEASE_CANCELLED_NOTE = 'PortOne 에 이 결제의 취소가 있습니다. 준비 취소하지 말고 취소 번호로 장부에 확정해 주세요.';

/** 취소 내역을 확인하지 못했다 — 막는다(fail closed) */
export const RELEASE_UNKNOWN_NOTE =
  'PortOne 에서 취소 내역을 확인하지 못해 준비 취소를 막았습니다. 콘솔을 확인한 뒤 런북의 「준비 취소를 손으로」를 따라 주세요.';

export type ReleaseCheck =
  /** 확보 뒤의 취소가 없다 — 풀어도 된다 */
  | { readonly kind: 'clear' }
  /** 확보 뒤에 취소가 들어왔다 — 풀지 말고 확정한다 */
  | { readonly kind: 'cancelled' }
  /** 알 수 없다 — 막는다. `why` 는 기록에만 */
  | { readonly kind: 'unknown'; readonly why: string };

const unknown = (why: string): ReleaseCheck => ({ kind: 'unknown', why });

const timeOf = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : at;
};

/**
 * @param body 결제 단건 조회의 본문 — 결제가 없으면(404) `null`
 * @param heldAt 확보한 시각
 */
export function releaseCheckOf(body: unknown, heldAt: Date): ReleaseCheck {
  if (body === null || typeof body !== 'object') return unknown('no payment');
  const payment = body as Record<string, unknown>;
  const cancellations = payment.cancellations;

  if (cancellations === undefined) {
    return payment.status === 'PAID' ? { kind: 'clear' } : unknown(`no cancellation list on ${String(payment.status)}`);
  }
  if (!Array.isArray(cancellations)) return unknown('cancellations is not a list');

  const held = heldAt.getTime();
  for (const one of cancellations) {
    if (one === null || typeof one !== 'object') return unknown('cancellation is not an object');
    const cancellation = one as Record<string, unknown>;
    if (cancellation.status === 'FAILED') continue;
    if (typeof cancellation.status !== 'string') return unknown('cancellation has no status');

    const at = timeOf(cancellation.requestedAt) ?? timeOf(cancellation.cancelledAt);
    if (at === null) return unknown('cancellation has no time');
    if (at >= held) return { kind: 'cancelled' };
  }
  return { kind: 'clear' };
}
