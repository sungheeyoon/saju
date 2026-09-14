import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const keyedRpc = vi.fn();
const selectIn = vi.fn();
const keyedClient = vi.fn();

class NoKeyError extends Error {}

/**
 * 파이프라인이 판본 말고도 둘을 더 읽는다 — 부를 이름(`user_person_access`)과
 * **이 쌍이 무슨 사이인가**(`pair_relation_of`). 관계는 사람이 아니라 쌍에 붙으므로
 * 어느 조합이든 답이 있을 수 있다.
 */
const maybeSingle = vi.fn(async () => ({ data: null }));
const edgesIn = vi.fn(async () => ({ data: [] as unknown[], error: null }));

vi.mock('../../auth/server-client', () => ({
  supabaseOnServer: async () => ({
    rpc,
    /**
     * **표마다 다른 답을 낸다.** 판본과 엣지를 한 mock 으로 받으면 관계를 읽는 자리가
     * 판본 행을 받게 되고, 그러면 「관계를 못 읽었다」와 「관계가 없다」가 같은 그림이
     * 되어 이 시험이 그 둘을 못 가른다.
     */
    from: (table: string) => ({
      select: () => ({
        in: table === 'user_person_access' ? edgesIn : selectIn,
        maybeSingle,
      }),
    }),
  }),
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
const { beginReading } = await import('./pipeline');

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
  ...BIRTH,
  id: 'rev-b',
  original_date: '1992-03-03',
  solar_date: '1992-03-03',
  gender: 'female',
  city: '서울',
};

const started = {
  run_id: 'run-1',
  person_a: 'person-a',
  person_b: null,
  match_id: null,
  revision_a: 'rev-a',
  revision_b: null,
  viewer_is_first: true,
};

/** 이 쌍에 적어 둔 사이 — 없으면 `null` 이고 그것이 「모른다」다 */
let relationOfPair: string | null = null;

const failedCall = () => rpc.mock.calls.find(([name]) => name === 'fail_reading_run');

beforeEach(() => {
  rpc.mockReset();
  keyedRpc.mockReset();
  selectIn.mockReset();
  edgesIn.mockClear();
  keyedClient.mockReset();

  relationOfPair = null;
  rpc.mockImplementation(async (name: string) => {
    if (name === 'start_reading_run') return { data: [started], error: null };
    if (name === 'pair_relation_of') return { data: relationOfPair, error: null };
    return { data: null, error: null };
  });
  selectIn.mockResolvedValue({ data: [BIRTH], error: null });
  keyedRpc.mockResolvedValue({ data: 'reading-1', error: null });
  keyedClient.mockReturnValue({ rpc: keyedRpc });
  pending.length = 0;
  submit.mockReset();
  submit.mockResolvedValue({ ok: true, responseId: 'resp-1' });
});

/**
 * **화면이 실제로 오는 길** — 얼리고 떠나보낸다 (ADR 0020).
 *
 * 완성본을 그 자리에서 기다리던 옛 길(`requestReading`)은 걷었다. 그 길만 밀던 동안 새
 * 배선은 한 번도 안 지나간 채로 초록이었다 — 그래서 시험도 화면이 오는 이 길만 민다.
 */
describe('누름은 얼리고 떠나보낸다', () => {
  const frozen = () => keyedRpc.mock.calls.find(([name]) => name === 'freeze_reading_job');
  const adopted = () => keyedRpc.mock.calls.find(([name]) => name === 'adopt_reading_job');

  it('얼린 뒤에 보낸다 — 순서가 뒤집히면 재료 없는 순간이 생긴다', async () => {
    await beginReading({ kind: 'self' });
    await settle();

    expect(frozen(), '얼리지 않았다').toBeDefined();
    expect(submit).toHaveBeenCalledOnce();

    const froze = keyedRpc.mock.invocationCallOrder[
      keyedRpc.mock.calls.findIndex(([name]) => name === 'freeze_reading_job')
    ];
    expect(froze).toBeLessThan(submit.mock.invocationCallOrder[0]);
  });

  it('얼린 것과 보낸 것이 같은 프롬프트다', async () => {
    await beginReading({ kind: 'self' });
    await settle();

    expect(submit.mock.calls[0][0]).toBe(frozen()?.[1].p_prompt);
    // 이름표를 함께 보낸다 — 우리 쪽 기록보다 먼저다.
    expect(submit.mock.calls[0][1]).toBe(started.run_id);
  });

  it('공유 궁합도 두 공개 이름으로 부르고 자리 이름으로 퇴행하지 않는다', async () => {
    const matchStarted = {
      ...started,
      match_id: 'match-1',
      revision_b: 'rev-b',
    };
    rpc.mockImplementation(async (name: string) =>
      name === 'start_reading_run'
        ? { data: [matchStarted], error: null }
        : { data: null, error: null },
    );
    keyedRpc.mockImplementation(async (name: string) => {
      if (name === 'match_calculation_inputs') {
        return {
          data: [
            { ...BIRTH, revision_id: 'rev-a', nickname: '민수' },
            { ...BIRTH_B, revision_id: 'rev-b', nickname: '지영' },
          ],
          error: null,
        };
      }
      return { data: 'reading-1', error: null };
    });

    await beginReading({ kind: 'match', matchId: 'match-1' });
    await settle();

    const prompt = frozen()?.[1].p_prompt as string;
    expect(prompt).toContain('`charts.a` 는 **민수**, `charts.b` 는 **지영**');
    expect(prompt).toContain('「첫 번째 분」·「두 번째 분」처럼 자리 이름으로');
    expect(prompt).toContain('부르지 마라');
  });

  it('얼린 프롬프트에 출생 원문이 없다 — 자르는 자리를 실제로 지난다', async () => {
    await beginReading({ kind: 'self' });
    await settle();

    const sent = `${frozen()?.[1].p_prompt}${frozen()?.[1].p_evidence}`;
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
    expect(failedCall(), '실패를 안 적었다').toBeDefined();
  });

  it('제출이 실패하면 시도를 닫는다', async () => {
    submit.mockResolvedValue({ ok: false, code: 'model-submit-failed', detail: '끊겼다' });

    await beginReading({ kind: 'self' });
    await settle();

    expect(failedCall()?.[1]).toMatchObject({ p_failure_code: 'model-submit-failed' });
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
    const froze = keyedRpc.mock.calls.find(([name]) => name === 'freeze_reading_job') as [
      string,
      Record<string, unknown>,
    ];
    expect(startedArgs.p_model).toBe(GENERATION.model);
    expect(froze[1].p_requested_model).toBe(GENERATION.model);
  });
});

/**
 * **관계는 내가 한쪽에 서 있을 때만 안다.**
 *
 * 저장한 값은 「나와 그 사람」이지 「그 둘」이 아니다. 이 배선이 없으면 궁합풀이가
 * 두 사람이 무슨 사이인지 모른 채 쓰이고, 그 기본값은 사실상 연애다.
 */
describe('궁합은 쌍에 적어 둔 사이로 읽는다', () => {
  const pairRun = {
    ...started,
    person_b: 'person-b',
    revision_b: 'rev-b',
  };

  const askForPair = async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === 'start_reading_run') return { data: [pairRun], error: null };
      if (name === 'pair_relation_of') return { data: relationOfPair, error: null };
      return { data: null, error: null };
    });
    selectIn.mockResolvedValue({
      data: [
        { ...BIRTH, id: 'rev-a', person_id: 'person-a' },
        { ...BIRTH, id: 'rev-b', person_id: 'person-b' },
      ],
      error: null,
    });

    await beginReading({ kind: 'private', personA: 'person-a', personB: 'person-b' });
    await settle();

    const froze = keyedRpc.mock.calls.find(([name]) => name === 'freeze_reading_job') as [
      string,
      Record<string, string>,
    ];
    return froze[1].p_prompt;
  };

  it('쌍에 적어 둔 사이를 프롬프트가 든다', async () => {
    edgesIn.mockResolvedValue({
      data: [
        { person_id: 'person-a', local_label: '나' },
        { person_id: 'person-b', local_label: '엄마' },
      ],
      error: null,
    });
    relationOfPair = 'family';

    expect(await askForPair()).toContain('가족이다');
  });

  /**
   * **적어 둔 것이 없으면 모른다.** 행이 없는 것이 곧 모른다이므로 두 가지 없음을
   * 가르지 않는다. 그리고 자리를 비우지 않는다 — 비우면 모르는 것과 안 물어본 것이
   * 같은 침묵이 되고, 모델은 그 침묵을 예전처럼 연애로 읽는다.
   */
  it('적어 둔 사이가 없으면 모른다고 넘긴다', async () => {
    edgesIn.mockResolvedValue({
      data: [
        { person_id: 'person-a', local_label: '엄마' },
        { person_id: 'person-b', local_label: '친구' },
      ],
      error: null,
    });
    relationOfPair = null;

    const prompt = await askForPair();
    expect(prompt).toContain('무슨 사이인지 모른다');
    expect(prompt).not.toContain('가족이다');
  });
});
