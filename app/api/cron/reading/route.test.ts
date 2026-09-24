import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const keyedClient = vi.fn();
const rpc = vi.fn();
const collect = vi.fn();

vi.mock('@/app/keyed-client', () => ({
  keyedClient: (...args: unknown[]) => keyedClient(...args),
}));

/** 가져오는 자리는 모델을 부른다 — 여기서는 불렸는지만 본다 */
vi.mock('../../../me/reading/collect', () => ({
  collectReadingResult: (...args: unknown[]) => collect(...args),
}));

const { GET } = await import('./route');

/**
 * **복구기는 올바른 `CRON_SECRET` 을 든 스케줄러에게만 열린다.**
 *
 * 이 주소는 로그인 관문 밖이라 아무나 두드릴 수 있고, 두드리면 남의 시도를 닫는다. 그동안 이 검사를
 * 든 것은 소스를 훑는 정규식 하나(`app/boundary.test.ts`)뿐이라, 조건을 「무슨 머리든 통과」로 바꿔도
 * 단위 · 타입 · 린트가 다 초록이었다. 여기서는 주소를 실제로 두드려 답과 **열쇠를 꺼냈는가**를 본다.
 */
const SECRET = 'cron-secret-for-test';
const request = (authorization?: string) =>
  new Request('http://localhost/api/cron/reading', {
    headers: authorization === undefined ? {} : { authorization },
  });

beforeEach(() => {
  keyedClient.mockReset().mockReturnValue({ rpc });
  rpc.mockReset();
  collect.mockReset();
  vi.stubEnv('CRON_SECRET', SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('복구기의 자격', () => {
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
    expect(collect).not.toHaveBeenCalled();
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

  it('올바른 비밀이면 자격을 지나 열린 일감을 줍는다', async () => {
    rpc.mockResolvedValue({
      data: [{ run_id: 'run-1', response_id: 'resp-1', overdue: false, failure_code: 'model-timeout' }],
      error: null,
    });
    collect.mockResolvedValue({ done: 'saved' });

    const response = await GET(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(keyedClient).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('open_reading_jobs');
    expect(collect).toHaveBeenCalledWith('resp-1');
    expect(await response.json()).toEqual({ open: 1, collected: 1, closed: 0 });
  });
});
