import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NOTICE_VERSION } from '@/src/lib/consent';

const bearer = vi.hoisted(() => ({ supabaseAsBearer: vi.fn() }));
vi.mock('../../../../auth/bearer-client', () => bearer);

const store = vi.hoisted(() => ({ ready: true, put: vi.fn(async () => undefined) }));
vi.mock('@/app/me/photo/s3-store', () => ({ photoStoreIfReady: () => (store.ready ? { put: store.put } : null) }));
vi.mock('@/app/me/photo/store-env', () => ({ photoStoreIsOn: () => store.ready }));

const checked = vi.hoisted(() => ({ result: { ok: true, type: 'image/jpeg' } as object }));
vi.mock('@/src/lib/profile', async (original) => ({
  ...(await original<typeof import('@/src/lib/profile')>()),
  checkVariants: () => checked.result,
}));

import { GET, POST, PUT } from './route';

const KEY = 'photos/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002';

function signedIn(answers: Record<string, unknown> = {}, account: object | null = { signed_up_at: '2026-01-01', notice_version: NOTICE_VERSION, notice_schedule_id: 7 }) {
  const rpc = vi.fn(async (name: string, ..._args: object[]) => {
    if (name === 'current_beta_schedule') {
      return { data: [{ schedule_id: 7, ends_on: '2099-12-01', purge_by: '2099-12-31', purge_within_days: 30, operator_name: 'a', operator_officer: 'b', operator_contact: 'c' }], error: null };
    }
    if (name in answers) return answers[name] as { data: unknown; error: null };
    return { data: null, error: null };
  });
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'from-auth' } }, error: null })) },
    from: () => {
      const link = { select: () => link, maybeSingle: async () => ({ data: account, error: null }) };
      return link;
    },
    rpc,
  };
  bearer.supabaseAsBearer.mockReturnValue(client);
  return { rpc };
}

const photoForm = (extra: Record<string, string> = {}) => {
  const form = new FormData();
  form.set('card', new Blob([new Uint8Array([1])]));
  form.set('large', new Blob([new Uint8Array([2])]));
  for (const [name, value] of Object.entries(extra)) form.set(name, value);
  return form;
};

const at = (method: string, form?: FormData, token: string | null = 'token-1', length: string | null = '1000') =>
  new Request('http://localhost/api/mobile/me/photo', {
    method,
    headers: {
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
      ...(form === undefined || length === null ? {} : { 'content-length': length }),
    },
    ...(form === undefined ? {} : { body: form }),
  });

const namesCalled = (rpc: ReturnType<typeof signedIn>['rpc']) => rpc.mock.calls.map(([name]) => name);

describe('앱이 저장소에 사진을 올리는 문 (ADR 0211 추기)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.ready = true;
    checked.result = { ok: true, type: 'image/jpeg' };
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it.each([['GET', GET], ['POST', POST], ['PUT', PUT]] as const)('%s — 토큰이 없으면 아무것도 안 부르고 401 이다', async (method, door) => {
    const { rpc } = signedIn();
    const response = await door(at(method, method === 'GET' ? undefined : photoForm(), null));
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
    expect(store.put).not.toHaveBeenCalled();
  });

  it('가입을 안 마쳤으면 저장소에 안 쓴다', async () => {
    const { rpc } = signedIn({}, { signed_up_at: null, notice_version: null, notice_schedule_id: null });
    const response = await POST(at('POST', photoForm()));
    expect(response.status).toBe(403);
    expect(store.put).not.toHaveBeenCalled();
    expect(namesCalled(rpc)).not.toContain('begin_my_photo_upload');
  });

  it('더하기 — 표를 받고 두 벌을 쓰고 그 사람의 문으로 적는다', async () => {
    const { rpc } = signedIn({ begin_my_photo_upload: { data: KEY, error: null }, add_my_photo_object: { data: 2, error: null } });
    const response = await POST(at('POST', photoForm()));
    expect(await response.json()).toEqual({ ok: true, placed: true });
    expect(store.put).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith('add_my_photo_object', { p_object_key: KEY, p_content_type: 'image/jpeg' });
  });

  it('바꾸기 — 화면이 본 자리 · 판본을 넘기고 새 판본을 답한다', async () => {
    const { rpc } = signedIn({ begin_my_photo_upload: { data: KEY, error: null }, replace_my_photo_object: { data: 77, error: null } });
    const response = await PUT(at('PUT', photoForm({ position: '3', version: '9' })));
    expect(await response.json()).toEqual({ ok: true, version: 77, placed: true });
    expect(rpc).toHaveBeenCalledWith('replace_my_photo_object', { p_position: 3, p_version: 9, p_object_key: KEY, p_content_type: 'image/jpeg' });
  });

  it('두 벌이 틀리면 DB 에도 저장소에도 안 닿는다', async () => {
    checked.result = { ok: false, message: '거절' };
    const { rpc } = signedIn();
    expect(await (await POST(at('POST', photoForm()))).json()).toEqual({ ok: false, message: '거절', placed: false });
    expect(store.put).not.toHaveBeenCalled();
    expect(namesCalled(rpc)).not.toContain('begin_my_photo_upload');
  });

  it('저장소에 못 쓰면 적지 않고 표를 넘긴다 — 닫힌다', async () => {
    store.put.mockRejectedValueOnce(new Error('s3'));
    const { rpc } = signedIn({ begin_my_photo_upload: { data: KEY, error: null } });
    const answer = await (await POST(at('POST', photoForm()))).json();
    expect(answer.ok).toBe(false);
    expect(namesCalled(rpc)).toContain('drop_my_photo_upload');
    expect(namesCalled(rpc)).not.toContain('add_my_photo_object');
  });

  it('저장소가 꺼졌으면 올리지 않고, 길은 멈춘 것으로 답한다', async () => {
    store.ready = false;
    const { rpc } = signedIn({ photo_upload_mode: { data: 's3', error: null } });
    expect((await (await POST(at('POST', photoForm()))).json()).ok).toBe(false);
    expect(namesCalled(rpc)).not.toContain('begin_my_photo_upload');
    expect(await (await GET(at('GET'))).json()).toEqual({ mode: 'paused' });
  });

  it.each([
    ['1MB 를 넘으면', String(1024 * 1024 + 1), 413],
    ['길이를 안 밝히면', null, 411],
    ['길이가 숫자가 아니면', '12x', 411],
  ])('%s 본문을 안 읽고 거절한다', async (_name, length, status) => {
    const { rpc } = signedIn();
    const request = at('POST', photoForm(), 'token-1', length);
    const reading = vi.spyOn(request, 'formData');
    expect((await POST(request)).status).toBe(status);
    expect(reading).not.toHaveBeenCalled();
    expect(store.put).not.toHaveBeenCalled();
    expect(namesCalled(rpc)).not.toContain('begin_my_photo_upload');
  });

  it('딱 1MB 는 받는다', async () => {
    signedIn({ begin_my_photo_upload: { data: KEY, error: null }, add_my_photo_object: { data: 2, error: null } });
    expect((await POST(at('POST', photoForm(), 'token-1', String(1024 * 1024)))).status).toBe(200);
  });

  it.each([
    [{ position: 'x', version: '9' }],
    [{ position: '3', version: 'NaN' }],
    [{ position: '7', version: '9' }],
    [{ position: '3' }],
    [{ version: '9' }],
  ])('바꾸기의 자리 · 판본이 숫자가 아니면 표를 안 쓰고 400 이다 — %j', async (extra) => {
    const { rpc } = signedIn();
    expect((await PUT(at('PUT', photoForm(extra as Record<string, string>)))).status).toBe(400);
    expect(store.put).not.toHaveBeenCalled();
    expect(namesCalled(rpc)).not.toContain('begin_my_photo_upload');
  });

  it('폼이 아니면 400 이다', async () => {
    signedIn();
    const response = await POST(new Request('http://localhost/api/mobile/me/photo', { method: 'POST', headers: { authorization: 'Bearer token-1', 'content-type': 'application/json', 'content-length': '2' }, body: '{}' }));
    expect(response.status).toBe(400);
  });
});
