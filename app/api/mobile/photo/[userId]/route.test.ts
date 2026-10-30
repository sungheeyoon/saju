import { beforeEach, describe, expect, it, vi } from 'vitest';

const bearer = vi.hoisted(() => ({ supabaseAsBearer: vi.fn() }));
vi.mock('../../../../auth/bearer-client', () => bearer);
vi.mock('../../../../auth/server-client', () => ({
  supabaseOnServer: () => {
    throw new Error('쿠키의 사람을 찾으면 안 된다');
  },
}));

import { GET } from './route';

/** **사진의 판정은 `photo_at` 하나다**(ADR 0211) — 여기서 재는 것은 그 문에 어느 사람 · 어느 자리로 묻는가와 답을 그대로 옮기는가다 */
const USER = '11111111-1111-4111-8111-111111111111';
const at = (query = '', headers: Record<string, string> = { authorization: 'Bearer token-1' }) =>
  GET(new Request(`http://localhost/api/mobile/photo/${USER}${query}`, { headers }), { params: Promise.resolve({ userId: USER }) });

function answering(answer: { data: unknown; error: unknown }) {
  const rpc = vi.fn(async () => answer);
  bearer.supabaseAsBearer.mockReturnValue({ rpc });
  return rpc;
}

beforeEach(() => vi.clearAllMocks());

describe('앱의 사진 문', () => {
  it('토큰이 없으면 없는 사람과 같은 404 이고 아무것도 안 부른다', async () => {
    expect((await at('', {})).status).toBe(404);
    expect(bearer.supabaseAsBearer).not.toHaveBeenCalled();
  });

  it('그 토큰의 사람으로 `photo_at` 에 묻고 바이트를 내준다', async () => {
    const rpc = answering({ data: [{ base64: 'AQID', content_type: 'image/webp', version: 7 }], error: null });

    const response = await at();

    expect(bearer.supabaseAsBearer).toHaveBeenCalledWith('token-1');
    expect(rpc).toHaveBeenCalledWith('photo_at', { p_user_id: USER, p_position: 1 });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
  });

  it('못 보는 사람은 404 다 — 판정은 DB 의 답이다', async () => {
    answering({ data: [], error: null });
    expect((await at()).status).toBe(404);
  });

  it.each(['PGRST301', 'PGRST302', 'PGRST303'])('토큰이 거절되면(%s) 고장이 아니라 없는 사람과 같은 404 다', async (code) => {
    answering({ data: null, error: { code, message: 'JWT expired' } });
    expect((await at()).status).toBe(404);
  });

  it('고장 난 것은 그대로 500 이다 — 원문을 안 싣는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    answering({ data: null, error: { code: 'XX000', message: 'boom' } });
    const response = await at();
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('');
  });

  it('id 모양이 틀리면 묻지 않고 404 다', async () => {
    const rpc = answering({ data: [], error: null });
    const response = await GET(new Request('http://localhost/api/mobile/photo/x', { headers: { authorization: 'Bearer token-1' } }), {
      params: Promise.resolve({ userId: "x' or 1=1" }),
    });
    expect(response.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('자리 번호를 읽고, 범위 밖이면 묻지 않는다', async () => {
    const rpc = answering({ data: [], error: null });
    await at('?n=3');
    expect(rpc).toHaveBeenCalledWith('photo_at', { p_user_id: USER, p_position: 3 });

    rpc.mockClear();
    expect((await at('?n=9')).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });
});
