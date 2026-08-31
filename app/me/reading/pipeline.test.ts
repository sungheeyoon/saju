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

const { FakeReadingGenerator } = await import('./fake-generator');
const { requestReading } = await import('./pipeline');

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

const started = {
  run_id: 'run-1',
  person_a: 'person-a',
  person_b: null,
  match_id: null,
  revision_a: 'rev-a',
  revision_b: null,
  viewer_is_first: true,
};

const GOOD = `## 한 줄로\n${'스스로 정한 규칙 안에서 오래 버티는 사람입니다. '.repeat(20)}`;

let generator: InstanceType<typeof FakeReadingGenerator>;
/** 이 쌍에 적어 둔 사이 — 없으면 `null` 이고 그것이 「모른다」다 */
let relationOfPair: string | null = null;

const savedCall = () => keyedRpc.mock.calls.find(([name]) => name === 'save_reading');
const failedCall = () => rpc.mock.calls.find(([name]) => name === 'fail_reading_run');

beforeEach(() => {
  rpc.mockReset();
  keyedRpc.mockReset();
  selectIn.mockReset();
  edgesIn.mockClear();
  keyedClient.mockReset();

  generator = new FakeReadingGenerator({
    ok: true,
    output: { score: null, markdown: GOOD },
  });

  relationOfPair = null;
  rpc.mockImplementation(async (name: string) => {
    if (name === 'start_reading_run') return { data: [started], error: null };
    if (name === 'pair_relation_of') return { data: relationOfPair, error: null };
    return { data: null, error: null };
  });
  selectIn.mockResolvedValue({ data: [BIRTH], error: null });
  keyedRpc.mockResolvedValue({ data: 'reading-1', error: null });
  keyedClient.mockReturnValue({ rpc: keyedRpc });
});

describe('결과 생성 요청은 자르고 · 부르고 · 검사하고 · 저장한다', () => {
  it('멀쩡한 글은 저장된다', async () => {
    await expect(requestReading({ kind: 'self' }, undefined, generator)).resolves.toEqual({
      ok: true,
      replaced: true,
    });
    expect(savedCall()).toBeDefined();
  });

  it('모델에 넘긴 것에 출생 원문이 없다 — 자르는 자리를 실제로 지난다', async () => {
    await requestReading({ kind: 'self' }, undefined, generator);

    const [prompt] = generator.prompts;
    for (const form of ['1990-05-12', '14:30', '부산']) {
      expect(prompt, `${form} 이 프롬프트에 실렸다`).not.toContain(form);
    }

    // 저장되는 근거도 같은 것이어야 한다 — 근거 보기는 모델에 넘긴 것과 정확히 같다.
    const [, saved] = savedCall() as [string, Record<string, string>];
    expect(saved.p_evidence).not.toContain('1990-05-12');
    expect(prompt).toContain(saved.p_evidence);
  });

  it('**검사를 통과하지 못하면 저장하지 않는다**', async () => {
    generator.respondWith({
      ok: true,
      output: { score: null, markdown: `${GOOD}\n1990-05-12 에 태어났습니다.` },
    });

    const result = await requestReading({ kind: 'self' }, undefined, generator);

    expect(result.ok).toBe(false);
    expect(savedCall(), '검사에 걸린 글이 저장됐다').toBeUndefined();
    expect(failedCall()?.[1]).toMatchObject({ p_failure_code: 'birth-input-leaked' });
  });

  it('점수 계약을 어긴 글도 저장하지 않는다', async () => {
    generator.respondWith({ ok: true, output: { score: 70, markdown: GOOD } });

    await requestReading({ kind: 'self' }, undefined, generator);

    expect(savedCall()).toBeUndefined();
    expect(failedCall()?.[1]).toMatchObject({ p_failure_code: 'score-out-of-contract' });
  });

  it('모델이 실패하면 실패만 남기고 현재 결과를 건드리지 않는다', async () => {
    generator.respondWith({ ok: false, code: 'model-call-failed', detail: '끊겼다' });

    const result = await requestReading({ kind: 'self' }, undefined, generator);

    expect(result.ok).toBe(false);
    expect(savedCall()).toBeUndefined();
    expect(failedCall()?.[1]).toMatchObject({ p_failure_code: 'model-call-failed' });
  });

  it('저장 열쇠가 없으면 모델을 부르지 않는다', async () => {
    keyedClient.mockImplementationOnce(() => {
      throw new NoKeyError('열쇠 없음');
    });

    const result = await requestReading({ kind: 'self' }, undefined, generator);

    expect(result.ok).toBe(false);
    expect(generator.prompts).toHaveLength(0);
    expect(failedCall()?.[1]).toMatchObject({ p_failure_code: 'closed' });
  });

  it('같은 요청이 이미 돌았으면 모델을 부르지 않는다', async () => {
    rpc.mockImplementation(async (name: string) =>
      name === 'start_reading_run' ? { data: [], error: null } : { data: null, error: null },
    );

    await expect(requestReading({ kind: 'self' }, 'same-key', generator)).resolves.toEqual({
      ok: true,
      replaced: false,
    });
    expect(generator.prompts).toHaveLength(0);
  });

  it('누름의 열쇠를 그대로 넘긴다', async () => {
    await requestReading({ kind: 'self' }, 'press-0001', generator);

    const [, args] = rpc.mock.calls[0] as [string, Record<string, string>];
    expect(args.p_idempotency_key).toBe('press-0001');
  });

  it('저장할 때 대상을 다시 대지 않는다 — 시도 하나가 곧 대상이다', async () => {
    await requestReading({ kind: 'self' }, undefined, generator);

    const [, saved] = savedCall() as [string, Record<string, unknown>];
    expect(Object.keys(saved)).not.toContain('p_kind');
    expect(Object.keys(saved)).not.toContain('p_person_a');
    expect(Object.keys(saved)).not.toContain('p_match_id');
    expect(saved.p_run_id).toBe('run-1');
  });

  /**
   * **관계는 내가 한쪽에 서 있을 때만 안다.**
   *
   * 저장한 값은 「나와 그 사람」이지 「그 둘」이 아니다. 이 배선이 없으면 궁합 풀이가
   * 두 사람이 무슨 사이인지 모른 채 쓰이고, 그 기본값은 사실상 연애다.
   */
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

    await requestReading(
      { kind: 'private', personA: 'person-a', personB: 'person-b' },
      undefined,
      generator,
    );

    return generator.prompts[0];
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

  it('provider 메타데이터도 교체 가능한 생성기에서 가져온다', async () => {
    await requestReading({ kind: 'self' }, undefined, generator);

    const [, startedArgs] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    const [, saved] = savedCall() as [string, Record<string, unknown>];
    expect(startedArgs.p_model).toBe('fake/reading');
    expect(saved.p_model).toBe('fake/reading');
    expect(saved.p_generation).toEqual({ provider: 'fake', settings: {} });
  });
});
