import type { PaymentLookup, PortoneConfig } from './payment';
import { verifySigned } from './signature';

/**
 * **결제 알림 하나를 무엇으로 답하는가** (G-23 ⑥, ADR 0106).
 *
 * 세 가지를 지킨다 — 서명이 맞지 않으면 아무것도 안 한다, 금액은 PortOne 에서 다시 받아 **DB 가** 주문과 견준다,
 * 같은 알림이 두 번 와도 한 번만 반영한다(알림 번호 `webhook-id` 를 승인 문에 넘기면 `payment_event` 의 유일 제약이
 * 든다 — pgTAP `51_payment_event_retry`). 라우트는 이 답을 HTTP 로 옮기기만 한다.
 *
 * **답의 규칙.** PortOne 은 2xx 가 아니면 최대 다섯 번 다시 보낸다. 그러니
 * - 다시 보내도 같은 답이 날 것(서명 · 본문 모양 · 남의 상점 · 없는 주문 · 금액 거절 · 다른 요청의 알림 번호)은
 *   **다시 부르지 않는다** — 401 · 400 · 200 에 까닭을 기록(`note`)으로만 남긴다. 답에는 까닭을 안 싣는다 — 이 주소는
 *   아무나 두드린다.
 * - 우리 쪽이 잠깐 못 한 것(설정 없음 · PortOne 에 못 닿음 · DB 에 못 닿음)은 **503 으로 다시 부른다** — 고쳐진 뒤에
 *   그 알림이 와야 묶음이 선다.
 *
 * **다루는 알림은 `Transaction.Paid` 하나다.** 실패(`Failed`)에 주문을 닫지 않는다 — 같은 결제 번호로 다시 낼 수 있어서다.
 * 취소 · 환불은 사람이 PG 콘솔에서 먼저 하고 적는다(`docs/ops/runbook/credits.md` 「수동 환불」) — 그 알림은 받고(200) 아무것도 안 한다.
 *
 * **결제 이상은 운영자에게 알린다**(G-110 ④, `20261213090000`) — 답과 함께 `trouble` 을 돌려주고 라우트가 알림 문으로 옮긴다.
 * **서명이 맞은 뒤의 것만** 알린다 — 그 앞(설정 없음 · 서명 틀림)은 아무나 일으킬 수 있어 알림함을 채운다. 갈래는 셋이다.
 * - `amount-mismatch` — 승인 문이 금액이 달라 거절했다(`refused`)
 * - `paid-without-bundle` — PortOne 은 결제 완료인데 묶음을 세우지 않았고 다시 와도 같다(없는 주문 · 이미 닫힌 주문 ·
 *   다른 요청의 알림 번호 · 원화 아님 · 거래 번호 없음 · 우리 상점의 풀이권 주문이 아닌 결제 번호)
 * - `webhook-failed` — 처리하지 못했다(읽을 수 없는 본문 · PortOne 에 없음 · 못 닿음 · 모르는 거절 코드). 503 이면
 *   PortOne 이 다시 보내 묶음이 설 수 있다 — 운영자는 장부에서 섰는지 본다
 */

/** 승인 문의 답 — 적혔다(`applied` · `refused`) 또는 문이 거절했다(오류 코드) */
export type Approval = { kind: 'done'; outcome: string } | { kind: 'rejected'; code: string };

export type ApproveArgs = { orderId: string; paymentId: string; amount: number; eventId: string };

export type SettleDeps = {
  config: PortoneConfig | null;
  /** @throws 닿지 못함 → 503 */
  paymentOf: (paymentId: string, config: PortoneConfig) => Promise<PaymentLookup>;
  /** @throws 닿지 못함 → 503 */
  approve: (args: ApproveArgs) => Promise<Approval>;
  now: () => Date;
};

/** 운영자에게 알릴 결제 이상의 갈래 — DB 의 `report_payment_trouble` 이 받는 셋 */
export type TroubleKind = 'amount-mismatch' | 'paid-without-bundle' | 'webhook-failed';

/** 알릴 것 — 가맹점 결제 번호는 본문에서 못 읽었으면 `null`. 까닭은 `note` 다 */
export type Trouble = { kind: TroubleKind; paymentId: string | null };

type Settled = { status: 200 | 400 | 401 | 503; note: string | null; trouble: Trouble | null };

const answer = (status: Settled['status'], note: string | null = null, trouble: Trouble | null = null): Settled => ({
  status,
  note,
  trouble,
});

/**
 * 가맹점 주문 번호에서 주문 id 를 되짚는다. `open_reading_order` 가 `'rdo_' || replace(id::text, '-', '')` 로 짓는다
 * (`20261011090000`) — 그 모양이 아니면 우리 주문이 아니다. DB 를 한 번 더 읽지 않아도 되고, 없는 주문이면 승인 문이
 * `no_data_found` 로 말한다.
 */
export function orderIdOf(paymentId: string): string | null {
  const hex = /^rdo_([0-9a-f]{32})$/.exec(paymentId)?.[1];
  if (!hex) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type PaidNotice = { type: string; paymentId: string | null; storeId: string | null };

const noticeOf = (body: string): PaidNotice | null => {
  try {
    const json = JSON.parse(body) as { type?: unknown; data?: { paymentId?: unknown; storeId?: unknown } };
    if (typeof json.type !== 'string') return null;
    const paymentId = typeof json.data?.paymentId === 'string' ? json.data.paymentId : null;
    const storeId = typeof json.data?.storeId === 'string' ? json.data.storeId : null;
    return { type: json.type, paymentId, storeId };
  } catch {
    return null;
  }
};

/** 승인 문이 던진 코드 — 다시 불러도 같은 답이라 다시 부르지 않는다 */
const FINAL_REJECTIONS: Record<string, string> = {
  /** 없는 주문 — 떠난 사람의 주문이거나 우리 주문이 아니다 */
  P0002: 'no such order',
  /** 같은 알림 번호가 다른 주문 · 금액 · 거래 번호로 왔다(`20261015090000`) */
  '22023': 'event id belongs to another request',
  /** 주문이 이미 닫혔거나 다른 거래 번호로 승인됐다 — 돈은 들어왔으니 사람이 환불한다 */
  '55000': 'order already closed - refund by hand',
};

export async function settleWebhook(headers: Headers, body: string, deps: SettleDeps): Promise<Settled> {
  const { config } = deps;
  if (!config) return answer(503, 'not configured');

  const verified = verifySigned(config.webhookSecret, headers, body, deps.now());
  if (!verified.ok) return answer(401, `signature: ${verified.detail}`);

  const notice = noticeOf(body);
  if (!notice) return answer(400, 'unreadable body', { kind: 'webhook-failed', paymentId: null });

  if (notice.type !== 'Transaction.Paid') return answer(200);

  if (!notice.paymentId) {
    return answer(400, 'paid notice without paymentId', { kind: 'webhook-failed', paymentId: null });
  }
  // 같은 비밀을 나눠 쓰는 다른 상점의 알림 — 우리 돈이 아니다
  if (notice.storeId !== config.storeId) return answer(200, 'another store');

  const { paymentId } = notice;
  const failed = { kind: 'webhook-failed', paymentId } as const;
  const unbundled = { kind: 'paid-without-bundle', paymentId } as const;

  const orderId = orderIdOf(paymentId);
  if (!orderId) return answer(200, 'not a reading order', unbundled);

  let lookup: PaymentLookup;
  try {
    lookup = await deps.paymentOf(paymentId, config);
  } catch (error) {
    return answer(503, `payment lookup: ${error instanceof Error ? error.message : 'failed'}`, failed);
  }

  if (lookup.kind === 'missing') return answer(200, 'payment not found at portone', failed);

  const { payment } = lookup;
  // 알림이 늦게 왔다 — 그 사이 취소됐으면 승인하지 않는다
  if (payment.status !== 'PAID') return answer(200);
  if (payment.storeId !== config.storeId) return answer(200, 'payment of another store');
  if (payment.currency !== 'KRW') return answer(200, `currency ${payment.currency}`, unbundled);
  if (!payment.transactionId) return answer(200, 'paid without transactionId', unbundled);

  let approval: Approval;
  try {
    approval = await deps.approve({
      orderId,
      paymentId: payment.transactionId,
      amount: payment.total,
      eventId: verified.eventId,
    });
  } catch (error) {
    return answer(503, `approve: ${error instanceof Error ? error.message : 'failed'}`, failed);
  }

  if (approval.kind === 'done') {
    if (approval.outcome === 'applied') return answer(200);
    return answer(200, `approve ${approval.outcome} - amount differs (paid ${payment.total})`, {
      kind: 'amount-mismatch',
      paymentId,
    });
  }

  const final = FINAL_REJECTIONS[approval.code];
  return final ? answer(200, `approve: ${final}`, unbundled) : answer(503, `approve: ${approval.code}`, failed);
}
