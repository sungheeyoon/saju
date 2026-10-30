import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const bearer = vi.hoisted(() => ({ supabaseAsBearer: vi.fn() }));
vi.mock('../../../auth/bearer-client', () => bearer);

const pipeline = vi.hoisted(() => ({ beginReadingAs: vi.fn() }));
vi.mock('@/app/me/reading/pipeline', () => pipeline);

const views = vi.hoisted(() => ({ readingViewFor: vi.fn(), shelfViewFor: vi.fn() }));
vi.mock('./views', () => views);

const current = vi.hoisted(() => ({ lastReadingRun: vi.fn() }));
vi.mock('@/app/me/reading/current', () => current);

import { GET as readRun } from './run/route';
import { GET, POST } from './route';
import { GET as readShelf } from '../readings/route';

/**
 * **앱의 문은 자격이 없으면 아무것도 안 부른다**(ADR 0211) — `/api` 는 관문 밖이라 이 문이 자격의 전부다. 무엇을 불렀는가는 가짜
 * 클라이언트와 파이프라인으로 잰다. 판정(잠금 · 풀이권 · 정지)은 DB 의 것이라 여기서 재지 않는다(`supabase/tests/13_reading.test.sql`).
 */

const SELF = { kind: 'self' };
const KEY = '11111111-1111-4111-8111-111111111111';
const SCHEDULE = [{
  schedule_id: 7,
  ends_on: '2099-12-01',
  purge_by: '2099-12-31',
  purge_within_days: 30,
  operator_name: '운영자',
  operator_officer: '담당',
  operator_contact: 'a@b.c',
}];
const SIGNED_UP = { signed_up_at: '2026-01-01', notice_version: 'unset', notice_schedule_id: 7 };

type Answers = {
  user?: unknown;
  authError?: unknown;
  account?: unknown;
  accountError?: unknown;
  schedule?: unknown;
};

function clientAnswering({ user = { id: 'u-1' }, authError = null, account, accountError = null, schedule = SCHEDULE }: Answers = {}) {
  const rpc = vi.fn(async (name: string) => {
    if (name === 'current_beta_schedule') return { data: schedule, error: null };
    return { data: null, error: null };
  });
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: authError })) },
    from: vi.fn(() => ({ select: () => ({ maybeSingle: async () => ({ data: account, error: accountError }) }) })),
    rpc,
  };
  bearer.supabaseAsBearer.mockReturnValue(client);
  return client;
}

/** 안내 판본을 맞춰 든 계정 — 지금 판본은 코드가 든다 */
async function signedUp() {
  const { NOTICE_VERSION } = await import('@/src/lib/consent');
  return { ...SIGNED_UP, notice_version: NOTICE_VERSION };
}

const asApp = (url: string, init: RequestInit = {}, token: string | null = 'token-1') =>
  new Request(`http://localhost${url}`, {
    ...init,
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
  });

const press = (body: unknown, token: string | null = 'token-1') =>
  POST(asApp('/api/mobile/reading', { method: 'POST', body: JSON.stringify(body) }, token));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('자격', () => {
  it.each([
    ['머리가 없다', null],
    ['Bearer 뒤가 비었다', ''],
  ])('%s — 401 이고 클라이언트를 짓지도 않는다', async (_, token) => {
    const response = await press({ target: SELF, requestKey: KEY }, token);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ refused: 'sign-in' });
    expect(bearer.supabaseAsBearer).not.toHaveBeenCalled();
    expect(pipeline.beginReadingAs).not.toHaveBeenCalled();
  });

  it('Auth 가 토큰을 거절하면 401 이다 — 끊긴 세션 · 지워진 계정', async () => {
    clientAnswering({ user: null, authError: new AuthApiError('bad jwt', 403, 'bad_jwt') });

    const response = await press({ target: SELF, requestKey: KEY });

    expect(response.status).toBe(401);
    expect(pipeline.beginReadingAs).not.toHaveBeenCalled();
  });

  it('Auth 에 못 닿으면 닫고 503 이다 — 로그아웃시키지 않는다', async () => {
    clientAnswering({ user: null, authError: new AuthRetryableFetchError('down', 503) });

    const response = await press({ target: SELF, requestKey: KEY });

    expect(response.status).toBe(503);
    expect((await response.json()).refused).toBe('unavailable');
    expect(pipeline.beginReadingAs).not.toHaveBeenCalled();
  });

  it('토큰을 그 사람의 클라이언트에 싣는다', async () => {
    clientAnswering({ account: await signedUp() });
    pipeline.beginReadingAs.mockResolvedValue({ ok: true, started: true });

    await press({ target: SELF, requestKey: KEY }, 'token-of-this-person');

    expect(bearer.supabaseAsBearer).toHaveBeenCalledWith('token-of-this-person');
  });
});

describe('관문 — 웹과 같은 `gateFor`', () => {
  it('계정을 못 읽으면 닫는다 — 웹은 지나가게 두지만 이 문 뒤는 곧 비용이다', async () => {
    clientAnswering({ account: null, accountError: { code: '500', message: 'x' } });

    const response = await press({ target: SELF, requestKey: KEY });

    expect(response.status).toBe(503);
    expect(pipeline.beginReadingAs).not.toHaveBeenCalled();
  });

  it('가입 전이면 403 signup 이고 시도를 안 연다', async () => {
    clientAnswering({ account: { signed_up_at: null, notice_version: null, notice_schedule_id: null } });

    const response = await press({ target: SELF, requestKey: KEY });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ refused: 'signup' });
    expect(pipeline.beginReadingAs).not.toHaveBeenCalled();
  });

  it('안내 판본이 바뀌었으면 가입을 마친 사람도 403 signup 이다', async () => {
    clientAnswering({ account: { ...SIGNED_UP, notice_version: 'old-version' } });

    expect((await press({ target: SELF, requestKey: KEY })).status).toBe(403);
    expect(pipeline.beginReadingAs).not.toHaveBeenCalled();
  });

  it('베타가 끝났으면 403 closed 다', async () => {
    clientAnswering({ account: await signedUp(), schedule: [{ ...SCHEDULE[0], ends_on: '2020-01-01' }] });

    const response = await press({ target: SELF, requestKey: KEY });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ refused: 'closed' });
  });
});

describe('누름', () => {
  it('자격을 지나면 같은 대상 · 같은 열쇠로 그 사람의 클라이언트가 파이프라인을 탄다', async () => {
    const client = clientAnswering({ account: await signedUp() });
    pipeline.beginReadingAs.mockResolvedValue({ ok: true, started: true });

    const response = await press({ target: SELF, requestKey: KEY });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, started: true });
    expect(pipeline.beginReadingAs).toHaveBeenCalledWith(client, SELF, KEY);
    expect(client.rpc).toHaveBeenCalledWith('touch_activity');
  });

  it('궁합 대상도 같은 문을 지난다', async () => {
    const client = clientAnswering({ account: await signedUp() });
    pipeline.beginReadingAs.mockResolvedValue({ ok: true, started: false });
    const target = { kind: 'private', personA: KEY, personB: '22222222-2222-4222-8222-222222222222' };

    await press({ target, requestKey: KEY });

    expect(pipeline.beginReadingAs).toHaveBeenCalledWith(client, target, KEY);
  });

  it('DB 의 거절은 값으로 그대로 옮긴다 — 풀이권 표지까지', async () => {
    clientAnswering({ account: await signedUp() });
    const refused = { ok: false, message: '풀이권을 다 쓰셨습니다.', outOfCredits: true };
    pipeline.beginReadingAs.mockResolvedValue(refused);

    const response = await press({ target: SELF, requestKey: KEY });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(refused);
  });

  it.each([
    ['대상이 없다', { requestKey: KEY }],
    ['모르는 갈래', { target: { kind: 'all' }, requestKey: KEY }],
    ['id 모양이 틀렸다', { target: { kind: 'person', personId: "1' or 1=1" }, requestKey: KEY }],
    ['누름 열쇠가 없다', { target: SELF }],
    ['누름 열쇠의 모양이 틀렸다', { target: SELF, requestKey: 'again' }],
  ])('%s — 400 이고 시도를 안 연다', async (_, body) => {
    clientAnswering({ account: await signedUp() });

    expect((await press(body)).status).toBe(400);
    expect(pipeline.beginReadingAs).not.toHaveBeenCalled();
  });

  it('던지면 우리말로 답한다 — 원문을 싣지 않는다', async () => {
    clientAnswering({ account: await signedUp() });
    pipeline.beginReadingAs.mockRejectedValue(new Error('relation does not exist'));

    const response = await press({ target: SELF, requestKey: KEY });

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('relation');
  });
});

describe('읽는 문', () => {
  it('기다리는 물음은 활동이 아니고 모델을 안 부른다', async () => {
    const client = clientAnswering({ account: await signedUp() });
    const run = { status: 'running', failureCode: null, createdAt: 'x', progress: null };
    current.lastReadingRun.mockResolvedValue(run);

    const response = await readRun(asApp('/api/mobile/reading/run?kind=self'));

    expect(await response.json()).toEqual({ run });
    expect(current.lastReadingRun).toHaveBeenCalledWith(SELF, client);
    expect(client.rpc).not.toHaveBeenCalledWith('touch_activity');
    expect(pipeline.beginReadingAs).not.toHaveBeenCalled();
  });

  it('무자격이면 세 문 다 401 이다', async () => {
    for (const door of [
      GET(asApp('/api/mobile/reading?kind=self', {}, null)),
      readRun(asApp('/api/mobile/reading/run?kind=self', {}, null)),
      readShelf(asApp('/api/mobile/readings', {}, null)),
    ]) {
      expect((await door).status).toBe(401);
    }
    expect(views.readingViewFor).not.toHaveBeenCalled();
    expect(views.shelfViewFor).not.toHaveBeenCalled();
    expect(current.lastReadingRun).not.toHaveBeenCalled();
  });

  it('내 목록에 없는 사람은 404 다', async () => {
    clientAnswering({ account: await signedUp() });
    views.readingViewFor.mockResolvedValue(null);

    const response = await GET(asApp(`/api/mobile/reading?kind=person&personId=${KEY}`));

    expect(response.status).toBe(404);
  });

  it('주소의 쿼리에서 대상을 되읽는다', async () => {
    const client = clientAnswering({ account: await signedUp() });
    views.readingViewFor.mockResolvedValue({ view: 'no-self' });

    await GET(asApp(`/api/mobile/reading?kind=match&matchId=${KEY}`));

    expect(views.readingViewFor).toHaveBeenCalledWith(client, { kind: 'match', matchId: KEY });
  });
});
