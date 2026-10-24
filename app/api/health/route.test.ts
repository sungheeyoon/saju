import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Answer = { error: { code?: string; message: string } | null };

const calls: string[] = [];
let answer: () => Promise<Answer> = async () => ({ error: null });
let env: () => { url: string; publishableKey: string } = () => ({ url: 'http://127.0.0.1:54321', publishableKey: 'anon' });

vi.mock('server-only', () => ({}));
vi.mock('@/app/auth/config', () => ({ supabaseEnv: () => env() }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc(name: string) {
      calls.push(name);
      return { abortSignal: () => answer() };
    },
  }),
}));

const { GET } = await import('./route');

beforeEach(() => {
  calls.length = 0;
  answer = async () => ({ error: null });
  env = () => ({ url: 'http://127.0.0.1:54321', publishableKey: 'anon' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('GET /api/health — 바깥 감시의 판정 (G-118)', () => {
  it('DB 의 공개 문이 답하면 200 · ok 이고 캐시하지 않는다', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(calls).toEqual(['current_beta_schedule']);
  });

  it('DB 가 오류를 내면 503 이고, 답에는 오류 문장이 없다', async () => {
    answer = async () => ({ error: { code: 'PGRST301', message: 'secret detail' } });

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(body)).toEqual({ status: 'unavailable' });
    expect(body).not.toContain('secret detail');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('접속값이 없으면 503', async () => {
    env = () => {
      throw new Error('Supabase 접속값이 없습니다');
    };

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
  });

  it('DB 가 5초 안에 답하지 않으면 끊고 503 — 함수 한도(10초)보다 먼저', async () => {
    vi.useFakeTimers();
    answer = () => new Promise<Answer>(() => {});

    const pending = GET();
    await vi.advanceTimersByTimeAsync(5000);
    const response = await pending;

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
  });

  it('4.9초에 답하면 200 이다 — 끊는 시각은 5초다', async () => {
    vi.useFakeTimers();
    answer = () => new Promise<Answer>((resolve) => setTimeout(() => resolve({ error: null }), 4900));

    const pending = GET();
    await vi.advanceTimersByTimeAsync(4900);
    const response = await pending;

    expect(response.status).toBe(200);
  });
});
