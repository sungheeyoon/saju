import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const keyedClient = vi.fn();
const rpc = vi.fn();
const remove = vi.fn();

vi.mock('@/app/keyed-client', () => ({
  keyedClient: (...args: unknown[]) => keyedClient(...args),
}));

/** 버킷에 닿는 자리 — 여기서는 지우라고 받은 키만 본다 */
vi.mock('../../../me/photo/s3-store', () => ({
  s3PhotoStore: () => ({ put: vi.fn(), get: vi.fn(), remove: (...args: unknown[]) => remove(...args) }),
}));

const { GET } = await import('./route');

/**
 * **사진 청소기는 올바른 `CRON_SECRET` 을 든 스케줄러에게만 열리고, 저장소가 꺼진 배포에서는 DB 에도 안 닿는다.**
 *
 * 다른 크론(`../audit-export/route.test.ts`)과 같은 자격이다.
 */
const SECRET = 'cron-secret-for-test';
const KEY = 'photos/0f8b2f6e-1c2d-4e5f-8a9b-0c1d2e3f4a5b/7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918';
const request = (authorization?: string) =>
  new Request('http://localhost/api/cron/photo-sweep', {
    headers: authorization === undefined ? {} : { authorization },
  });

const STORE_ENV = ['PHOTO_STORE_BUCKET', 'PHOTO_STORE_REGION', 'PHOTO_STORE_ROLE_ARN', 'PHOTO_STORE_ACCESS_KEY_ID', 'PHOTO_STORE_SECRET_ACCESS_KEY'];

beforeEach(() => {
  keyedClient.mockReset().mockReturnValue({ rpc });
  rpc.mockReset();
  remove.mockReset().mockResolvedValue({ failed: [] });
  vi.stubEnv('CRON_SECRET', SECRET);
  for (const name of STORE_ENV) vi.stubEnv(name, '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const turnOn = () => {
  vi.stubEnv('PHOTO_STORE_BUCKET', 'saju-photos-test');
  vi.stubEnv('PHOTO_STORE_REGION', 'ap-northeast-2');
  vi.stubEnv('PHOTO_STORE_ROLE_ARN', 'arn:aws:iam::000000000000:role/saju-photo-store');
};

describe('사진 청소기', () => {
  it.each([
    ['머리가 없다', undefined],
    ['다른 비밀을 든다', 'Bearer not-the-secret'],
    ['방식이 Basic 이다', `Basic ${SECRET}`],
  ])('%s — 403 이고 열쇠를 꺼내지 않는다', async (_, authorization) => {
    turnOn();
    const response = await GET(request(authorization));

    expect(response.status).toBe(403);
    expect(keyedClient).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('저장소가 꺼졌으면 DB 에도 안 닿고 「설정 안 됨」이다', async () => {
    const response = await GET(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ configured: false });
    expect(keyedClient).not.toHaveBeenCalled();
  });

  it('켜는 값이 반쯤이면 오설정으로 500 이다 — 값은 싣지 않는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('PHOTO_STORE_BUCKET', 'saju-photos-test');

    const response = await GET(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('sweep misconfigured');
    expect(keyedClient).not.toHaveBeenCalled();
  });

  it('켜졌으면 남은 표를 옮기고 지울 줄의 두 벌을 지우고 결과를 적는다', async () => {
    turnOn();
    rpc.mockImplementation(async (name: string) => {
      if (name === 'photo_sweep_tickets') return { data: 1, error: null };
      if (name === 'photo_trash_batch') return { data: [{ object_key: KEY, attempts: 0 }], error: null };
      return { data: false, error: null };
    });

    const response = await GET(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(remove).toHaveBeenCalledWith([`${KEY}/card`, `${KEY}/large`]);
    expect(rpc).toHaveBeenCalledWith('photo_trash_settle', { p_deleted: [KEY], p_failed: [], p_error_class: '' });
    expect(await response.json()).toMatchObject({ ticketsMoved: 1, deleted: 1, failed: 0 });
  });

  it('못 지운 객체가 있으면 500 — 크론의 실패로 드러난다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    turnOn();
    remove.mockResolvedValue({ failed: [`${KEY}/large`] });
    rpc.mockImplementation(async (name: string) => {
      if (name === 'photo_sweep_tickets') return { data: 0, error: null };
      if (name === 'photo_trash_batch') return { data: [{ object_key: KEY, attempts: 0 }], error: null };
      return { data: false, error: null };
    });

    const response = await GET(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
    expect(rpc).toHaveBeenCalledWith('photo_trash_settle', { p_deleted: [], p_failed: [KEY], p_error_class: 'delete:partial' });
  });
});
