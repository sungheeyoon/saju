/**
 * **낸 금액은 알림이 아니라 PortOne 에서 다시 받는다** (G-23 ⑥).
 *
 * PortOne V2 의 결제 알림 본문은 `paymentId` · `transactionId` · `storeId` 셋뿐이고 금액이 없다. 있더라도 믿지 않는다 —
 * 서명이 맞다는 것은 PortOne 이 보냈다는 뜻이지 그 결제가 지금 무엇인지가 아니다. 그래서 결제 단건 조회
 * (`GET /payments/{paymentId}`, 머리 `Authorization: PortOne <API Secret>`)로 상태 · 상점 · 금액 · 통화를 받고, 금액을
 * 주문과 견주는 것은 DB 의 승인 문(`approve_reading_order`)이 한다 — 주문 금액은 가격표에서 왔고 부르는 쪽이 못 댄다.
 *
 * 비밀은 여기서 안 읽는다 — 부르는 라우트가 넘긴다. `fetch` 도 넘겨받아 시험이 가짜 PortOne 으로 돈다(실호출 없음).
 */

const API = 'https://api.portone.io';

/**
 * 조회를 기다리는 한도. `fetch` 는 스스로 끊지 않아서, PortOne 이 답을 안 하면 함수가 제 수명(기본 300초)까지 붙들린다.
 * 끊으면 던지고 라우트가 503 으로 답해 PortOne 이 다시 보낸다 — 알림의 답도 몇 초 안에 가야 재전송이 겹치지 않는다.
 */
const LOOKUP_TIMEOUT_MS = 10_000;

export type PortoneConfig = { webhookSecret: string; apiSecret: string; storeId: string };

/** 결제 단건 — 승인에 드는 칸만 */
export type PortonePayment = {
  status: string;
  storeId: string;
  /** PortOne 의 결제 시도 번호 — 승인 때 주문의 거래 번호(`provider_payment_id`)가 된다 */
  transactionId: string | null;
  total: number;
  currency: string;
};

export type PaymentLookup = { kind: 'found'; payment: PortonePayment } | { kind: 'missing' };

/** 셋이 다 있어야 켜진다 — 하나라도 없으면 알림을 받지 않는다(503) */
export function portoneConfigOf(env: {
  PORTONE_WEBHOOK_SECRET: string | undefined;
  PORTONE_API_SECRET: string | undefined;
  PORTONE_STORE_ID: string | undefined;
}): PortoneConfig | null {
  const webhookSecret = env.PORTONE_WEBHOOK_SECRET?.trim();
  const apiSecret = env.PORTONE_API_SECRET?.trim();
  const storeId = env.PORTONE_STORE_ID?.trim();
  if (!webhookSecret || !apiSecret || !storeId) return null;
  return { webhookSecret, apiSecret, storeId };
}

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/**
 * 받은 결제를 승인에 드는 칸으로 옮긴다. 모양이 다르면 던진다 — PortOne 이 모양을 바꾼 것이라 다시 받아도 같고,
 * 라우트는 503 으로 답해 재전송을 부른다(고쳐진 뒤에 다시 와야 한다).
 */
export function paymentOf(json: unknown): PortonePayment {
  const body = (json ?? {}) as Record<string, unknown>;
  const amount = (body.amount ?? {}) as Record<string, unknown>;
  const status = text(body.status);
  const storeId = text(body.storeId);
  const currency = text(body.currency);
  const total = amount.total;
  if (!status || !storeId || !currency || typeof total !== 'number' || !Number.isInteger(total)) {
    throw new Error('portone payment: unexpected shape');
  }
  return { status, storeId, transactionId: text(body.transactionId), total, currency };
}

/**
 * @throws 닿지 못했거나 · 한도 안에 답이 없거나 · 404 가 아닌 실패 — 라우트가 503 으로 답해 PortOne 이 다시 보낸다
 */
export async function portonePayment(
  paymentId: string,
  config: PortoneConfig,
  fetchImpl: typeof fetch,
): Promise<PaymentLookup> {
  const url = `${API}/payments/${encodeURIComponent(paymentId)}?storeId=${encodeURIComponent(config.storeId)}`;
  const response = await fetchImpl(url, {
    headers: { authorization: `PortOne ${config.apiSecret}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  if (response.status === 404) return { kind: 'missing' };
  if (!response.ok) throw new Error(`portone payment: ${response.status}`);
  return { kind: 'found', payment: paymentOf(await response.json()) };
}
