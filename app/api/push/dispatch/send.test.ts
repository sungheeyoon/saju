import { createECDH } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendNotification = vi.fn();

class FakeWebPushError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

vi.mock('web-push', () => ({
  default: { sendNotification: (...args: unknown[]) => sendNotification(...args) },
  WebPushError: FakeWebPushError,
}));

const { pushSender } = await import('./send');

const curve = createECDH('prime256v1');
curve.generateKeys();
const PUBLIC = curve.getPublicKey().toString('base64url');
const PRIVATE = curve.getPrivateKey().toString('base64url');
const MATCH = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const TARGET = { endpoint: 'https://push.example/abc', p256dh: 'p', auth: 'a' };

beforeEach(() => {
  sendNotification.mockReset().mockResolvedValue({ statusCode: 201 });
  vi.stubEnv('NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY', PUBLIC);
  vi.stubEnv('WEB_PUSH_VAPID_PRIVATE_KEY', PRIVATE);
  vi.stubEnv('WEB_PUSH_SUBJECT', 'mailto:ops@example.com');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('송신기의 설정 (ADR 0157)', () => {
  it.each([
    ['공개 열쇠가 없다', 'NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY', ''],
    ['비밀 열쇠가 없다', 'WEB_PUSH_VAPID_PRIVATE_KEY', ''],
    ['비밀 열쇠의 길이가 틀렸다', 'WEB_PUSH_VAPID_PRIVATE_KEY', 'c2hvcnQ'],
    ['주체가 http 다', 'WEB_PUSH_SUBJECT', 'http://example.com'],
  ])('%s — 송신기가 없다(설정 안 됨)', (_, name, value) => {
    vi.stubEnv(name, value);
    expect(pushSender()).toBeNull();
  });

  it('주체가 없으면 이 배포의 https 주소를 쓴다 — 로컬의 http 는 설정 안 됨이다', () => {
    vi.stubEnv('WEB_PUSH_SUBJECT', '');
    vi.stubEnv('SITE_URL', 'https://example.com');
    expect(pushSender()).not.toBeNull();

    vi.stubEnv('SITE_URL', 'http://localhost:3000');
    expect(pushSender()).toBeNull();
  });
});

describe('송신 하나', () => {
  it('페이로드는 주소와 표뿐이고, TTL · 긴급도 · Topic 을 싣는다', async () => {
    const send = pushSender()!;

    expect(await send(TARGET, MATCH)).toBe('sent');

    const [subscription, payload, options] = sendNotification.mock.calls[0];
    expect(subscription).toEqual({ endpoint: TARGET.endpoint, keys: { p256dh: 'p', auth: 'a' } });
    expect(JSON.parse(payload)).toEqual({ url: `/me/chat/${MATCH}`, tag: `chat-${MATCH}` });
    expect(options).toMatchObject({
      TTL: 3600,
      urgency: 'high',
      topic: MATCH.replaceAll('-', ''),
      vapidDetails: { subject: 'mailto:ops@example.com', publicKey: PUBLIC, privateKey: PRIVATE },
    });
  });

  it.each([
    [410, 'gone'],
    [404, 'gone'],
    [429, 'retry'],
    [500, 'retry'],
    [413, 'retry'],
  ] as const)('푸시 서비스가 %s 이면 %s', async (status, result) => {
    sendNotification.mockRejectedValue(new FakeWebPushError('Received unexpected response code', status));
    expect(await pushSender()!(TARGET, MATCH)).toBe(result);
  });

  it('연결이 끊기면 다시 보내기다 — 던지지 않는다', async () => {
    sendNotification.mockRejectedValue(new Error('Socket timeout'));
    expect(await pushSender()!(TARGET, MATCH)).toBe('retry');
  });
});
