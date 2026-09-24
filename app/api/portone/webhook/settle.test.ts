import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { paymentOf, portoneConfigOf, portonePayment, type PaymentLookup, type PortoneConfig } from './payment';
import { orderIdOf, settleWebhook, type Approval, type ApproveArgs, type SettleDeps } from './settle';

/**
 * 결제 알림의 문 — 가짜 PortOne 과 가짜 승인 문으로 (G-23 ⑥). 실호출은 없다.
 *
 * 승인 문 자체(금액 대조 · 같은 알림은 한 번 · 다른 요청의 알림 번호는 `22023`)는 pgTAP `48_reading_bundle_ledger` ·
 * `51_payment_event_retry` 가 든다. 여기서 재는 것은 문이 그 문에 **무엇을 넘기고, 답을 무엇으로 옮기는가**다.
 */

const KEY = Buffer.from('saju-portone-webhook-test-key-32b');
const CONFIG: PortoneConfig = {
  webhookSecret: `whsec_${KEY.toString('base64')}`,
  apiSecret: 'portone-api-secret-for-test',
  storeId: 'store-00000000-test',
};
const NOW = new Date('2026-09-24T12:00:00Z');
const ORDER = '0f1e2d3c-4b5a-4968-8776-655443322110';
const PAYMENT_ID = `rdo_${ORDER.replaceAll('-', '')}`;

const signed = (body: string, eventId = 'whk_0001', at = NOW) => {
  const timestamp = String(Math.floor(at.getTime() / 1000));
  const signature = createHmac('sha256', KEY).update(`${eventId}.${timestamp}.${body}`).digest('base64');
  return new Headers({ 'webhook-id': eventId, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` });
};

const paidBody = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: 'Transaction.Paid',
    timestamp: '2026-09-24T12:00:00.000Z',
    data: { paymentId: PAYMENT_ID, transactionId: 'tx_attempt_1', storeId: CONFIG.storeId, ...over },
  });

const found = (over: Record<string, unknown> = {}): PaymentLookup => ({
  kind: 'found',
  payment: { status: 'PAID', storeId: CONFIG.storeId, transactionId: 'tx_attempt_1', total: 4300, currency: 'KRW', ...over },
});

/** 승인 문의 가짜 — 부른 인자를 모은다 */
const depsOf = (over: Partial<SettleDeps> = {}, approval: Approval = { kind: 'done', outcome: 'applied' }) => {
  const approved: ApproveArgs[] = [];
  const looked: string[] = [];
  const deps: SettleDeps = {
    config: CONFIG,
    paymentOf: async (paymentId) => {
      looked.push(paymentId);
      return found();
    },
    approve: async (args) => {
      approved.push(args);
      return approval;
    },
    now: () => NOW,
    ...over,
  };
  return { deps, approved, looked };
};

describe('결제 알림의 문 (G-23 ⑥)', () => {
  it('서명이 맞는 결제 완료 알림은 PortOne 에서 받은 금액 · 거래 번호와 알림 번호로 승인 문을 부른다', async () => {
    const body = paidBody();
    const { deps, approved, looked } = depsOf();
    expect(await settleWebhook(signed(body), body, deps)).toEqual({ status: 200, note: null });
    expect(looked).toEqual([PAYMENT_ID]);
    expect(approved).toEqual([{ orderId: ORDER, paymentId: 'tx_attempt_1', amount: 4300, eventId: 'whk_0001' }]);
  });

  it('금액은 알림 본문이 아니라 PortOne 의 결제에서 온다 — 본문에 금액을 실어도 안 읽는다', async () => {
    const body = paidBody({ amount: { total: 100 } });
    const { deps, approved } = depsOf({ paymentOf: async () => found({ total: 8600 }) });
    await settleWebhook(signed(body), body, deps);
    expect(approved.map((one) => one.amount)).toEqual([8600]);
  });

  it('금액이 달라 승인 문이 거절을 돌려주면 200 이고 기록에 남긴다 — 다시 보내도 같은 답이다', async () => {
    const body = paidBody();
    const { deps } = depsOf({}, { kind: 'done', outcome: 'refused' });
    const settled = await settleWebhook(signed(body), body, deps);
    expect(settled.status).toBe(200);
    expect(settled.note).toMatch(/amount differs/);
  });

  it('같은 알림이 두 번 오면 두 번 다 같은 알림 번호로 부른다 — 한 번만 반영하는 것은 DB 의 유일 제약이다', async () => {
    const body = paidBody();
    const { deps, approved } = depsOf();
    await settleWebhook(signed(body, 'whk_same'), body, deps);
    await settleWebhook(signed(body, 'whk_same'), body, deps);
    expect(approved.map((one) => one.eventId)).toEqual(['whk_same', 'whk_same']);
  });

  it('서명이 틀리면 401 이고 PortOne 도 DB 도 안 부른다', async () => {
    const body = paidBody();
    const { deps, approved, looked } = depsOf();
    const forged = signed(paidBody({ paymentId: 'rdo_ffffffffffffffffffffffffffffffff' }));
    const settled = await settleWebhook(forged, body, deps);
    expect(settled).toEqual({ status: 401, note: 'signature: signature mismatch' });
    expect([...looked, ...approved]).toEqual([]);
  });

  it('켜는 값이 하나라도 없으면 503 이다 — 설정이 고쳐진 뒤 다시 와야 한다', async () => {
    expect(portoneConfigOf({ PORTONE_WEBHOOK_SECRET: 'a', PORTONE_API_SECRET: 'b', PORTONE_STORE_ID: ' ' })).toBeNull();
    expect(portoneConfigOf({ PORTONE_WEBHOOK_SECRET: 'a', PORTONE_API_SECRET: undefined, PORTONE_STORE_ID: 'c' })).toBeNull();
    const body = paidBody();
    const { deps } = depsOf({ config: null });
    expect((await settleWebhook(signed(body), body, deps)).status).toBe(503);
  });

  it('결제 완료가 아닌 알림은 받고 아무것도 안 한다 — 실패에 주문을 닫지 않는다', async () => {
    for (const type of ['Transaction.Failed', 'Transaction.Cancelled', 'Transaction.Ready']) {
      const body = paidBody();
      const other = body.replace('Transaction.Paid', type);
      const { deps, approved, looked } = depsOf();
      expect(await settleWebhook(signed(other), other, deps)).toEqual({ status: 200, note: null });
      expect([...looked, ...approved]).toEqual([]);
    }
  });

  it('읽을 수 없는 본문은 400 이다', async () => {
    const { deps } = depsOf();
    expect((await settleWebhook(signed('not json'), 'not json', deps)).status).toBe(400);
  });

  it('남의 상점 · 풀이권 주문이 아닌 결제 번호는 승인하지 않는다', async () => {
    for (const body of [paidBody({ storeId: 'store-other' }), paidBody({ paymentId: 'order-from-elsewhere' })]) {
      const { deps, approved } = depsOf();
      expect((await settleWebhook(signed(body), body, deps)).status).toBe(200);
      expect(approved).toEqual([]);
    }
  });

  it('PortOne 의 결제가 완료가 아니거나 다른 상점 · 다른 통화 · 거래 번호 없음이면 승인하지 않는다', async () => {
    for (const payment of [
      found({ status: 'CANCELLED' }),
      found({ storeId: 'store-other' }),
      found({ currency: 'USD' }),
      found({ transactionId: null }),
      { kind: 'missing' } as const,
    ]) {
      const body = paidBody();
      const { deps, approved } = depsOf({ paymentOf: async () => payment });
      expect((await settleWebhook(signed(body), body, deps)).status).toBe(200);
      expect(approved).toEqual([]);
    }
  });

  it('PortOne 이나 DB 에 못 닿으면 503 으로 다시 부른다', async () => {
    const body = paidBody();
    const unreachable = depsOf({
      paymentOf: async () => {
        throw new Error('portone payment: 502');
      },
    });
    expect((await settleWebhook(signed(body), body, unreachable.deps)).status).toBe(503);
    expect(unreachable.approved).toEqual([]);

    const noKey = depsOf({
      approve: async () => {
        throw new Error('서버에 결제 승인 열쇠가 없습니다');
      },
    });
    expect((await settleWebhook(signed(body), body, noKey.deps)).status).toBe(503);
  });

  it('승인 문의 거절은 다시 불러도 같은 것만 200 이고, 모르는 코드는 503 이다', async () => {
    const body = paidBody();
    for (const [code, status] of [
      ['P0002', 200],
      ['22023', 200],
      ['55000', 200],
      ['08006', 503],
      ['', 503],
    ] as const) {
      const { deps } = depsOf({}, { kind: 'rejected', code });
      const settled = await settleWebhook(signed(body), body, deps);
      expect([code, settled.status]).toEqual([code, status]);
      expect(settled.note).not.toBeNull();
    }
  });
});

describe('가맹점 주문 번호 (G-23 ⑥)', () => {
  it("주문 id 는 open_reading_order 의 'rdo_' || replace(id, '-', '') 를 거꾸로 푼 것이다", () => {
    const id = randomUUID();
    expect(orderIdOf(`rdo_${id.replaceAll('-', '')}`)).toBe(id);
  });

  it('주문 번호를 짓는 마지막 정의가 그 모양을 쓴다 — DB 가 모양을 바꾸면 여기가 붉다', () => {
    const dir = resolve(__dirname, '../../../../supabase/migrations');
    const last = readdirSync(dir)
      .filter((file) => readFileSync(join(dir, file), 'utf8').includes('function public.open_reading_order('))
      .sort()
      .at(-1);
    expect(last).toBeDefined();
    expect(readFileSync(join(dir, last ?? ''), 'utf8')).toContain("'rdo_' || replace(g.id::text, '-', '')");
  });

  it('그 모양이 아니면 우리 주문이 아니다', () => {
    for (const other of ['rdo_', 'rdo_XYZ', `rdo_${'a'.repeat(31)}`, `RDO_${'a'.repeat(32)}`, `rdo_${'a'.repeat(33)}`]) {
      expect(orderIdOf(other)).toBeNull();
    }
  });
});

describe('PortOne 결제 단건 조회 — 가짜 fetch (G-23 ⑥)', () => {
  const paidJson = {
    status: 'PAID',
    id: PAYMENT_ID,
    transactionId: 'tx_attempt_1',
    storeId: CONFIG.storeId,
    amount: { total: 4300, paid: 4300 },
    currency: 'KRW',
  };

  it('API 비밀을 PortOne 머리로 싣고 상점을 지정해 결제 번호로 묻는다', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return Response.json(paidJson);
    }) as typeof fetch;
    expect(await portonePayment(PAYMENT_ID, CONFIG, fake)).toEqual({
      kind: 'found',
      payment: { status: 'PAID', storeId: CONFIG.storeId, transactionId: 'tx_attempt_1', total: 4300, currency: 'KRW' },
    });
    expect(calls[0].url).toBe(`https://api.portone.io/payments/${PAYMENT_ID}?storeId=${CONFIG.storeId}`);
    expect(calls[0].init?.headers).toEqual({ authorization: `PortOne ${CONFIG.apiSecret}` });
  });

  it('404 는 없음이고, 다른 실패는 던진다', async () => {
    const status = (code: number) => (async () => new Response('{}', { status: code })) as typeof fetch;
    expect(await portonePayment(PAYMENT_ID, CONFIG, status(404))).toEqual({ kind: 'missing' });
    await expect(portonePayment(PAYMENT_ID, CONFIG, status(401))).rejects.toThrow('portone payment: 401');
    await expect(portonePayment(PAYMENT_ID, CONFIG, status(500))).rejects.toThrow('portone payment: 500');
  });

  it('모양이 다른 결제는 던진다 — 금액이 정수가 아니거나 칸이 빠지면', () => {
    expect(() => paymentOf({ ...paidJson, amount: { total: '4300' } })).toThrow('unexpected shape');
    expect(() => paymentOf({ ...paidJson, amount: { total: 4300.5 } })).toThrow('unexpected shape');
    expect(() => paymentOf({ ...paidJson, status: undefined })).toThrow('unexpected shape');
    expect(() => paymentOf(null)).toThrow('unexpected shape');
  });
});
