import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const rpc = vi.fn();
const getClaims = vi.fn();

vi.mock('../../../auth/server-client', () => ({
  supabaseOnServer: async () => ({ rpc, auth: { getClaims } }),
}));

const { POST } = await import('./route');

const ORIGIN = 'http://localhost:3000';
const KEYS = {
  p256dh: Buffer.alloc(65, 4).toString('base64url'),
  auth: Buffer.alloc(16, 1).toString('base64url'),
};
const post = (body: object, origin = ORIGIN) =>
  new Request(`${ORIGIN}/me/push/subscription`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

/**
 * **서비스 워커의 다시 남기기** — 받는 푸시 서비스만, 로그인이 없으면 401(DB 실패로 적지 않는다)(ADR 0156).
 */
describe('바뀐 구독을 다시 남기는 주소', () => {
  let logged: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: null, error: null });
    getClaims.mockReset().mockResolvedValue({ data: { claims: { sub: 'u-1' } }, error: null });
    logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    logged.mockRestore();
    vi.unstubAllEnvs();
  });

  it('알려진 푸시 서비스의 구독은 남긴다 — 옛 endpoint 를 먼저 지운다', async () => {
    const answer = await POST(
      post({ oldEndpoint: 'https://fcm.googleapis.com/fcm/send/old', endpoint: 'https://fcm.googleapis.com/fcm/send/new', ...KEYS }),
    );
    expect(answer.status).toBe(204);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(['remove_push_subscription', 'save_push_subscription']);
  });

  it('모르는 푸시 서비스는 400 이고 DB 에 닿지 않는다', async () => {
    const answer = await POST(post({ endpoint: 'https://evil.example/push', ...KEYS }));
    expect(answer.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('다른 출처는 403 이다', async () => {
    const answer = await POST(post({ endpoint: 'https://fcm.googleapis.com/fcm/send/new', ...KEYS }, 'https://evil.example'));
    expect(answer.status).toBe(403);
  });

  it('로그인이 없으면 DB 에 가지 않고 401 이다', async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    const answer = await POST(post({ endpoint: 'https://fcm.googleapis.com/fcm/send/new', ...KEYS }));
    expect(answer.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
  });

  it('DB 가 사람을 못 읽으면(28000) 401 이고 DB 실패로 적지 않는다', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '28000', message: '로그인이 필요해요.' } });
    const answer = await POST(
      post({ oldEndpoint: 'https://fcm.googleapis.com/fcm/send/old', endpoint: 'https://fcm.googleapis.com/fcm/send/new', ...KEYS }),
    );
    expect(answer.status).toBe(401);
    expect(logged).not.toHaveBeenCalled();

    const fresh = await POST(post({ endpoint: 'https://fcm.googleapis.com/fcm/send/new', ...KEYS }));
    expect(fresh.status).toBe(401);
    expect(logged).not.toHaveBeenCalled();
  });

  it('그 밖의 DB 실패는 503 이고 기록에 남긴다', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '57014', message: 'timeout' } });
    const answer = await POST(post({ endpoint: 'https://fcm.googleapis.com/fcm/send/new', ...KEYS }));
    expect(answer.status).toBe(503);
    expect(logged).toHaveBeenCalled();
  });
});
