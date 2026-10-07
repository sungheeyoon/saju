import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const keyedClient = vi.fn();
const dispatch = vi.fn();
const later: Array<() => Promise<void>> = [];

vi.mock('@/app/keyed-client', () => ({
  keyedClient: (...args: unknown[]) => keyedClient(...args),
}));

vi.mock('./dispatch', () => ({
  dispatchPushBatch: (...args: unknown[]) => dispatch(...args),
}));

/** `after` 는 요청의 범위 밖에서 못 부른다 — 받은 일을 모아 두고 시험이 직접 돌린다 */
vi.mock('next/server', () => ({
  after: (work: () => Promise<void>) => {
    later.push(work);
  },
}));

const { POST } = await import('./route');

/**
 * **배달 문은 올바른 `PUSH_DISPATCH_SECRET` 을 든 깨움에게만 열린다.** 주소를 두드려 답과 **열쇠를 꺼냈는가**를 본다
 * — 크론 문(`app/api/cron/reading/route.test.ts`)과 같은 결이다.
 */
const SECRET = 'push-dispatch-secret-for-test';
const request = (authorization?: string) =>
  new Request('http://localhost/api/push/dispatch', {
    method: 'POST',
    headers: authorization === undefined ? {} : { authorization },
  });

beforeEach(() => {
  keyedClient.mockReset().mockReturnValue({ rpc: vi.fn() });
  dispatch.mockReset().mockResolvedValue(null);
  later.length = 0;
  vi.stubEnv('PUSH_DISPATCH_SECRET', SECRET);
  vi.stubEnv('NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY', '');
  vi.stubEnv('WEB_PUSH_VAPID_PRIVATE_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('배달 문의 자격 (ADR 0156)', () => {
  it.each([
    ['머리가 없다', undefined],
    ['다른 비밀을 든다', 'Bearer not-the-secret'],
    ['크론의 비밀 모양이다', 'Bearer cron-secret-for-test'],
    ['방식이 Basic 이다', `Basic ${SECRET}`],
    ['비밀만 들고 방식이 없다', SECRET],
  ])('%s — 401 이고 열쇠를 꺼내지 않는다', async (_, authorization) => {
    const response = await POST(request(authorization));

    expect(response.status).toBe(401);
    expect(keyedClient).not.toHaveBeenCalled();
    expect(later).toHaveLength(0);
  });

  it.each([
    ['설정되지 않았다', undefined, 'Bearer undefined'],
    ['빈 문자열이다', '', 'Bearer'],
  ])('서버의 비밀이 %s — 401 이고 열쇠를 꺼내지 않는다', async (_, secret, authorization) => {
    vi.stubEnv('PUSH_DISPATCH_SECRET', secret);

    const response = await POST(request(authorization));

    expect(response.status).toBe(401);
    expect(keyedClient).not.toHaveBeenCalled();
  });

  it('크론의 비밀로는 열리지 않는다 — 문마다 제 비밀이다', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret-for-test');
    vi.stubEnv('PUSH_DISPATCH_SECRET', undefined);

    const response = await POST(request('Bearer cron-secret-for-test'));

    expect(response.status).toBe(401);
  });

  it('올바른 비밀이면 202 로 먼저 답하고, 한 묶음을 뒤에서 보낸다', async () => {
    const response = await POST(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(202);
    expect(dispatch).not.toHaveBeenCalled();
    expect(later).toHaveLength(1);

    await later[0]();
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('VAPID 열쇠가 없으면 송신기 없이(설정 안 됨) 돈다', async () => {
    const response = await POST(request(`Bearer ${SECRET}`));
    expect(await response.json()).toEqual({ accepted: true, configured: false });

    await later[0]();
    expect(dispatch.mock.calls[0][1]).toBeNull();
  });

  it('열쇠가 없는 배포면 503 이다', async () => {
    keyedClient.mockImplementation(() => {
      throw new Error('no key');
    });

    const response = await POST(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(503);
    expect(later).toHaveLength(0);
  });
});
