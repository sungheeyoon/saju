import 'server-only';

import { keyedClient } from '@/app/keyed-client';

import { portoneConfigOf, portonePayment } from './payment';
import { settleWebhook, type Approval } from './settle';

/**
 * **PortOne 이 두드리는 결제 알림의 문** (G-23 ⑥, ADR 0106).
 *
 * 풀이 생성의 webhook(`../../openai/webhook/route.ts`)처럼 로그인 관문 밖에 서고, 자격은 서명이 든다. 판단은
 * `settle.ts` 가 하고 여기는 비밀을 읽고 · DB 와 PortOne 에 닿는 손을 넘기고 · 답을 HTTP 로 옮긴다.
 *
 * **판매가 닫혀 있는 동안에는 아무것도 못 세운다** — 주문은 `open_reading_order` 로만 서고 그 문은
 * `reading_sale_is_open()` 이 false 인 동안 던진다. 켜는 값 셋(`PORTONE_WEBHOOK_SECRET` · `PORTONE_API_SECRET` ·
 * `PORTONE_STORE_ID`)이 없으면 503 이다. PortOne 콘솔에 이 주소를 넣는 날의 걸음은 runbook 「결제 알림」.
 *
 * 승인은 서버 열쇠(`service_role`)로 부른다 — `approve_reading_order` 는 그 역할에만 열렸다.
 */

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();

  const settled = await settleWebhook(request.headers, body, {
    config: portoneConfigOf({
      PORTONE_WEBHOOK_SECRET: process.env.PORTONE_WEBHOOK_SECRET,
      PORTONE_API_SECRET: process.env.PORTONE_API_SECRET,
      PORTONE_STORE_ID: process.env.PORTONE_STORE_ID,
    }),
    paymentOf: (paymentId, config) => portonePayment(paymentId, config, fetch),
    approve: async ({ orderId, paymentId, amount, eventId }): Promise<Approval> => {
      // 열쇠가 없으면 던진다(`NoKeyError`) — 503 으로 다시 부른다
      const keyed = keyedClient('결제 승인');
      const { data, error } = await keyed
        .rpc('approve_reading_order', {
          p_order_id: orderId,
          p_provider_payment_id: paymentId,
          p_amount: amount,
          p_event_id: eventId,
        })
        .single();
      if (error) return { kind: 'rejected', code: error.code ?? 'unknown' };
      return { kind: 'done', outcome: data.outcome };
    },
    now: () => new Date(),
  });

  // 까닭은 기록에만 — 답에 실으면 아무나 우리 설정과 주문의 상태를 묻는다
  if (settled.note) console.error('portone webhook', settled.note);

  return new Response(null, { status: settled.status });
}
