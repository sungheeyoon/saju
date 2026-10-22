import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **떠나보냈는데 답을 못 받은 제출 — provider 는 받았고 우리는 모른다**(ADR 0020).
 *
 * `submitBackgroundReading` 이 `responses.create({ background: true, stream: true })` 를 낸 뒤 응답 머리가 오기 전에 망이 끊기면,
 * provider 쪽에는 응답이 섰고(토큰이 나간다) 우리 쪽에는 이름표가 없다. 이 파일은 그 갈래가 **누름 → 제출 → webhook 의 회수 →
 * 복구기**를 지나 어디에 닿는지를 끝까지 잰다. 가짜는 셋이다 — OpenAI 의 HTTP(`fetch`), 일감의 상태(아래 `db` — 열쇠 문들이
 * 마이그레이션에서 하는 전이를 그대로 옮겼다), 세션. 모델을 부르는 자리(`model.ts`) · 파이프라인 · 회수 · 복구기는 진짜다.
 *
 * 망은 「provider 가 받아 응답을 세운 뒤 연결이 끊긴다」로 끊는다 — 클라이언트는 그것과 「안 닿았다」를 가를 수 없다.
 */

const rpc = vi.fn();

vi.mock('../../auth/server-client', () => ({
  supabaseOnServer: async () => ({ rpc }),
}));

const keyedRpc = vi.fn();
class NoKeyError extends Error {}
vi.mock('../../keyed-client', () => ({
  keyedClient: () => ({ rpc: keyedRpc }),
  NoKeyError,
}));

const pending: Promise<unknown>[] = [];
vi.mock('next/server', () => ({
  after: (work: () => Promise<void>) => {
    pending.push(work());
  },
}));

vi.mock('../../taste/taste-carry', () => ({ claimedTaste: async () => null }));
vi.mock('../../taste/keyed-taste-claims', () => ({
  linkTasteReadingRun: async () => null,
  tasteContinuationOfRun: async () => null,
}));
vi.mock('../../taste/taste-visitor', () => ({ forgetTasteClaim: async () => undefined }));
vi.mock('../../taste/keyed-taste', () => ({ countTasteStep: async () => undefined }));
vi.mock('../../request-error', () => ({ reportRequestError: async () => undefined }));

const { beginReading } = await import('./pipeline');
const { collectReadingResult } = await import('./collect');
const { GET: recover } = await import('../../api/cron/reading/route');

const BIRTH = {
  calendar: 'solar',
  original_date: '1990-05-12',
  solar_date: '1990-05-12',
  birth_time: '14:30:00',
  gender: 'male',
  city: '부산',
  late_night_rule: 'jo',
  time_basis: 'localMean',
};

const GOOD = `## 한 줄로\n${'스스로 정한 규칙 안에서 오래 버티는 사람입니다. '.repeat(20)}`;
const METAPHOR = '결정은 빠르지만 끝에서 다시 확인해 완성에서 강해지는 사람';
const USAGE = { input_tokens: 1200, output_tokens: 800, total_tokens: 2000 };

// ---------------------------------------------------------------------------
// 일감의 상태 — 열쇠 문들의 전이(`20260925090000` · `20260925180000`)
// ---------------------------------------------------------------------------

type Db = {
  run: { status: 'running' | 'failed' | 'succeeded'; failureCode: string | null; usage: unknown };
  job: {
    status: 'frozen' | 'preparing' | 'submitting' | 'submitted' | 'retrieving';
    responseId: string | null;
    prepared: Record<string, unknown> | null;
  };
};

let db: Db;

const freshDb = (): Db => ({
  run: { status: 'running', failureCode: null, usage: null },
  job: { status: 'frozen', responseId: null, prepared: null },
});

const keyedDoor = async (name: string, args: Record<string, unknown> = {}) => {
  const running = db.run.status === 'running';
  switch (name) {
    case 'take_reading_job':
      if (db.job.status !== 'frozen') return { data: [], error: null };
      db.job.status = 'preparing';
      return { data: [{ run_id: 'run-1', kind: 'self', birth_a: BIRTH, birth_b: null, about: null }], error: null };
    case 'prepare_reading_job':
      db.job.status = 'submitting';
      db.job.prepared = args;
      return { data: true, error: null };
    case 'adopt_reading_job': {
      const adopts = db.job.responseId === null && db.job.status === 'submitting' && running;
      if (adopts) {
        db.job.responseId = args.p_response_id as string;
        db.job.status = 'submitted';
      }
      return { data: adopts, error: null };
    }
    case 'claim_reading_job': {
      if (!(db.job.responseId === args.p_response_id && db.job.status === 'submitted' && running)) {
        return { data: [], error: null };
      }
      db.job.status = 'retrieving';
      const p = db.job.prepared!;
      return {
        data: [
          {
            run_id: 'run-1',
            kind: 'self',
            prompt: p.p_prompt,
            evidence: p.p_evidence,
            prompt_version: p.p_prompt_version,
            requested_model: p.p_requested_model,
            generation: p.p_generation,
            viewed_at: p.p_viewed_at,
            birth_a: BIRTH,
            birth_b: null,
          },
        ],
        error: null,
      };
    }
    case 'release_reading_job':
      if (db.job.status === 'retrieving') db.job.status = 'submitted';
      return { data: null, error: null };
    case 'fail_reading_job':
      if (running) {
        db.run = { status: 'failed', failureCode: args.p_failure_code as string, usage: args.p_usage ?? null };
      }
      return { data: null, error: null };
    case 'save_reading':
      db.run.status = 'succeeded';
      return { data: 'reading-1', error: null };
    case 'open_reading_jobs':
      return {
        data: running ? [{ run_id: 'run-1', response_id: db.job.responseId, overdue: false, failure_code: 'model-timeout' }] : [],
        error: null,
      };
    default:
      return { data: null, error: null };
  }
};

// ---------------------------------------------------------------------------
// OpenAI 의 HTTP — 제출은 받아 응답을 세우고(토큰이 나간다), 끊는 방식은 시험이 고른다
// ---------------------------------------------------------------------------

type Link = 'answers' | 'drops' | 'hangs';
let link: Link;
/** provider 쪽에 선 응답 — 하나하나가 토큰이 나가는 모델 실행이다 */
let created: { id: string; headers: Headers }[];

const sse = (id: string) =>
  new Response(
    `event: response.created\ndata: ${JSON.stringify({ type: 'response.created', sequence_number: 0, response: { id, object: 'response', status: 'queued' } })}\n\n`,
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );

const finished = (id: string) =>
  Response.json({
    id,
    object: 'response',
    status: 'completed',
    model: 'gpt-test-2026',
    metadata: { reading_run_id: 'run-1' },
    usage: USAGE,
    output: [
      {
        type: 'message',
        id: `msg_${id}`,
        role: 'assistant',
        status: 'completed',
        content: [
          { type: 'output_text', annotations: [], text: JSON.stringify({ score: null, metaphor: METAPHOR, markdown: GOOD }) },
        ],
      },
    ],
  });

const fakeOpenAi = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = String(input instanceof Request ? input.url : input);
  const method = init?.method ?? 'GET';

  if (method === 'POST' && url.endsWith('/responses')) {
    const id = `resp_${created.length + 1}`;
    created.push({ id, headers: new Headers(init?.headers) });
    if (link === 'answers') return sse(id);
    if (link === 'drops') throw new TypeError('fetch failed');
    /* 머리를 안 보낸다 — 클라이언트가 스스로 끊을 때까지 */
    return new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
  }

  const retrieved = /\/responses\/([^/?]+)/.exec(url);
  if (method === 'GET' && retrieved) return finished(retrieved[1]);

  return new Response('not found', { status: 404 });
};

/** `after` 에 넘긴 일이 망에 닿을 때까지 — 타이머를 안 쓰고 이벤트 고리만 돌린다 */
const untilSubmitted = async (count: number) => {
  for (let turn = 0; turn < 200 && created.length < count; turn += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

const settle = async () => {
  await Promise.all(pending);
  pending.length = 0;
};

const SECRET = 'cron-secret-for-test';
const recoveryTick = () => recover(new Request('http://localhost/api/cron/reading', { headers: { authorization: `Bearer ${SECRET}` } }));

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  db = freshDb();
  created = [];
  pending.length = 0;
  rpc.mockReset().mockImplementation(async (name: string) =>
    name === 'start_reading_run' ? { data: [{ run_id: 'run-1' }], error: null } : { data: null, error: null },
  );
  keyedRpc.mockReset().mockImplementation(keyedDoor);
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  vi.stubEnv('CRON_SECRET', SECRET);
  vi.stubGlobal('fetch', vi.fn(fakeOpenAi));
  logged = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  logged.mockRestore();
});

describe('떠나보냈는데 답을 못 받은 제출', () => {
  it('답을 받으면 이름표를 적고 webhook 의 회수가 저장한다 — 아래 갈래들의 기준선', async () => {
    link = 'answers';

    await beginReading({ kind: 'self' });
    await settle();

    expect(created).toHaveLength(1);
    expect(db.job).toMatchObject({ status: 'submitted', responseId: 'resp_1' });
    await expect(collectReadingResult('resp_1')).resolves.toEqual({ done: 'saved' });
    expect(db.run.status).toBe('succeeded');
  });

  it('제출에 멱등 머리가 없다 — provider 가 같은 제출을 알아볼 표가 안 간다', async () => {
    link = 'answers';

    await beginReading({ kind: 'self' });
    await settle();

    expect(created[0].headers.has('idempotency-key')).toBe(false);
  });

  /**
   * **재시도 0 — 끊긴 제출은 한 번만 나간다.** provider 쪽 응답은 하나다. 다만 그 하나는 여전히 버려진다 — 우리 쪽 시도는
   * `model-submit-failed` 로 닫히고 쓴 토큰은 `null` 이다(ADR 0039 의 지출 기록에 안 남는다). webhook 은 되찾기가 거절당해
   * (시도가 이미 닫힘) 건너뛰고, 복구기는 집을 일감이 없다.
   *
   * SDK 기본값(재시도 2)일 때는 같은 갈래에서 응답이 셋 섰고 셋 다 버려졌다(이 파일의 첫 커밋).
   */
  it('망이 끊기면 제출은 한 번만 나가고, 그 응답은 버려진다', async () => {
    link = 'drops';

    await beginReading({ kind: 'self' });
    await settle();

    expect(created.map(({ id }) => id)).toEqual(['resp_1']);
    expect(db.run).toEqual({ status: 'failed', failureCode: 'model-submit-failed', usage: null });

    await expect(collectReadingResult('resp_1')).resolves.toEqual({ done: 'skipped', why: '집을 일감이 없습니다' });
    expect(db.run.status).toBe('failed');
    expect(await (await recoveryTick()).json()).toEqual({ open: 0, collected: 0, closed: 0 });
  });

  /**
   * **시간 상한 30초 — 머리가 안 오면 30초에 끊고 시도를 닫는다.** 사람은 8분(복구기의 기한) 대신 30초 만에 실패를 본다.
   * 대가: provider 가 받았던 제출이면 그 응답은 버려진다 — 닫힌 시도는 되찾기가 거절한다.
   *
   * SDK 기본값(10분)일 때는 누름의 `after` 가 사는 300초(`maxDuration`) 안에 포기하지 않았고, 함수가 끊긴 뒤 시도가
   * `submitting` 으로 남아 webhook 이 이름표로 되찾아 저장했다(이 파일의 첫 커밋).
   */
  it('머리가 안 오면 30초에 끊고 시도를 닫고, 늦게 온 응답은 버려진다', async () => {
    link = 'hangs';
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    await beginReading({ kind: 'self' });
    await untilSubmitted(1);
    await vi.advanceTimersByTimeAsync(29_000);
    expect(db.run.status).toBe('running');

    await vi.advanceTimersByTimeAsync(1_000);
    await settle();

    expect(created).toHaveLength(1);
    expect(db.run).toMatchObject({ status: 'failed', failureCode: 'model-submit-failed' });

    await expect(collectReadingResult('resp_1')).resolves.toEqual({ done: 'skipped', why: '집을 일감이 없습니다' });
  });
});
