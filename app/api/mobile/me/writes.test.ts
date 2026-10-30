import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_QUERY, toSearchParams, type Query } from '@/src/lib/input/query';

const bearer = vi.hoisted(() => ({ supabaseAsBearer: vi.fn() }));
vi.mock('../../../auth/bearer-client', () => bearer);

const keyedRpc = vi.hoisted(() => vi.fn());
vi.mock('@/app/keyed-client', () => ({ keyedClient: () => ({ rpc: keyedRpc }), NoKeyError: class extends Error {} }));
vi.mock('../../../keyed-client', () => ({ keyedClient: () => ({ rpc: keyedRpc }), NoKeyError: class extends Error {} }));

import { NOTICE_VERSION } from '@/src/lib/consent';

import { POST as editInput } from './person-input/route';
import { POST as setOn, PUT as openPool } from './participation/route';
import { POST as saveSelf } from './self-person/route';

/**
 * **앱의 열쇠 쓰기는 토큰의 사람으로만 나간다**(ADR 0211, G-64). 본문에 무엇을 실어도 사람 id 와 여덟 글자는 서버가 정한다. 가짜는
 * 토큰 클라이언트와 열쇠 문이다 — 입력 판정과 엔진은 진짜를 지난다.
 */
const QUERY: Query = { ...DEFAULT_QUERY, name: '민수', gender: 'male', date: '1990-05-15', time: '14:30' };
const body = (extra: object) => ({
  method: 'POST',
  headers: { authorization: 'Bearer token-1' },
  body: JSON.stringify(extra),
});
const at = (path: string, init: RequestInit) => new Request(`http://localhost/api/mobile/me/${path}`, init);

function signedIn() {
  const account = { signed_up_at: '2026-01-01', notice_version: NOTICE_VERSION, notice_schedule_id: 7, self_person_id: null, status: 'active' };
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'from-auth' } }, error: null })) },
    from: vi.fn(() => {
      const link = {
        select: () => link,
        update: () => link,
        eq: async () => ({ data: null, error: null }),
        maybeSingle: async () => ({ data: account, error: null }),
      };
      return link;
    }),
    rpc: vi.fn(async (name: string) =>
      name === 'current_beta_schedule'
        ? { data: [{ schedule_id: 7, ends_on: '2099-12-01', purge_by: '2099-12-31', purge_within_days: 30, operator_name: 'a', operator_officer: 'b', operator_contact: 'c' }], error: null }
        : { data: null, error: null },
    ),
  };
  bearer.supabaseAsBearer.mockReturnValue(client);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  keyedRpc.mockResolvedValue({ data: 'p-1', error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('앱의 내 사주 저장', () => {
  it('무자격이면 열쇠 문을 안 부른다', async () => {
    const answer = await saveSelf(at('self-person', { method: 'POST', body: '{}' }));

    expect(answer.status).toBe(401);
    expect(keyedRpc).not.toHaveBeenCalled();
  });

  it('사람은 Auth 의 답이다 — 본문에 실은 id · 글자는 안 쓴다', async () => {
    signedIn();

    const answer = await saveSelf(
      at('self-person', body({ query: toSearchParams(QUERY).toString(), p_user_id: 'someone-else', p_pillars: 'forged', userId: 'someone-else' })),
    );

    expect(await answer.json()).toEqual({ ok: true });
    const [name, args] = keyedRpc.mock.calls[0];
    expect(name).toBe('create_self_person');
    expect(args.p_user_id).toBe('from-auth');
    expect(JSON.stringify(args)).not.toContain('someone-else');
    expect(JSON.stringify(args)).not.toContain('forged');
  });

  it('이미 등록했으면 됐다고 답한다 — 웹과 같다', async () => {
    signedIn();
    keyedRpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'dup' } });

    expect(await (await saveSelf(at('self-person', body({ query: toSearchParams(QUERY).toString() })))).json()).toEqual({ ok: true });
  });

  it('이름이 빠진 입력은 웹과 같은 말로 거절하고 열쇠를 안 부른다', async () => {
    signedIn();
    const answer = await saveSelf(at('self-person', body({ query: toSearchParams({ ...QUERY, name: '' }).toString() })));

    expect((await answer.json()).ok).toBe(false);
    expect(keyedRpc).not.toHaveBeenCalled();
  });

  it('입력이 없으면 400 이다', async () => {
    signedIn();
    expect((await saveSelf(at('self-person', body({})))).status).toBe(400);
    expect(keyedRpc).not.toHaveBeenCalled();
  });
});

describe('입력 고치기 · 참여', () => {
  it('모양이 틀린 사람 id 는 400 이다', async () => {
    signedIn();
    expect((await editInput(at('person-input', body({ personId: 'x', query: toSearchParams(QUERY).toString() })))).status).toBe(400);
    expect(keyedRpc).not.toHaveBeenCalled();
  });

  it('참여 끄기는 토큰의 사람으로 나간다', async () => {
    signedIn();
    keyedRpc.mockResolvedValue({ data: 'off', error: null });

    expect(await (await setOn(at('participation', body({ on: false })))).json()).toEqual({ ok: true });
    expect(keyedRpc.mock.calls[0][1].p_user_id).toBe('from-auth');
  });

  it('베타가 끝나도 끄는 문은 관문에서 안 막는다 — 웹의 설정과 같다. 풀이 쪽 문은 막는다', async () => {
    const client = signedIn();
    client.rpc.mockImplementation(async (name: string) =>
      name === 'current_beta_schedule'
        ? { data: [{ schedule_id: 7, ends_on: '2020-01-01', purge_by: '2099-12-31', purge_within_days: 30, operator_name: 'a', operator_officer: 'b', operator_contact: 'c' }], error: null }
        : { data: null, error: null },
    );
    keyedRpc.mockResolvedValue({ data: 'off', error: null });

    expect((await setOn(at('participation', body({ on: false })))).status).toBe(200);
    expect((await saveSelf(at('self-person', body({ query: toSearchParams(QUERY).toString() })))).status).toBe(403);
  });

  it('켜고 끄는 값이 아니면 400 이고, 내 사주가 없는 사람의 열기는 아무것도 안 부른다', async () => {
    signedIn();
    expect((await setOn(at('participation', body({ on: 'yes' })))).status).toBe(400);
    expect(await (await openPool(at('participation', { method: 'PUT', headers: { authorization: 'Bearer token-1' } }))).json()).toEqual({ ok: true });
    expect(keyedRpc).not.toHaveBeenCalled();
  });
});
