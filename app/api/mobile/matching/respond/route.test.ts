import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NOTICE_VERSION } from '@/src/lib/consent';

const bearer = vi.hoisted(() => ({ supabaseAsBearer: vi.fn() }));
vi.mock('../../../../auth/bearer-client', () => bearer);

const pipeline = vi.hoisted(() => ({ sendAcceptedMatchReading: vi.fn(async () => {}) }));
vi.mock('../../../../me/reading/pipeline', () => pipeline);

const afters = vi.hoisted(() => [] as (() => Promise<void>)[]);
vi.mock('next/server', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('next/server')),
  after: (work: () => Promise<void>) => afters.push(work),
}));

import { POST } from './route';

/**
 * **열쇠의 제출은 그 사람의 수락이 `accepted` 로 답한 뒤에만 돈다**(ADR 0211) — 열쇠 문은 요청 id 만 보므로 이 순서가 곧 자격이다. 받는 쪽인가 ·
 * pending 인가의 판정은 DB 의 것이라 여기서는 그 답마다 무엇이 나가는가를 잰다.
 */
const REQUEST = '11111111-1111-4111-8111-111111111111';
const press = (body: unknown, token: string | null = 'token-1') =>
  POST(
    new Request('http://localhost/api/mobile/matching/respond', {
      method: 'POST',
      headers: token === null ? {} : { authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),
  );

function answering(respond: { data: unknown; error: unknown }) {
  const rpc = vi.fn(async (name: string) => {
    if (name === 'respond_to_match_request') return respond;
    if (name === 'current_beta_schedule') {
      return { data: [{ schedule_id: 7, ends_on: '2099-12-01', purge_by: '2099-12-31', purge_within_days: 30, operator_name: 'a', operator_officer: 'b', operator_contact: 'c' }], error: null };
    }
    return { data: [], error: null };
  });
  bearer.supabaseAsBearer.mockReturnValue({
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } }, error: null }) },
    from: () => ({
      select: () => ({
        maybeSingle: async () => ({ data: { signed_up_at: '2026-01-01', notice_version: NOTICE_VERSION, notice_schedule_id: 7 }, error: null }),
      }),
    }),
    rpc,
  });
  return rpc;
}

const settle = async () => {
  await Promise.all(afters.splice(0).map((work) => work()));
};

beforeEach(() => {
  vi.clearAllMocks();
  afters.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('앱의 요청 답', () => {
  it('무자격이면 답도 제출도 안 나간다', async () => {
    expect((await press({ requestId: REQUEST, accept: true }, null)).status).toBe(401);
    await settle();
    expect(pipeline.sendAcceptedMatchReading).not.toHaveBeenCalled();
  });

  it('수락하면 그 요청을 응답 뒤에 떠나보낸다', async () => {
    const rpc = answering({ data: 'accepted', error: null });

    const response = await press({ requestId: REQUEST, accept: true });

    expect(await response.json()).toEqual({ ok: true, status: 'accepted' });
    expect(rpc).toHaveBeenCalledWith('respond_to_match_request', { p_request_id: REQUEST, p_accept: true });
    expect(pipeline.sendAcceptedMatchReading).not.toHaveBeenCalled();
    await settle();
    expect(pipeline.sendAcceptedMatchReading).toHaveBeenCalledWith(REQUEST);
  });

  it.each([
    ['DB 가 거절했다 — 남의 요청 · 이미 답한 요청', { data: null, error: { code: '42501', message: '받는 사람만 답할 수 있습니다.' } }],
    ['거절로 답했다', { data: 'rejected', error: null }],
    ['그 사이 무효가 됐다', { data: 'invalidated', error: null }],
    ['모르는 상태다', { data: 'what', error: null }],
  ])('%s — 제출이 안 나간다', async (_, respond) => {
    answering(respond);

    await press({ requestId: REQUEST, accept: true });
    await settle();

    expect(pipeline.sendAcceptedMatchReading).not.toHaveBeenCalled();
  });

  it.each([
    ['요청 id 가 없다', { accept: true }],
    ['모양이 틀렸다', { requestId: 'x', accept: true }],
    ['답이 참/거짓이 아니다', { requestId: REQUEST, accept: 'yes' }],
  ])('%s — 400 이고 RPC 를 안 부른다', async (_, body) => {
    const rpc = answering({ data: 'accepted', error: null });

    expect((await press(body)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalledWith('respond_to_match_request', expect.anything());
  });
});
