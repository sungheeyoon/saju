import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { TOLERANCE_SECONDS, verifySigned } from './signature';

/** Standard Webhooks 규격의 공개 시험 벡터(svix · standard-webhooks 의 README) */
const VECTOR = {
  secret: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
  id: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
  timestamp: '1614265330',
  body: '{"test": 2432232314}',
  signature: 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
};

const at = (seconds: number) => new Date(seconds * 1000);
const headersOf = (over: Record<string, string> = {}) =>
  new Headers({
    'webhook-id': VECTOR.id,
    'webhook-timestamp': VECTOR.timestamp,
    'webhook-signature': VECTOR.signature,
    ...over,
  });

describe('결제 알림의 서명 (G-23 ⑥)', () => {
  const now = at(Number(VECTOR.timestamp));

  it('규격의 공개 벡터를 맞다고 보고 알림 번호를 낸다', () => {
    expect(verifySigned(VECTOR.secret, headersOf(), VECTOR.body, now)).toEqual({ ok: true, eventId: VECTOR.id });
  });

  it('본문이 한 바이트라도 다르면 거절한다 — 파싱해 다시 쓴 본문도', () => {
    const reserialized = JSON.stringify(JSON.parse(VECTOR.body));
    expect(verifySigned(VECTOR.secret, headersOf(), reserialized, now)).toEqual({
      ok: false,
      detail: 'signature mismatch',
    });
  });

  it('다른 비밀 · 다른 알림 번호 · 다른 시각으로 지은 서명은 거절한다', () => {
    expect(verifySigned('whsec_' + Buffer.from('another').toString('base64'), headersOf(), VECTOR.body, now).ok).toBe(
      false,
    );
    expect(verifySigned(VECTOR.secret, headersOf({ 'webhook-id': 'msg_other' }), VECTOR.body, now).ok).toBe(false);
    const later = String(Number(VECTOR.timestamp) + 1);
    expect(verifySigned(VECTOR.secret, headersOf({ 'webhook-timestamp': later }), VECTOR.body, now).ok).toBe(false);
  });

  it('서명이 여럿이면 하나만 맞아도 된다 — 비밀을 바꾸는 동안', () => {
    const both = `v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= ${VECTOR.signature}`;
    expect(verifySigned(VECTOR.secret, headersOf({ 'webhook-signature': both }), VECTOR.body, now).ok).toBe(true);
  });

  it('v1 이 아닌 서명과 머리가 빠진 요청은 거절한다', () => {
    const v2 = VECTOR.signature.replace(/^v1,/, 'v2,');
    expect(verifySigned(VECTOR.secret, headersOf({ 'webhook-signature': v2 }), VECTOR.body, now).ok).toBe(false);
    const bare = new Headers({ 'webhook-id': VECTOR.id, 'webhook-timestamp': VECTOR.timestamp });
    expect(verifySigned(VECTOR.secret, bare, VECTOR.body, now)).toEqual({ ok: false, detail: 'missing headers' });
  });

  it('시각이 앞뒤 5분 밖이면 서명이 맞아도 거절한다 — 재생 막기', () => {
    const base = Number(VECTOR.timestamp);
    expect(verifySigned(VECTOR.secret, headersOf(), VECTOR.body, at(base + TOLERANCE_SECONDS)).ok).toBe(true);
    expect(verifySigned(VECTOR.secret, headersOf(), VECTOR.body, at(base + TOLERANCE_SECONDS + 1))).toEqual({
      ok: false,
      detail: 'timestamp outside tolerance',
    });
    expect(verifySigned(VECTOR.secret, headersOf(), VECTOR.body, at(base - TOLERANCE_SECONDS - 1)).ok).toBe(false);
  });

  it('비밀이 비면 무엇에도 맞지 않는다 — 빈 열쇠의 HMAC 을 지어 보내도', () => {
    const forged = createHmac('sha256', Buffer.alloc(0))
      .update(`${VECTOR.id}.${VECTOR.timestamp}.${VECTOR.body}`)
      .digest('base64');
    expect(verifySigned('whsec_', headersOf({ 'webhook-signature': `v1,${forged}` }), VECTOR.body, now)).toEqual({
      ok: false,
      detail: 'empty secret',
    });
  });
});
