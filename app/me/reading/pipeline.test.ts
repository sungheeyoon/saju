import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const keyedRpc = vi.fn();
const selectIn = vi.fn();
const callModel = vi.fn();
const keyedClient = vi.fn();

class NoKeyError extends Error {}

vi.mock('../../auth/server-client', () => ({
  supabaseOnServer: async () => ({
    rpc,
    from: () => ({ select: () => ({ in: selectIn }) }),
  }),
}));

vi.mock('../../keyed-client', () => ({
  keyedClient: (...args: unknown[]) => keyedClient(...args),
  NoKeyError,
}));

vi.mock('./model', () => ({
  GENERATION: { model: 'test/model', provider: 'test', settings: {} },
  callModel: (...args: unknown[]) => callModel(...args),
}));

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

const savedCall = () => keyedRpc.mock.calls.find(([name]) => name === 'save_reading');
const failedCall = () => rpc.mock.calls.find(([name]) => name === 'fail_reading_run');

beforeEach(() => {
  rpc.mockReset();
  keyedRpc.mockReset();
  selectIn.mockReset();
  callModel.mockReset();
  keyedClient.mockReset();

  rpc.mockImplementation(async (name: string) =>
    name === 'start_reading_run' ? { data: [started], error: null } : { data: null, error: null },
  );
  selectIn.mockResolvedValue({ data: [BIRTH], error: null });
  keyedRpc.mockResolvedValue({ data: 'reading-1', error: null });
  keyedClient.mockReturnValue({ rpc: keyedRpc });
});

describe('결과 생성 요청은 자르고 · 부르고 · 검사하고 · 저장한다', () => {
  it('멀쩡한 글은 저장된다', async () => {
    callModel.mockResolvedValue({ ok: true, output: { score: null, markdown: GOOD } });

    await expect(requestReading({ kind: 'self' })).resolves.toEqual({ ok: true, replaced: true });
    expect(savedCall()).toBeDefined();
  });

  it('모델에 넘긴 것에 출생 원문이 없다 — 자르는 자리를 실제로 지난다', async () => {
    callModel.mockResolvedValue({ ok: true, output: { score: null, markdown: GOOD } });
    await requestReading({ kind: 'self' });

    const [prompt] = callModel.mock.calls[0] as [string];
    for (const form of ['1990-05-12', '14:30', '부산']) {
      expect(prompt, `${form} 이 프롬프트에 실렸다`).not.toContain(form);
    }

    // 저장되는 근거도 같은 것이어야 한다 — 근거 보기는 모델에 넘긴 것과 정확히 같다.
    const [, saved] = savedCall() as [string, Record<string, string>];
    expect(saved.p_evidence).not.toContain('1990-05-12');
    expect(prompt).toContain(saved.p_evidence);
  });

  it('**검사를 통과하지 못하면 저장하지 않는다**', async () => {
    callModel.mockResolvedValue({
      ok: true,
      output: { score: null, markdown: `${GOOD}\n1990-05-12 에 태어났습니다.` },
    });

    const result = await requestReading({ kind: 'self' });

    expect(result.ok).toBe(false);
    expect(savedCall(), '검사에 걸린 글이 저장됐다').toBeUndefined();
    expect(failedCall()?.[1]).toMatchObject({ p_failure_code: 'birth-input-leaked' });
  });

  it('점수 계약을 어긴 글도 저장하지 않는다', async () => {
    callModel.mockResolvedValue({ ok: true, output: { score: 70, markdown: GOOD } });

    await requestReading({ kind: 'self' });

    expect(savedCall()).toBeUndefined();
    expect(failedCall()?.[1]).toMatchObject({ p_failure_code: 'score-out-of-contract' });
  });

  it('모델이 실패하면 실패만 남기고 현재 결과를 건드리지 않는다', async () => {
    callModel.mockResolvedValue({ ok: false, code: 'model-call-failed', detail: '끊겼다' });

    const result = await requestReading({ kind: 'self' });

    expect(result.ok).toBe(false);
    expect(savedCall()).toBeUndefined();
    expect(failedCall()?.[1]).toMatchObject({ p_failure_code: 'model-call-failed' });
  });

  it('저장 열쇠가 없으면 모델을 부르지 않는다', async () => {
    keyedClient.mockImplementationOnce(() => {
      throw new NoKeyError('열쇠 없음');
    });

    const result = await requestReading({ kind: 'self' });

    expect(result.ok).toBe(false);
    expect(callModel).not.toHaveBeenCalled();
    expect(failedCall()?.[1]).toMatchObject({ p_failure_code: 'closed' });
  });

  it('같은 요청이 이미 돌았으면 모델을 부르지 않는다', async () => {
    rpc.mockImplementation(async (name: string) =>
      name === 'start_reading_run' ? { data: [], error: null } : { data: null, error: null },
    );

    await expect(requestReading({ kind: 'self' }, 'same-key')).resolves.toEqual({
      ok: true,
      replaced: false,
    });
    expect(callModel).not.toHaveBeenCalled();
  });

  it('누름의 열쇠를 그대로 넘긴다', async () => {
    callModel.mockResolvedValue({ ok: true, output: { score: null, markdown: GOOD } });
    await requestReading({ kind: 'self' }, 'press-0001');

    const [, args] = rpc.mock.calls[0] as [string, Record<string, string>];
    expect(args.p_idempotency_key).toBe('press-0001');
  });

  it('저장할 때 대상을 다시 대지 않는다 — 시도 하나가 곧 대상이다', async () => {
    callModel.mockResolvedValue({ ok: true, output: { score: null, markdown: GOOD } });
    await requestReading({ kind: 'self' });

    const [, saved] = savedCall() as [string, Record<string, unknown>];
    expect(Object.keys(saved)).not.toContain('p_kind');
    expect(Object.keys(saved)).not.toContain('p_person_a');
    expect(Object.keys(saved)).not.toContain('p_match_id');
    expect(saved.p_run_id).toBe('run-1');
  });
});
