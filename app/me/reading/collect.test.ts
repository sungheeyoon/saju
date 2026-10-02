import { beforeEach, describe, expect, it, vi } from 'vitest';

import { baselineIn } from '@/src/lib/reading';
import { CITY_LONGITUDES, computeSaju } from '@/src/lib/saju';

import { readingInputOf } from './generator';

const keyedRpc = vi.fn();
const retrieve = vi.fn();

vi.mock('../../keyed-client', () => ({
  keyedClient: () => ({ rpc: keyedRpc }),
}));

/** 모델만 가짜다 — 가져오는 자리를 바꿔 끼우고, 검사와 근거는 진짜를 지난다 */
vi.mock('./model', () => ({
  retrieveBackgroundReading: (...args: unknown[]) => retrieve(...args),
}));

const { collectReadingResult } = await import('./collect');

/**
 * **가져온 글이 검사를 못 넘으면 저장하지 않는다.**
 *
 * 누름은 떠나보내기만 하고 완성본은 webhook 이나 복구기가 이 함수로 가져와 저장한다
 * (ADR 0020). 그래서 「검사에 걸린 글은 안 남는다」가 실제로 지켜지는 자리는 여기
 * 하나다. 그 약속을 재던 시험은 화면이 오지 않는 옛 길(`requestReading`)에만 있었고,
 * 그 길을 걷으면서 **이 자리는 한 번도 안 재인 채로 남았다.**
 *
 * 가짜는 열쇠 쓰는 DB 와 모델 회수뿐이다. 일감은 실제 명식으로 짓는다 — 검사가 재는
 * 것이 얼린 근거와 얼린 프롬프트이므로, 그 둘이 진짜여야 검사가 진짜로 문다.
 */

const BIRTH_A = {
  id: 'rev-a',
  calendar: 'solar',
  original_date: '1990-05-12',
  solar_date: '1990-05-12',
  birth_time: '14:30:00',
  gender: 'male',
  city: '부산',
  late_night_rule: 'jo',
  time_basis: 'localMean',
};

const BIRTH_B = {
  ...BIRTH_A,
  id: 'rev-b',
  original_date: '1993-11-03',
  solar_date: '1993-11-03',
  birth_time: '08:10:00',
  gender: 'female',
  city: '대구',
};

const VIEWED_AT = new Date('2026-08-26T09:00:00+09:00');
const A = computeSaju(
  { year: 1990, month: 5, day: 12, hour: 14, minute: 30, second: 0, gender: 'male' },
  { longitude: CITY_LONGITUDES.부산, useLongitude: true },
);
const B = computeSaju(
  { year: 1993, month: 11, day: 3, hour: 8, minute: 10, second: 0, gender: 'female' },
  { longitude: CITY_LONGITUDES.대구, useLongitude: true },
);

/** 얼려 둔 일감 한 줄 — `claim_reading_job` 이 내주는 모양 그대로 */
const jobOf = (kind: 'self' | 'match') => {
  const made =
    kind === 'self'
      ? readingInputOf({ kind, charts: { a: A }, viewedAt: VIEWED_AT })
      : readingInputOf({ kind, charts: { a: A, b: B }, viewedAt: VIEWED_AT });
  if (!made.ok) throw new Error(made.detail);

  return {
    run_id: 'run-1',
    kind,
    revision_a: 'rev-a',
    revision_b: kind === 'self' ? null : 'rev-b',
    prompt: made.input.prompt,
    evidence: made.input.evidenceText,
    prompt_version: 'reading-prompt-test',
    requested_model: 'gpt-test',
    generation: { provider: 'openai' },
    viewed_at: VIEWED_AT.toISOString(),
    birth_a: BIRTH_A,
    birth_b: kind === 'self' ? null : BIRTH_B,
  };
};

const GOOD = `## 한 줄로\n${'스스로 정한 규칙 안에서 오래 버티는 사람입니다. '.repeat(20)}`;
const METAPHOR = '결정은 빠르지만 끝에서 다시 확인해 완성에서 강해지는 사람';
const USAGE = {
  inputTokens: 1200,
  noCacheTokens: 1200,
  cacheReadTokens: 0,
  cacheWriteTokens: null,
  outputTokens: 800,
  totalTokens: 2000,
};

const answered = (output: { markdown: string; score: number | null; metaphor?: string }) => ({
  ok: true,
  output: { metaphor: METAPHOR, ...output },
  usage: USAGE,
  modelId: 'gpt-test-2026',
  runId: 'run-1',
});

const called = (name: string) => keyedRpc.mock.calls.find(([called]) => called === name);

let job: ReturnType<typeof jobOf>;

beforeEach(() => {
  keyedRpc.mockReset();
  retrieve.mockReset();
  job = jobOf('self');

  keyedRpc.mockImplementation(async (name: string) => {
    if (name === 'claim_reading_job') return { data: [job], error: null };
    if (name === 'save_reading') return { data: 'reading-1', error: null };
    return { data: null, error: null };
  });
});

describe('가져온 글은 검사를 넘어야 저장된다', () => {
  /**
   * **멀쩡한 글은 실제로 저장된다** — 아래 시험들이 뜻을 가지려면 이것이 먼저 서야 한다.
   * 이 줄이 없으면 「저장하지 않는다」가 배선이 끊겨서 초록일 수도 있다.
   */
  it('멀쩡한 글은 저장된다', async () => {
    retrieve.mockResolvedValue(answered({ markdown: GOOD, score: null }));

    await expect(collectReadingResult('resp-1')).resolves.toEqual({ done: 'saved' });
    expect(called('save_reading'), '멀쩡한 글이 저장되지 않았다').toBeDefined();
    expect(called('fail_reading_job')).toBeUndefined();
  });

  it('출생 원문이 샌 글은 저장하지 않고 실패로 닫는다', async () => {
    retrieve.mockResolvedValue(
      answered({ markdown: `${GOOD}\n1990-05-12 에 태어났습니다.`, score: null }),
    );

    await expect(collectReadingResult('resp-1')).resolves.toEqual({
      done: 'failed',
      code: 'birth-input-leaked',
    });
    expect(called('save_reading'), '검사에 걸린 글이 저장됐다').toBeUndefined();
    expect(called('fail_reading_job')?.[1]).toMatchObject({
      p_run_id: 'run-1',
      p_failure_code: 'birth-input-leaked',
    });
  });

  it('점수 계약을 어긴 글도 저장하지 않는다', async () => {
    // 한 사람짜리 풀이에는 점수가 없어야 한다.
    retrieve.mockResolvedValue(answered({ markdown: GOOD, score: 70 }));

    await expect(collectReadingResult('resp-1')).resolves.toEqual({
      done: 'failed',
      code: 'score-out-of-contract',
    });
    expect(called('save_reading')).toBeUndefined();
  });

  /**
   * **상대의 출생 원문은 얼린 두 번째 판본으로 잰다.** 첫 판본만 들고 재면 인연 궁합에서
   * 상대의 생년월일이 새도 아무것도 안 걸린다 — 그 글은 상대에게도 간다.
   */
  it('인연 궁합에서 상대의 출생 원문이 샌 글도 저장하지 않는다', async () => {
    job = jobOf('match');
    const baseline = baselineIn(job.prompt);
    expect(baseline, '궁합 프롬프트에 기준점이 없다').not.toBeNull();

    retrieve.mockResolvedValue(
      answered({ markdown: `${GOOD}\n상대는 1993-11-03 에 태어났습니다.`, score: baseline }),
    );

    await expect(collectReadingResult('resp-1')).resolves.toMatchObject({ done: 'failed' });
    expect(called('save_reading'), '상대의 출생 원문이 실린 글이 저장됐다').toBeUndefined();
    expect(called('fail_reading_job')?.[1].p_failure_code).toBe('birth-input-leaked');
  });

  /**
   * **검사에 걸린 실패에도 토큰은 나갔다**(ADR 0039). 모델은 다 돌았고 우리 검사가 문
   * 것이라, 여기서 안 적으면 그 지출이 어디에도 안 남는다.
   */
  it('검사에 걸린 실패도 쓴 토큰을 함께 적는다', async () => {
    retrieve.mockResolvedValue(
      answered({ markdown: `${GOOD}\n부산에서 태어났습니다.`, score: null }),
    );

    await collectReadingResult('resp-1');

    expect(called('save_reading')).toBeUndefined();
    expect(called('fail_reading_job')?.[1].p_usage).toEqual(USAGE);
  });
});

/**
 * **이름표를 되찾는 문이 터진 것은 「집을 일감이 없다」가 아니다**(ADR 0078).
 *
 * 앞서는 `adopt_reading_job` 의 `error` 를 안 꺼내서, 조회가 터지면 「되찾을 것이 없었다」와
 * 같은 길로 흘렀다 — 기록에는 「집을 일감이 없습니다」가 남고 진짜 까닭은 어디에도 없었다.
 * 집기가 터질 때와 같은 자리에서 까닭을 싣고 건너뛴다(여기서 던지지 않는다, 머리말).
 */
describe('이름표를 잃은 일감을 되찾는다', () => {
  it('되찾기가 터지면 그 까닭을 싣고 건너뛴다', async () => {
    keyedRpc.mockImplementation(async (name: string) => {
      if (name === 'claim_reading_job') return { data: [], error: null };
      if (name === 'adopt_reading_job') return { data: null, error: { message: 'adopt failed' } };
      return { data: null, error: null };
    });
    retrieve.mockResolvedValue(answered({ markdown: GOOD, score: null }));

    await expect(collectReadingResult('resp-1')).resolves.toEqual({ done: 'skipped', why: 'adopt failed' });
  });
});

/**
 * **이어쓰기 — 첫 절 1번 본문 = 답, 한 번만**(ADR 0143 의 2). 제출이 `generation.continuation` 에 맛보기 원문을 실어 두면
 * 회수가 답을 재고, 지나면 첫 절 2번 앞에 끼워 저장한다. 없으면 지금과 한 글자도 같다.
 */
describe('가입 뒤 이어쓰기', () => {
  const PREVIEW = '쇠의 기운을 가장 많이 타고났어요. 기준이 분명한 편이에요.\n\n그렇다면 이 단단함은 어디서 쉬어 갈까요?';
  const ANSWER =
    '그 쉼은 말로 먼저 꺼내는 데서 와요. 혼자 정리를 끝내고 내놓기보다 덜 다듬어진 채로라도 가까운 사람에게 먼저 나누면 버티는 시간이 줄어요. 결과를 일찍 보여 주는 편이 맞고, 그러면 같은 책임도 지치는 일보다 실력을 보여 주는 일에 가까워져요. 부담이 몰리는 날일수록 먼저 묻는 쪽이 이 사주에는 덜 무거워요.';
  const BODY = '스스로 정한 규칙 안에서 오래 버티는 사람입니다. '.repeat(20);
  const CONTINUED = `## 먼저 볼 핵심 세 가지\n2. 일을 고르는 눈이 빠르다.\n3. 관계에서는 천천히 연다.\n\n## 한 줄로\n${BODY}`;

  const continuedJob = () => ({ ...jobOf('self'), generation: { provider: 'openai', continuation: { preview: PREVIEW } } });
  const replied = (markdown: string, continuationAnswer?: string) => ({
    ...answered({ markdown, score: null }),
    output: { metaphor: METAPHOR, markdown, score: null, ...(continuationAnswer === undefined ? {} : { continuationAnswer }) },
  });

  it('답을 1번 본문으로 한 번만 끼워 저장하고, 퍼널 끝을 센다', async () => {
    job = continuedJob();
    retrieve.mockResolvedValue(replied(CONTINUED, ANSWER));

    await expect(collectReadingResult('resp-1')).resolves.toEqual({ done: 'saved' });
    const saved = called('save_reading')?.[1].p_output as string;
    expect(saved.split(ANSWER)).toHaveLength(2);
    expect(saved).toContain(`## 먼저 볼 핵심 세 가지\n1. ${ANSWER}\n2. 일을 고르는 눈이 빠르다.`);
    expect(called('count_taste_step')?.[1]).toEqual({ p_step: 'reading_succeeded' });
  });

  it('답이 없거나 · 첫 절에 1번을 또 쓰면 저장하지 않는다', async () => {
    job = continuedJob();
    retrieve.mockResolvedValue(replied(CONTINUED));
    await expect(collectReadingResult('resp-1')).resolves.toEqual({ done: 'failed', code: 'continuation-out-of-contract' });

    retrieve.mockResolvedValue(replied(CONTINUED.replace('2. 일을', '1. 따로 쓴 답.\n2. 일을'), ANSWER));
    await expect(collectReadingResult('resp-1')).resolves.toEqual({ done: 'failed', code: 'continuation-out-of-contract' });
    expect(called('save_reading')).toBeUndefined();
    expect(called('count_taste_step')).toBeUndefined();
  });

  it('이어쓰기가 없는 풀이는 받은 본문 그대로다 — 답 칸이 와도 끼우지 않는다', async () => {
    retrieve.mockResolvedValue(replied(GOOD, ANSWER));
    await expect(collectReadingResult('resp-1')).resolves.toEqual({ done: 'saved' });
    expect(called('save_reading')?.[1].p_output).toBe(GOOD);
    expect(called('count_taste_step')).toBeUndefined();
  });
});
