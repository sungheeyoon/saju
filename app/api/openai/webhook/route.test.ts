import { createHmac, randomBytes } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 응답 뒤의 일 — **모아 두고 시험이 기다린다.** 곧바로 돌리면 시험이 그 일보다 먼저 끝나 아무것도 안 잰다
 * (`app/me/reading/pipeline.test.ts` 와 같은 자리). 모아 두면 「응답 전에는 회수가 안 돌았다」도 잴 수 있다.
 */
const pending: (() => Promise<void>)[] = [];
vi.mock('next/server', () => ({
  after: (work: () => Promise<void>) => {
    pending.push(work);
  },
}));

const keyedClient = vi.fn();
const rpc = vi.fn();
const collect = vi.fn();

vi.mock('@/app/keyed-client', () => ({
  keyedClient: (...args: unknown[]) => keyedClient(...args),
}));

/** 가져오는 자리는 모델을 부른다 — 여기서는 무엇으로 불렸는지만 본다 */
vi.mock('../../../me/reading/collect', () => ({
  collectReadingResult: (...args: unknown[]) => collect(...args),
}));

const { POST } = await import('./route');

/**
 * **OpenAI 가 두드리는 문을 실제로 두드린다.**
 *
 * 그동안 이 라우트를 든 것은 소스를 훑는 정규식(`app/me/reading/boundary.test.ts` — 「자격을 묻는 이름이 있다」 ·
 * 「`after(` 앞에 회수가 없다」)뿐이었다. 서명 검증의 답을 버리고 지나가게 바꿔도 이름은 그대로라 초록이었다
 * (2026-09-28 밤샘 감사 「안 고친 것 — 시험」). 여기서는 **진짜 서명**(Standard Webhooks — `webhook-id.timestamp.body`
 * 의 HMAC-SHA256, SDK 의 `webhooks.unwrap` 이 그대로 푼다)을 지어 보내고, 답과 **열쇠를 꺼냈는가 · 무엇을 적었는가 ·
 * 응답 뒤에 무엇을 했는가**를 본다. 서명을 푸는 코드(`verifyReadingWebhook`)는 가짜로 바꾸지 않는다.
 */
const SECRET = `whsec_${randomBytes(24).toString('base64')}`;

/** `sent` 는 실제로 보내는 본문이다 — 없으면 서명한 본문(`body`) 그대로 */
type Signed = {
  body?: string;
  sent?: string;
  secret?: string;
  at?: number;
  id?: string;
  drop?: 'webhook-signature' | 'webhook-id';
};

function event(type = 'response.completed', responseId = 'resp_abc') {
  return JSON.stringify({ id: 'evt_123', object: 'event', type, created_at: 1790000000, data: { id: responseId } });
}

function signedRequest({
  body = event(),
  sent = body,
  secret = SECRET,
  at = Math.floor(Date.now() / 1000),
  id = 'msg_1',
  drop,
}: Signed = {}) {
  const key = secret.startsWith('whsec_') ? Buffer.from(secret.slice('whsec_'.length), 'base64') : Buffer.from(secret);
  const signature = createHmac('sha256', key).update(`${id}.${at}.${body}`).digest('base64');
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'webhook-id': id,
    'webhook-timestamp': String(at),
    'webhook-signature': `v1,${signature}`,
  };
  if (drop) delete headers[drop];
  return new Request('http://localhost/api/openai/webhook', { method: 'POST', headers, body: sent });
}

const runAfter = async () => {
  const works = pending.splice(0);
  for (const work of works) await work();
};

beforeEach(() => {
  pending.length = 0;
  keyedClient.mockReset().mockReturnValue({ rpc });
  rpc.mockReset();
  collect.mockReset();
  vi.stubEnv('OPENAI_API_KEY', 'sk-test-not-used');
  vi.stubEnv('OPENAI_WEBHOOK_SECRET', SECRET);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('서명이 자격이다', () => {
  it.each<[string, Signed]>([
    ['다른 비밀로 서명했다', { secret: `whsec_${randomBytes(24).toString('base64')}` }],
    ['서명한 뒤 본문이 바뀌었다', { sent: event('response.completed', 'resp_other') }],
    ['서명 머리가 없다', { drop: 'webhook-signature' }],
    ['사건 id 머리가 없다', { drop: 'webhook-id' }],
    ['다섯 분보다 오래됐다', { at: Math.floor(Date.now() / 1000) - 301 }],
  ])('%s — 401 이고 열쇠를 꺼내지 않는다', async (_, signed) => {
    const response = await POST(signedRequest(signed));

    expect(response.status).toBe(401);
    expect(keyedClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(pending).toEqual([]);
  });

  /** 답은 설정 상태를 말하지 않는다(G-23 ⑧) — 까닭은 기록에만 간다 */
  it('서버에 서명 비밀이 없어도 401 이고, 답에 그 까닭이 안 실린다', async () => {
    vi.stubEnv('OPENAI_WEBHOOK_SECRET', '');

    const response = await POST(signedRequest());

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('invalid signature');
    expect(keyedClient).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  /** 우리가 아는 것은 `response.*` 뿐이다 — 다른 사건은 영수증에 안 적는다 */
  it('서명이 맞아도 response 사건이 아니면 적지 않는다', async () => {
    const response = await POST(signedRequest({ body: event('batch.completed') }));

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('서명이 맞으면 — 적고 · 204 · 회수는 응답 뒤에', () => {
  it('영수증에 사건 · 응답 id · 종류를 적고, 처음 온 사건이면 응답 뒤에 그 응답을 가져와 집었다고 적는다', async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: null, error: null });
    collect.mockResolvedValue({ done: 'saved' });

    const response = await POST(signedRequest({ body: event('response.completed', 'resp_abc') }));

    expect(response.status).toBe(204);
    expect(keyedClient).toHaveBeenCalledWith('webhook 영수증');
    expect(rpc).toHaveBeenNthCalledWith(1, 'record_reading_webhook_event', {
      p_event_id: 'evt_123',
      p_response_id: 'resp_abc',
      p_event_type: 'response.completed',
    });
    // 응답을 낸 시점에는 아직 회수가 안 돌았다 — 무거운 일은 2xx 뒤다
    expect(collect).not.toHaveBeenCalled();
    expect(pending).toHaveLength(1);

    await runAfter();

    expect(collect).toHaveBeenCalledWith('resp_abc');
    expect(rpc).toHaveBeenNthCalledWith(2, 'mark_reading_webhook_processed', { p_event_id: 'evt_123' });
  });

  /** 재전송은 정상이다 — 두 번 집으면 회수도 두 번 돈다. 판정은 DB 가 한다 */
  it('이미 적힌 사건이면 204 로 답하고 다시 집지 않는다', async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });

    const response = await POST(signedRequest());

    expect(response.status).toBe(204);
    expect(pending).toEqual([]);
    expect(collect).not.toHaveBeenCalled();
  });

  /** 아직 도는 중이면 그 사건으로 할 일이 남았다 — 집었다고 안 적는다 */
  it('가져온 응답이 아직 도는 중이면 집었다고 적지 않는다', async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    collect.mockResolvedValue({ done: 'pending' });

    await POST(signedRequest());
    await runAfter();

    expect(collect).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe('적지 못하면 5xx — 재전송을 부른다', () => {
  it('열쇠가 없으면 503 이다', async () => {
    keyedClient.mockImplementation(() => {
      throw new Error('SUPABASE_SECRET_KEY 가 없다');
    });

    const response = await POST(signedRequest());

    expect(response.status).toBe(503);
    expect(pending).toEqual([]);
  });

  it('영수증을 못 적으면 503 이고 DB 원문은 답에 안 실린다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42883', message: 'function public.record_reading_webhook_event does not exist' } });

    const response = await POST(signedRequest());

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('could not record');
    expect(pending).toEqual([]);
    expect(collect).not.toHaveBeenCalled();
  });
});
