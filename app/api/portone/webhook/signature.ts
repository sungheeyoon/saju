import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * **결제 알림의 서명을 검증한다** (G-23 ⑥).
 *
 * PortOne V2 의 웹훅은 Standard Webhooks 규격을 따른다(2026-09-24, PortOne 개발자 문서 「웹훅 연동」에서 확인).
 * 머리 셋 — `webhook-id` · `webhook-timestamp` · `webhook-signature` — 과 raw 본문으로 `id.timestamp.본문` 을 짓고,
 * `whsec_` 를 뗀 비밀을 base64 로 푼 열쇠의 HMAC-SHA256 을 base64 로 적어 `v1,<서명>` 으로 싣는다. 서명은 공백으로
 * 여럿이 올 수 있다(비밀을 바꾸는 동안 둘이 함께 선다) — 하나라도 맞으면 된다.
 *
 * SDK(`@portone/server-sdk`)를 들이지 않고 `node:crypto` 로 적었다 — 운영 의존성이 하나 늘면 `audit` 차선이 그것까지
 * 재고(ADR 0104), 이 검증은 스무 줄이다. 규격의 공개 시험 벡터(Standard Webhooks · svix 의 README)가 `signature.test.ts`
 * 에서 같은 서명을 낸다.
 *
 * **시각은 앞뒤 5분 안이어야 한다** — 규격의 권고값이다. 서명이 맞아도 오래된 알림은 훔친 요청의 재생일 수 있다.
 * PortOne 의 재전송(최대 5번, 0 → 256분 간격)은 매번 새 시각으로 다시 서명하므로 이 창에 걸리지 않는다.
 */

/** 규격의 권고 — 앞뒤 5분 */
export const TOLERANCE_SECONDS = 5 * 60;

export type Verified = { ok: true; eventId: string } | { ok: false; detail: string };

const keyOf = (secret: string): Buffer => Buffer.from(secret.replace(/^whsec_/, ''), 'base64');

/**
 * @param secret 콘솔이 준 웹훅 비밀(`whsec_…`)
 * @param body 받은 그대로의 본문 — 파싱한 뒤 다시 문자열로 만들면 바이트가 달라져 서명이 안 맞는다
 * @returns 맞으면 알림 번호(`webhook-id` — `payment_event.provider_event_id` 가 된다), 아니면 까닭(기록에만 싣는다)
 */
export function verifySigned(secret: string, headers: Headers, body: string, now: Date): Verified {
  const eventId = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signatures = headers.get('webhook-signature');

  if (!eventId || !timestamp || !signatures) return { ok: false, detail: 'missing headers' };

  if (!/^\d{1,12}$/.test(timestamp)) return { ok: false, detail: 'bad timestamp' };
  const skew = Math.abs(now.getTime() / 1000 - Number(timestamp));
  if (skew > TOLERANCE_SECONDS) return { ok: false, detail: 'timestamp outside tolerance' };

  const key = keyOf(secret);
  if (key.length === 0) return { ok: false, detail: 'empty secret' };

  const expected = createHmac('sha256', key).update(`${eventId}.${timestamp}.${body}`).digest();

  const matched = signatures.split(' ').some((one) => {
    const [version, signature] = one.split(',', 2);
    if (version !== 'v1' || !signature) return false;
    const given = Buffer.from(signature, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });

  return matched ? { ok: true, eventId } : { ok: false, detail: 'signature mismatch' };
}
