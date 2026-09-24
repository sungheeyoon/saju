import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const keyedClient = vi.fn();
const rpc = vi.fn();
const s3Upload = vi.fn();

vi.mock('@/app/keyed-client', () => ({
  keyedClient: (...args: unknown[]) => keyedClient(...args),
}));

/** 버킷에 닿는 자리 — 여기서는 불렸는지만 본다 */
vi.mock('./s3', () => ({
  s3Upload: (...args: unknown[]) => s3Upload(...args),
}));

const { GET } = await import('./route');

/**
 * **접속기록 반출은 올바른 `CRON_SECRET` 을 든 스케줄러에게만 열린다.**
 *
 * 열리면 열쇠를 꺼내 DB 에 실행을 적고 버킷에 올린다. 복구기(`../reading/route.test.ts`)와 같은 자격이고,
 * 같은 까닭으로 소스를 훑는 정규식(`app/boundary.test.ts`) 말고 주소를 실제로 두드려 잰다.
 */
const SECRET = 'cron-secret-for-test';
const request = (authorization?: string) =>
  new Request('http://localhost/api/cron/audit-export', {
    headers: authorization === undefined ? {} : { authorization },
  });

beforeEach(() => {
  keyedClient.mockReset().mockReturnValue({ rpc });
  rpc.mockReset();
  s3Upload.mockReset();
  vi.stubEnv('CRON_SECRET', SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('접속기록 반출의 자격', () => {
  it.each([
    ['머리가 없다', undefined],
    ['다른 비밀을 든다', 'Bearer not-the-secret'],
    ['비밀 앞에 공백이 더 있다', `Bearer  ${SECRET}`],
    ['방식이 Basic 이다', `Basic ${SECRET}`],
    ['비밀만 들고 방식이 없다', SECRET],
  ])('%s — 403 이고 열쇠를 꺼내지 않는다', async (_, authorization) => {
    const response = await GET(request(authorization));

    expect(response.status).toBe(403);
    expect(keyedClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(s3Upload).not.toHaveBeenCalled();
  });

  /** 비밀이 없는 배포에서 `Bearer ${undefined}` 와 같은 글자를 들고 와도 열리지 않는다 */
  it.each([
    ['설정되지 않았다', undefined, 'Bearer undefined'],
    ['빈 문자열이다', '', 'Bearer'],
  ])('서버의 CRON_SECRET 이 %s — 403 이고 열쇠를 꺼내지 않는다', async (_, secret, authorization) => {
    vi.stubEnv('CRON_SECRET', secret);

    const response = await GET(request(authorization));

    expect(response.status).toBe(403);
    expect(keyedClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  /** 앞선 실행이 도는 중이라고 DB 가 답하게 해 둔다 — 자격을 지났다는 것만 보고 버킷에는 안 간다 */
  it('올바른 비밀이면 자격을 지나 실행의 시작을 적는다', async () => {
    rpc.mockReturnValue({ single: async () => ({ data: { attempt_id: 'attempt-1', busy: true }, error: null }) });

    const response = await GET(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(keyedClient).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('audit_export_begin');
    expect(await response.json()).toEqual({ busy: true });
  });
});
