import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const keyedRpc = vi.fn();
const keyedClient = vi.fn();

class NoKeyError extends Error {}

/**
 * **사용자 세션으로는 시도를 열기만 한다.**
 *
 * 앞서는 이 파일이 판본 표와 `user_person_access` 를 흉내 내야 했다 —
 * 파이프라인이 응답 뒤에 판본과 이름표를 직접 읽었기 때문이다. 입력이 시도를 여는
 * 트랜잭션에서 얼면서(ADR 0071) 그 읽기가 전부 DB 안으로 들어갔고, 남은 것은 **얼린
 * 작업을 집어 오는 왕복 하나**다.
 */
vi.mock('../../auth/server-client', () => ({
  supabaseOnServer: async () => ({ rpc }),
}));

vi.mock('../../keyed-client', () => ({
  keyedClient: (...args: unknown[]) => keyedClient(...args),
  NoKeyError,
}));

/**
 * **`after` 에 넘긴 일을 붙잡아 둔다.**
 *
 * 화면이 오는 길(`beginReading`)은 응답을 먼저 보내고 나머지를 `after` 에 넘긴 뒤
 * **기다리지 않는다** — 그것이 그 함수의 존재 이유다. 그래서 곧바로 돌리기만 하면
 * 시험이 그 일보다 먼저 끝나고, 아무것도 안 재고 초록이 된다. 실제로 그랬다.
 *
 * 넘어온 promise 를 모아 두고 시험이 `settle()` 로 기다린다.
 */
const pending: Promise<unknown>[] = [];
vi.mock('next/server', () => ({
  after: (work: () => Promise<void>) => {
    pending.push(work());
  },
}));

const settle = async () => {
  await Promise.all(pending);
  pending.length = 0;
};

const submit = vi.fn();
vi.mock('./model', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('./model')),
  submitBackgroundReading: (...args: unknown[]) => submit(...args),
}));

const { GENERATION } = await import('./generation');
const { beginReading, sendAcceptedMatchReading } = await import('./pipeline');

/**
 * **파이프라인이 실제로 이어져 있는가.**
 *
 * 흐름 검사(`scripts/check-reading.mjs`)는 모델만 빼는 것이 아니라 **근거 조립·프롬프트·
 * 출력 검사를 통째로 건너뛰고** 저장 RPC 를 직접 부른다 — 화면과 RPC 가 이어져 있는지는
 * 재지만, `checkReading` 호출이 실수로 지워져도 네 층이 다 초록이다. 재어 봤다.
 *
 * 그래서 이 시험이 그 자리 하나를 잰다: **가짜는 모델뿐이고 나머지는 진짜다.**
 */

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

const BIRTH_B = {
  ...BIRTH,
  original_date: '1992-03-03',
  solar_date: '1992-03-03',
  gender: 'female',
  city: '서울',
};

/** `take_reading_job` 이 내주는 한 줄 — 얼린 값 전부다 */
const frozen = (over: Record<string, unknown> = {}) => ({
  run_id: 'run-1',
  kind: 'self',
  birth_a: BIRTH,
  birth_b: null,
  about: { names: null, relation: null },
  ...over,
});

const started = { run_id: 'run-1' };

/** 이 시도가 집어 올 얼린 작업 — 시험마다 갈아 끼운다 */
let job: Record<string, unknown> = frozen();

const keyedCall = (name: string) => keyedRpc.mock.calls.find(([called]) => called === name);
const prepared = () => keyedCall('prepare_reading_job');
const adopted = () => keyedCall('adopt_reading_job');
const closed = () => keyedCall('fail_reading_job');

beforeEach(() => {
  rpc.mockReset();
  keyedRpc.mockReset();
  keyedClient.mockReset();

  job = frozen();
  rpc.mockImplementation(async (name: string) =>
    name === 'start_reading_run' ? { data: [started], error: null } : { data: null, error: null },
  );
  keyedRpc.mockImplementation(async (name: string) => {
    if (name === 'take_reading_job') return { data: [job], error: null };
    if (name === 'match_run_awaiting_send') return { data: [job], error: null };
    if (name === 'prepare_reading_job') return { data: true, error: null };
    return { data: null, error: null };
  });
  keyedClient.mockReturnValue({ rpc: keyedRpc });
  pending.length = 0;
  submit.mockReset();
  submit.mockResolvedValue({ ok: true, responseId: 'resp-1' });
});

/**
 * **화면이 실제로 오는 길** — 집고, 적고, 떠나보낸다 (ADR 0020·0071).
 */
describe('누름은 얼린 작업을 집어 떠나보낸다', () => {
  /**
   * **시계를 고정한다.** 파이프라인은 기준 시각을 누른 순간(`new Date()`)으로 잡고, 그 값이
   * ISO 로 근거에 실린다. 그대로 두면 **UTC 14:30 에 도는 실행에서** 기준 시각
   * `…T14:30…Z` 가 출생 시각 `14:30` 으로 잡혀 「출생 원문이 없다」가 떨어진다 — PR #59 의
   * CI 가 정확히 그 분에 돌아 떨어졌다. 고친 것은 제품이 아니라 시험이 시계를 탄 자리다.
   */
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-26T09:00:00+09:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('적은 뒤에 보낸다 — 순서가 뒤집히면 재료 없는 순간이 생긴다', async () => {
    await beginReading({ kind: 'self' });
    await settle();

    expect(prepared(), '지은 것을 안 적었다').toBeDefined();
    expect(submit).toHaveBeenCalledOnce();

    const wrote = keyedRpc.mock.invocationCallOrder[
      keyedRpc.mock.calls.findIndex(([name]) => name === 'prepare_reading_job')
    ];
    expect(wrote).toBeLessThan(submit.mock.invocationCallOrder[0]);
  });

  /**
   * **집는 일이 적는 일보다 먼저다.** 집지 않고 적으면 두 프로세스가 같은 작업을 들고
   * 나란히 제출한다 — 집는 문이 원자적인 까닭이 그것이다.
   */
  it('집고 나서 적는다', async () => {
    await beginReading({ kind: 'self' });
    await settle();

    const took = keyedRpc.mock.invocationCallOrder[
      keyedRpc.mock.calls.findIndex(([name]) => name === 'take_reading_job')
    ];
    const wrote = keyedRpc.mock.invocationCallOrder[
      keyedRpc.mock.calls.findIndex(([name]) => name === 'prepare_reading_job')
    ];
    expect(took).toBeLessThan(wrote);
  });

  /**
   * **이미 누가 집었으면 아무 일도 안 한다.**
   *
   * 0행은 복구기가 먼저 집었거나 시도가 닫힌 것이다. 그때 또 제출하면 같은 시도에
   * 두 번 나가고, 돈은 두 번 나가며 결과 하나는 미아가 된다.
   */
  it('집을 것이 없으면 제출하지 않는다', async () => {
    keyedRpc.mockImplementation(async (name: string) =>
      name === 'take_reading_job' ? { data: [], error: null } : { data: null, error: null },
    );

    await beginReading({ kind: 'self' });
    await settle();

    expect(submit).not.toHaveBeenCalled();
    expect(prepared()).toBeUndefined();
  });

  it('적은 것과 보낸 것이 같은 프롬프트다', async () => {
    await beginReading({ kind: 'self' });
    await settle();

    expect(submit.mock.calls[0][0]).toBe(prepared()?.[1].p_prompt);
    // 이름표를 함께 보낸다 — 우리 쪽 기록보다 먼저다.
    expect(submit.mock.calls[0][1]).toBe(started.run_id);
  });

  /**
   * **부르는 말도 얼려서 온다.** 앞서는 이 이름을 파이프라인이 그 자리에서 읽었고,
   * 만드는 동안 이름표를 고치면 프롬프트가 두 이름을 섞어 썼다.
   */
  it('공유 궁합도 얼린 두 이름으로 부르고 자리 이름으로 퇴행하지 않는다', async () => {
    job = frozen({
      kind: 'match',
      birth_b: BIRTH_B,
      about: { names: { a: '민수', b: '지영' }, relation: null },
    });

    await sendAcceptedMatchReading('request-1');

    const prompt = prepared()?.[1].p_prompt as string;
    expect(prompt).toContain('`charts.a` 는 **민수**, `charts.b` 는 **지영**');
    expect(prompt).toContain('「첫 번째 분」·「두 번째 분」처럼 자리 이름으로');
    expect(prompt).toContain('부르지 마라');
  });

  it('적은 프롬프트에 출생 원문이 없다 — 자르는 자리를 실제로 지난다', async () => {
    await beginReading({ kind: 'self' });
    await settle();

    const sent = `${prepared()?.[1].p_prompt}${prepared()?.[1].p_evidence}`;
    for (const secret of [BIRTH.original_date, BIRTH.solar_date, BIRTH.city, '14:30']) {
      expect(sent, secret).not.toContain(secret);
    }
  });

  it('보낸 뒤에 이름표를 적는다', async () => {
    await beginReading({ kind: 'self' });
    await settle();

    expect(adopted()?.[1]).toEqual({ p_run_id: started.run_id, p_response_id: 'resp-1' });
  });

  it('저장 열쇠가 없으면 보내지 않는다 — 만들 수 없는 결과는 부르지도 않는다', async () => {
    keyedClient.mockImplementation(() => {
      throw new NoKeyError('열쇠가 없습니다');
    });

    await beginReading({ kind: 'self' });
    await settle();

    expect(submit).not.toHaveBeenCalled();
    /** 열쇠가 없으면 열쇠 문도 못 쓴다 — 남는 길은 사용자 세션 하나다 */
    expect(
      rpc.mock.calls.find(([name]) => name === 'fail_reading_run'),
      '실패를 안 적었다',
    ).toBeDefined();
  });

  /**
   * **실패는 열쇠로 닫는다.** 수락이 연 시도는 청한 사람 것으로 서 있어 사용자 쪽 문
   * (`fail_reading_run` 은 `auth.uid()` 를 건다)으로는 못 닫는다 — 그러면 실패한 인연
   * 궁합이 만료까지 열린 채 남는다.
   */
  it('제출이 실패하면 열쇠로 시도를 닫는다', async () => {
    submit.mockResolvedValue({ ok: false, code: 'model-submit-failed', detail: '끊겼다' });

    await beginReading({ kind: 'self' });
    await settle();

    expect(closed()?.[1]).toMatchObject({ p_failure_code: 'model-submit-failed' });
    expect(adopted(), '보내지도 못했는데 이름표를 적었다').toBeUndefined();
  });
});

describe('누름은 시도를 한 번만 연다', () => {
  it('같은 요청이 이미 돌았으면 보내지 않는다', async () => {
    rpc.mockImplementation(async (name: string) =>
      name === 'start_reading_run' ? { data: [], error: null } : { data: null, error: null },
    );

    await expect(beginReading({ kind: 'self' }, 'same-key')).resolves.toEqual({
      ok: true,
      started: false,
    });
    await settle();
    expect(submit).not.toHaveBeenCalled();
  });

  it('누름의 열쇠를 그대로 넘긴다', async () => {
    await beginReading({ kind: 'self' }, 'press-0001');
    await settle();

    const [, args] = rpc.mock.calls[0] as [string, Record<string, string>];
    expect(args.p_idempotency_key).toBe('press-0001');
  });

  it('시도에 적는 모델은 실제로 보내는 모델이다', async () => {
    await beginReading({ kind: 'self' });
    await settle();

    const [, startedArgs] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(startedArgs.p_model).toBe(GENERATION.model);
    expect(prepared()?.[1].p_requested_model).toBe(GENERATION.model);
  });

  /**
   * **판본을 인자로 안 보낸다**(ADR 0071).
   *
   * 앱이 계산 입력을 고르는 자리가 하나 남아 있었다. 그 값이 무엇이든 DB 는 그것이 이
   * 시도의 것인지 알 수 없다 — 없애야 그 물음 자체가 사라진다.
   */
  it('적는 문에 판본을 싣지 않는다', async () => {
    await beginReading({ kind: 'self' });
    await settle();

    expect(Object.keys(prepared()?.[1] ?? {})).toEqual([
      'p_run_id',
      'p_prompt',
      'p_evidence',
      'p_prompt_version',
      'p_requested_model',
      'p_generation',
      'p_viewed_at',
    ]);
  });
});

/**
 * **관계는 내가 한쪽에 서 있을 때만 안다.**
 *
 * 저장한 값은 「나와 그 사람」이지 「그 둘」이 아니다. 이 배선이 없으면 궁합풀이가
 * 두 사람이 무슨 사이인지 모른 채 쓰이고, 그 기본값은 사실상 연애다.
 *
 * 이제 그 값도 **시도를 열 때 얼린다** — 만드는 동안 사이를 고쳐도 이미 시작된 글은
 * 동결값으로 끝난다.
 */
describe('궁합은 얼려 둔 사이로 읽는다', () => {
  const askForPair = async (about: Record<string, unknown>) => {
    job = frozen({ kind: 'private', birth_b: BIRTH_B, about });

    await beginReading({ kind: 'private', personA: 'person-a', personB: 'person-b' });
    await settle();

    return prepared()?.[1].p_prompt as string;
  };

  it('얼려 둔 사이를 프롬프트가 든다', async () => {
    const prompt = await askForPair({ names: { a: '나', b: '엄마' }, relation: 'family' });

    expect(prompt).toContain('가족이다');
  });

  /**
   * **적어 둔 것이 없으면 모른다.** 행이 없는 것이 곧 모른다이므로 두 가지 없음을
   * 가르지 않는다. 그리고 자리를 비우지 않는다 — 비우면 모르는 것과 안 물어본 것이
   * 같은 침묵이 되고, 모델은 그 침묵을 예전처럼 연애로 읽는다.
   */
  it('적어 둔 사이가 없으면 모른다고 넘긴다', async () => {
    const prompt = await askForPair({ names: { a: '엄마', b: '친구' }, relation: null });

    expect(prompt).toContain('무슨 사이인지 모른다');
    expect(prompt).not.toContain('가족이다');
  });

  /** 우리가 아는 갈래가 아니면 모른다로 눕힌다 — 그럴듯한 쪽으로 세우지 않는다 */
  it('모르는 사이 이름은 모른다로 눕힌다', async () => {
    const prompt = await askForPair({ names: { a: '나', b: '동료' }, relation: '동창' });

    expect(prompt).toContain('무슨 사이인지 모른다');
  });
});
