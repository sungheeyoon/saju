import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_QUERY, type Query } from '../../query';

const rpc = vi.fn();
vi.mock('../../auth/server-client', () => ({
  supabaseOnServer: async () => ({ rpc }),
}));

const begin = vi.fn();
vi.mock('../reading/pipeline', () => ({
  beginReading: (...args: unknown[]) => begin(...args),
}));

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

const { pairRelationFor, savePairForReading, startPairReading } = await import('./actions');

const relationCall = () => rpc.mock.calls.find(([name]) => name === 'set_pair_relation');

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
  begin.mockReset();
  begin.mockResolvedValue({ ok: true, started: true });
});

/**
 * **「모른다를 골랐다」와 「이 누름에서 안 정했다」는 다른 일이다.**
 *
 * 고르는 칸이 늘 「아직 모르겠음」에서 시작했고 그 값이 그대로 넘어왔다. `null` 은
 * 행을 지우는 답이라(`set_pair_relation`), 지난번에 「가족」이라 답해 둔 두 사람을
 * **다시 고르기만 해도** 그 답이 지워지고 새 풀이가 「모른다」로 났다.
 */
describe('사이를 적는 자리', () => {
  it('이 누름에서 안 정했으면 아무것도 안 적는다', async () => {
    await startPairReading('person-a', 'person-b', undefined, 'key-1');

    expect(relationCall()).toBeUndefined();
    expect(begin).toHaveBeenCalledOnce();
  });

  it('고른 값을 적는다', async () => {
    await startPairReading('person-a', 'person-b', 'family', 'key-1');

    expect(relationCall()?.[1]).toMatchObject({ p_relation: 'family' });
  });

  /** 되돌리는 길은 남는다 — 「아직 모르겠음」을 직접 고르면 그것은 답이다 */
  it('모르겠음을 직접 고르면 지우러 간다', async () => {
    await startPairReading('person-a', 'person-b', null, 'key-1');

    expect(relationCall()?.[1]).toMatchObject({ p_relation: null });
  });

  it('적지 못하면 시도를 열지 않는다 — 옛 값으로 난 글이 남지 않게', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: '못 적었습니다' } });

    const result = await startPairReading('person-a', 'person-b', 'partner', 'key-1');

    expect(result).toEqual({ ok: false, message: '못 적었습니다' });
    expect(begin).not.toHaveBeenCalled();
  });
});

/**
 * **못 읽은 것과 「모른다」를 한 값으로 내지 않는다.** 둘을 `null` 로 합치면 읽기가
 * 실패한 순간 화면이 「모른다」로 서고, 그다음 누름이 멀쩡한 값을 지운다.
 */
describe('사이를 읽는 자리', () => {
  it('적어 둔 값을 낸다', async () => {
    rpc.mockResolvedValue({ data: 'friend', error: null });

    await expect(pairRelationFor('person-a', 'person-b')).resolves.toEqual({
      ok: true,
      relation: 'friend',
    });
  });

  it('행이 없으면 모른다로 낸다', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(pairRelationFor('person-a', 'person-b')).resolves.toEqual({
      ok: true,
      relation: null,
    });
  });

  it('못 읽은 것은 모른다가 아니다', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: '못 읽었습니다' } });

    await expect(pairRelationFor('person-a', 'person-b')).resolves.toEqual({ ok: false });
  });

  /** 우리가 아는 갈래가 아니면 모른다로 눕힌다 — 그럴듯한 쪽으로 세우지 않는다 */
  it('모르는 이름은 모른다로 눕힌다', async () => {
    rpc.mockResolvedValue({ data: 'coworker', error: null });

    await expect(pairRelationFor('person-a', 'person-b')).resolves.toEqual({
      ok: true,
      relation: null,
    });
  });
});


/**
 * **직접 입력한 두 사람이 AI 로 가는 유일한 길.**
 *
 * 그 화면은 대상을 안 만들어서 풀이를 걸 자리가 없었다(ADR 0007·0013). 여기서 잠그는
 * 것은 그 다리가 **한 문으로 간다는 것**과, 사이가 그 누름에 함께 실린다는 것이다.
 */
describe('직접 입력한 두 사람을 저장하는 자리', () => {
  const person = (name: string): Query => ({
    ...DEFAULT_QUERY,
    name,
    date: '1990-05-15',
    time: '14:30',
  });

  const saveCall = () => rpc.mock.calls.find(([name]) => name === 'create_pair_for_reading');

  beforeEach(() => {
    rpc.mockResolvedValue({ data: [{ person_a: 'saved-a', person_b: 'saved-b' }], error: null });
  });

  /**
   * **한 문이어야 한도에 걸렸을 때 아무도 안 남는다.** 등록을 두 번 부르면 열아홉 명인
   * 사람에게서 첫 사람만 목록에 남고, 되돌리는 일을 호출부가 기억해야 한다.
   */
  it('두 사람과 사이를 한 문으로 보낸다', async () => {
    const result = await savePairForReading(person('민수'), person('지영'), 'family');

    expect(rpc.mock.calls.filter(([name]) => name === 'create_managed_person')).toEqual([]);
    expect(saveCall()?.[1]).toMatchObject({
      p_a_local_label: '민수',
      p_b_local_label: '지영',
      p_relation: 'family',
    });
    expect(result).toEqual({ ok: true, personA: 'saved-a', personB: 'saved-b' });
  });

  /** 모르는 이름은 눕히지 않는다 — 서버 액션은 주소만 알면 아무 값이나 온다 */
  it('모르는 사이 이름은 모른다로 눕힌다', async () => {
    await savePairForReading(person('민수'), person('지영'), '동창');

    expect(saveCall()?.[1]).toMatchObject({ p_relation: null });
  });

  /**
   * 저장하는 자리에서 **기본값으로 고쳐 넣지 않는다**(`unsupportedForSaving`). 판본은
   * 고치지 않으므로 사용자가 고른 적 없는 값이 굳으면 되돌릴 수 없다.
   */
  it('이름이 없으면 부르지도 않는다', async () => {
    const result = await savePairForReading(person('민수'), person(''), null);

    expect(saveCall()).toBeUndefined();
    expect(result.ok).toBe(false);
  });

  it('모르는 도시는 저장하러 가지 않는다', async () => {
    const result = await savePairForReading(
      person('민수'),
      { ...person('지영'), city: '어딘가' as Query['city'] },
      null,
    );

    expect(saveCall()).toBeUndefined();
    expect(result.ok).toBe(false);
  });

  /** 0행은 저장이 아니다 — 「했다」로 읽으면 없는 사람에게 풀이 화면을 연다 */
  it('아무 줄도 안 오면 실패로 읽는다', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    expect((await savePairForReading(person('민수'), person('지영'), null)).ok).toBe(false);
  });

  it('DB 가 거절한 말을 그대로 옮긴다', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: '스무 명까지 저장할 수 있습니다.' } });

    expect(await savePairForReading(person('민수'), person('지영'), null)).toEqual({
      ok: false,
      message: '스무 명까지 저장할 수 있습니다.',
    });
  });
});
