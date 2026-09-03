import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_QUERY, type Query } from '../../query';

const rpc = vi.fn();
vi.mock('../../auth/server-client', () => ({
  supabaseOnServer: async () => ({ rpc }),
}));

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

/**
 * 같은 명식을 찾는 일은 **여기서 재지 않는다.**
 *
 * 그것은 저장된 판본을 읽어 엔진으로 견주는 별개의 일이고 자기 시험을 갖는다
 * (`app/same-chart.test.ts`). 여기서 재는 것은 **그 답을 받은 뒤에 무엇을 하는가**다.
 * 안 눕히면 이 파일의 모든 검사가 `from()` 을 흉내 내는 일에 매달린다.
 */
const sameChart = vi.fn();
vi.mock('../same-chart', () => ({
  sameChartInMyList: (...args: unknown[]) => sameChart(...args),
}));

const { pairRelationFor, savePairForReading } = await import('./actions');

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
  sameChart.mockReset();
  sameChart.mockResolvedValue(null);
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
    // 아무도 「이미 있다」고 답하지 않았으면 둘 다 새로 만든다.
    expect(saveCall()?.[1]).toMatchObject({ p_a_person: null, p_b_person: null });
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
  /** 0행은 저장이 아니다 — 「했다」로 읽으면 없는 사람에게 풀이 화면을 연다 */
  it('아무 줄도 안 오면 실패로 읽는다', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    expect((await savePairForReading(person('민수'), person('지영'), null)).ok).toBe(false);
  });

  it('DB 가 거절한 말을 그대로 옮긴다', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: '등록할 수 있는 사람은 10명까지입니다.' } });

    expect(await savePairForReading(person('민수'), person('지영'), null)).toEqual({
      ok: false,
      kind: 'failed',
      message: '등록할 수 있는 사람은 10명까지입니다.',
    });
  });
});

/**
 * **같은 명식이면 묻고 나서 저장한다** (ADR 0034).
 *
 * 막으려는 것은 중복 행이 아니라 **풀이권이 두 번 나가는 것**이다. 대상이 둘이면
 * 풀이도 둘이고 풀이권도 둘이다(ADR 0013·0021).
 */
describe('같은 명식을 묻는 자리', () => {
  const person = (name: string): Query => ({ ...DEFAULT_QUERY, name, date: '1990-05-15', time: '14:30' });
  const saveCall = () => rpc.mock.calls.find(([name]) => name === 'create_pair_for_reading');
  const same = { personId: 'already-there', label: '엄마', isSelf: false };

  beforeEach(() => {
    rpc.mockResolvedValue({ data: [{ person_a: 'saved-a', person_b: 'saved-b' }], error: null });
  });

  /** 물어야 하면 **아무것도 저장하지 않는다** — 저장하고 물으면 물을 이유가 없다 */
  it('묻는 동안에는 저장하지 않는다', async () => {
    sameChart.mockResolvedValueOnce(same);

    expect(await savePairForReading(person('민수'), person('지영'), 'family')).toEqual({
      ok: false,
      kind: 'same-chart',
      side: 'a',
      same,
    });
    expect(saveCall()).toBeUndefined();
  });

  /** 「맞다」고 답한 쪽은 **만들지 않고 있는 것을 쓴다** */
  it('맞다고 답한 쪽은 있는 사람으로 보낸다', async () => {
    await savePairForReading(person('민수'), person('지영'), 'family', { a: 'already-there' });

    expect(saveCall()?.[1]).toMatchObject({ p_a_person: 'already-there', p_b_person: null });
  });

  /**
   * **「아니다」와 「아직 안 물었다」는 다른 값이다.**
   *
   * 둘을 합치면 「아니다」라고 답한 사람이 같은 물음을 영영 다시 받는다. `null` 이
   * 답이고 없는 것이 아직 안 물은 것이다.
   */
  it('아니라고 답한 쪽은 다시 묻지 않는다', async () => {
    sameChart.mockResolvedValue(same);

    const result = await savePairForReading(person('민수'), person('지영'), null, { a: null });

    // a 는 답이 있으니 건너뛰고 b 를 묻는다.
    expect(result).toMatchObject({ kind: 'same-chart', side: 'b' });
  });

  it('둘 다 답했으면 더 묻지 않고 저장한다', async () => {
    sameChart.mockResolvedValue(same);

    const result = await savePairForReading(person('민수'), person('지영'), null, {
      a: null,
      b: 'already-there',
    });

    expect(result).toEqual({ ok: true, personA: 'saved-a', personB: 'saved-b' });
    expect(saveCall()?.[1]).toMatchObject({ p_a_person: null, p_b_person: 'already-there' });
  });
});
