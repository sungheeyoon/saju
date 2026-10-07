import { createECDH } from 'node:crypto';
import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const generateRequestDetails = vi.fn();

vi.mock('web-push', () => ({
  default: { generateRequestDetails: (...args: unknown[]) => generateRequestDetails(...args) },
}));

const { pushSender, postWithin } = await import('./send');

const curve = createECDH('prime256v1');
curve.generateKeys();
const PUBLIC = curve.getPublicKey().toString('base64url');
const PRIVATE = curve.getPrivateKey().toString('base64url');
const MATCH = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const TARGET = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: 'p', auth: 'a' };
const BUILT = { method: 'POST', headers: { TTL: 3600 }, body: Buffer.from('x'), endpoint: TARGET.endpoint };

/** 보내는 손을 갈아 끼운다 — 받은 상태 코드를 그대로 낸다 */
const post = vi.fn<typeof postWithin>();

beforeEach(() => {
  generateRequestDetails.mockReset().mockReturnValue(BUILT);
  post.mockReset().mockResolvedValue(201);
  vi.stubEnv('NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY', PUBLIC);
  vi.stubEnv('WEB_PUSH_VAPID_PRIVATE_KEY', PRIVATE);
  vi.stubEnv('WEB_PUSH_SUBJECT', 'mailto:ops@example.com');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('송신기의 설정 (ADR 0156)', () => {
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
  it('페이로드는 주소와 표뿐이고, TTL · 긴급도 · Topic 을 싣는다 — 전체 시한 10초로 보낸다', async () => {
    const send = pushSender(post)!;

    expect(await send(TARGET, MATCH)).toBe('sent');

    const [subscription, payload, options] = generateRequestDetails.mock.calls[0];
    expect(subscription).toEqual({ endpoint: TARGET.endpoint, keys: { p256dh: 'p', auth: 'a' } });
    expect(JSON.parse(payload)).toEqual({ url: `/me/chat/${MATCH}`, tag: `chat-${MATCH}` });
    expect(options).toMatchObject({
      TTL: 3600,
      urgency: 'high',
      topic: MATCH.replaceAll('-', ''),
      vapidDetails: { subject: 'mailto:ops@example.com', publicKey: PUBLIC, privateKey: PRIVATE },
    });
    expect(post).toHaveBeenCalledWith(TARGET.endpoint, BUILT, 10_000);
  });

  it.each([
    [410, 'gone'],
    [404, 'gone'],
    [429, 'retry'],
    [500, 'retry'],
    [413, 'retry'],
    [302, 'retry'],
  ] as const)('푸시 서비스가 %s 이면 %s', async (status, result) => {
    post.mockResolvedValue(status);
    expect(await pushSender(post)!(TARGET, MATCH)).toBe(result);
  });

  it('답을 못 받으면(연결 · 시한) 다시 보내기다 — 던지지 않는다', async () => {
    post.mockResolvedValue(null);
    expect(await pushSender(post)!(TARGET, MATCH)).toBe('retry');
  });

  it('구독 열쇠로 암호화하지 못하면 다시 보내기다', async () => {
    generateRequestDetails.mockImplementation(() => {
      throw new Error('bad key');
    });
    expect(await pushSender(post)!(TARGET, MATCH)).toBe('retry');
    expect(post).not.toHaveBeenCalled();
  });

  it('모르는 푸시 서비스로는 보내지 않고 그 구독을 지운다', async () => {
    expect(await pushSender(post)!({ ...TARGET, endpoint: 'https://evil.example/push' }, MATCH)).toBe('gone');
    expect(post).not.toHaveBeenCalled();
  });

  it('시험용 호스트는 WEB_PUSH_EXTRA_HOSTS 로만 열린다', async () => {
    const local = { ...TARGET, endpoint: 'https://localhost:4443/push/b' };
    expect(await pushSender(post)!(local, MATCH)).toBe('gone');
    vi.stubEnv('WEB_PUSH_EXTRA_HOSTS', 'localhost');
    expect(await pushSender(post)!(local, MATCH)).toBe('sent');
  });
});

describe('보내는 손 — 전체 시한 (ADR 0156)', () => {
  let server: Server | null = null;
  afterEach(() => {
    server?.closeAllConnections();
    server?.close();
    server = null;
  });

  const listen = async (handler: Parameters<typeof createServer>[1]) => {
    server = createServer(handler);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(server!.address() as AddressInfo).port}/push`;
  };
  const REQUEST = { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: Buffer.from('x') };

  it('머리가 오면 본문을 안 읽고 상태 코드를 낸다 — 본문을 끝없이 흘려도', async () => {
    const url = await listen((_, response) => {
      response.writeHead(201);
      const drip = setInterval(() => response.write('x'.repeat(1024)), 5);
      response.on('close', () => clearInterval(drip));
    });
    const started = Date.now();
    expect(await postWithin(url, REQUEST, 2000, httpRequest)).toBe(201);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('머리를 안 보내는 서버는 시한에 끊고 null 이다', async () => {
    const url = await listen((request) => {
      // 머리를 안 보내고 붙든다
      request.resume();
    });
    const started = Date.now();
    expect(await postWithin(url, REQUEST, 300, httpRequest)).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('넘겨주기(3xx)를 따르지 않는다 — 상태 코드 그대로다', async () => {
    const url = await listen((_, response) => {
      response.writeHead(302, { location: 'http://169.254.169.254/' });
      response.end();
    });
    expect(await postWithin(url, REQUEST, 2000, httpRequest)).toBe(302);
  });

  it('닿지 못하면 null 이다', async () => {
    expect(await postWithin('http://127.0.0.1:1/push', REQUEST, 2000, httpRequest)).toBeNull();
  });
});
