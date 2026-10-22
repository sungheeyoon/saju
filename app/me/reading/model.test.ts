import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **기다리는 길(`callModel`)이 SDK 에 무엇을 넘기나** — 모델은 안 부른다. `generateText` 만 가짜로 두고 받은 인자를 본다.
 *
 * 재는 것은 하나다 — 숨은 재시도. SDK 의 `generateText` 는 실패하면 기본 두 번 더 보낸다. 로그인 전 사주 문단은 시도 수를 DB 가
 * 예약으로 세므로(`taste_attempt_limit()`) 그 길만 `maxRetries: 0` 을 넘기고, 넘기지 않은 길은 SDK 기본값 그대로여야 한다.
 */
const generateText = vi.fn();
vi.mock('ai', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('ai')),
  generateText: (...args: unknown[]) => generateText(...args),
}));

const { callModel, retrieveBackgroundReading } = await import('./model');

beforeEach(() => {
  generateText.mockReset();
  generateText.mockResolvedValue({ output: { markdown: '글' }, usage: {}, response: { modelId: 'gpt-check' } });
});

describe('숨은 재시도', () => {
  it('`maxRetries: 0` 을 넘기면 SDK 에 그대로 간다 — 예약 하나에 모델 호출 하나', async () => {
    await callModel('프롬프트', { maxRetries: 0 });
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(generateText.mock.calls[0][0]).toMatchObject({ maxRetries: 0 });
  });

  it('넘기지 않으면 싣지 않는다 — 운영 풀이 길의 기본값은 그대로다', async () => {
    await callModel('프롬프트');
    expect(generateText.mock.calls[0][0]).not.toHaveProperty('maxRetries');
  });
});

/**
 * **회수 조회의 상한 — 10초 · 다시 1번, 안 닿은 것은 실패가 아니다**(ADR 0201). 가짜는 OpenAI 의 HTTP(`fetch`)뿐이고 SDK 는
 * 진짜다 — 상한과 다시 보내기는 SDK 가 하므로 그것을 지나야 잰다.
 */
describe('회수 조회', () => {
  let calls = 0;

  const stub = (answer: (init?: RequestInit) => Promise<Response>) => {
    calls = 0;
    vi.stubGlobal('fetch', vi.fn(async (_: unknown, init?: RequestInit) => {
      calls += 1;
      return answer(init);
    }));
  };

  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('provider 의 일시 장애(503)는 한 번 더 보내고, 그래도 안 되면 실패가 아니라 「안 닿음」이다', async () => {
    stub(async () => Response.json({ error: { message: 'overloaded' } }, { status: 503 }));

    await expect(retrieveBackgroundReading('resp_1')).resolves.toMatchObject({ ok: 'unreachable' });
    expect(calls).toBe(2);
  });

  it('망이 끊기면 한 번 더 보내고 「안 닿음」이다', async () => {
    stub(async () => {
      throw new TypeError('fetch failed');
    });

    await expect(retrieveBackgroundReading('resp_1')).resolves.toMatchObject({ ok: 'unreachable' });
    expect(calls).toBe(2);
  });

  it('답이 10초 안에 안 오면 끊고, 한 번 더 기다린 뒤 「안 닿음」이다 — SDK 기본 10분을 안 기다린다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    stub((init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));

    const answered = retrieveBackgroundReading('resp_1');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000 + 10_000);

    await expect(answered).resolves.toMatchObject({ ok: 'unreachable' });
    expect(calls).toBe(2);
  });

  it('머리(200)가 와도 본문이 10초 안에 안 끝나면 끊는다 — 상한은 본문 읽기까지 덮는다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    stub(async () => new Response(new ReadableStream({ start() {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const answered = retrieveBackgroundReading('resp_1');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000 + 10_000);

    await expect(answered).resolves.toMatchObject({ ok: 'unreachable' });
    expect(calls).toBe(2);
  });

  it('다시 해도 같은 거절(404)은 지금처럼 실패로 닫는다 — 다시 보내지 않는다', async () => {
    stub(async () => Response.json({ error: { message: 'No response found' } }, { status: 404 }));

    await expect(retrieveBackgroundReading('resp_1')).resolves.toMatchObject({
      ok: false,
      code: 'model-retrieve-failed',
      usage: null,
    });
    expect(calls).toBe(1);
  });
});
