import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_QUERY } from '@/src/lib/input/query';

import { dbFailure } from '../../db-error';

import type { PairSide } from './actions';

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

const { pairRelationFor, openPairScreen } = await import('./actions');

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
 * **두 칸이 각자 어디서 오든 한 문으로 간다.**
 *
 * 한 칸은 저장한 사람에서 고를 수도 있고 직접 적을 수도 있다. 여기서 잠그는 것 넷 —
 * 한 문으로 간다는 것, 사이가 그 누름에 함께 실린다는 것, **목록에 안 선다는 것**,
 * 그리고 고른 사람 쪽에는 **입력을 안 보낸다는 것**이다.
 */
describe('두 사람으로 궁합 화면을 여는 자리', () => {
  const person = (name: string): PairSide => ({
    from: 'typed',
    query: { ...DEFAULT_QUERY, name, date: '1990-05-15', time: '14:30' },
  });
  const saved = (personId: string): PairSide => ({ from: 'saved', personId });

  const saveCall = () => rpc.mock.calls.find(([name]) => name === 'create_pair_for_reading');

  beforeEach(() => {
    rpc.mockResolvedValue({ data: [{ person_a: 'saved-a', person_b: 'saved-b' }], error: null });
  });

  /**
   * **한 문이어야 한도에 걸렸을 때 아무도 안 남는다.** 등록을 두 번 부르면 열아홉 명인
   * 사람에게서 첫 사람만 목록에 남고, 되돌리는 일을 호출부가 기억해야 한다.
   */
  it('두 사람과 사이를 한 문으로 보낸다', async () => {
    const result = await openPairScreen(person('민수'), person('지영'), 'family');

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

  /**
   * **궁합 한 번이 사람 목록을 늘리지 않는다.** 이 화면이 오래 약속해 온 것이 「입력한
   * 정보는 저장되지 않습니다」이고, 대상이 필요해서 만든 행이 목록에 서면 그 약속이
   * 깨진다 — 지우는 일도 사용자 몫이 된다.
   */
  it('만든 두 사람은 목록에 안 세운다', async () => {
    await openPairScreen(person('민수'), person('지영'), 'family');

    expect(saveCall()?.[1]).toMatchObject({ p_listed: false });
  });

  /**
   * **고른 사람 쪽에는 입력을 안 보낸다.** 문은 id 가 있으면 그 사람을 쓰고 나머지
   * 인자를 안 보는데, 거기에 아무 값이나 채워 보내면 그 문을 읽는 사람이 「이 값이
   * 어딘가에 쓰이나」를 다시 확인해야 한다.
   */
  it('고른 사람 쪽은 id 만 보낸다', async () => {
    const result = await openPairScreen(saved('already-there'), person('지영'), 'family');

    expect(result).toEqual({ ok: true, personA: 'saved-a', personB: 'saved-b' });
    expect(saveCall()?.[1]).toMatchObject({
      p_a_person: 'already-there',
      p_a_local_label: null,
      p_a_solar_date: null,
      p_b_local_label: '지영',
      p_b_person: null,
    });
    /*
      **고른 사람 쪽은 같은 명식을 안 묻는다.** 사용자가 그 사람을 직접 가리켰으므로
      「그분이 맞나요」는 이미 답이 나온 물음이다. 적어 넣은 쪽만 묻는다.
    */
    expect(sameChart).toHaveBeenCalledTimes(1);
    expect(sameChart.mock.calls[0][0]).toMatchObject({ name: '지영' });
  });

  /**
   * **「안 건드렸다」와 「모른다」는 다른 값이다.** 칸이 늘 「아직 모르겠음」에서
   * 시작하므로, 안 건드린 것을 답으로 보내면 화면을 지나가는 것만으로 적어 둔 답이
   * 지워진다.
   */
  it('사이를 안 건드렸으면 적지도 지우지도 않는다', async () => {
    await openPairScreen(saved('one'), saved('two'), undefined);

    expect(saveCall()?.[1]).toMatchObject({ p_relation: null });
    expect(rpc.mock.calls.filter(([name]) => name === 'set_pair_relation')).toEqual([]);
  });

  /** 「모른다」를 고른 것은 답이다 — 적어 둔 것을 지운다 */
  it('모른다를 고르면 적어 둔 사이를 지운다', async () => {
    await openPairScreen(saved('one'), saved('two'), null);

    expect(rpc.mock.calls.find(([name]) => name === 'set_pair_relation')?.[1]).toMatchObject({
      p_relation: null,
    });
  });

  /** 모르는 이름은 눕히지 않는다 — 서버 액션은 주소만 알면 아무 값이나 온다 */
  it('모르는 사이 이름은 모른다로 눕힌다', async () => {
    await openPairScreen(person('민수'), person('지영'), '동창' as never);

    expect(saveCall()?.[1]).toMatchObject({ p_relation: null });
  });

  /**
   * 저장하는 자리에서 **기본값으로 고쳐 넣지 않는다**(`unsupportedForSaving`). 판본은
   * 고치지 않으므로 사용자가 고른 적 없는 값이 굳으면 되돌릴 수 없다.
   */
  it('이름이 없으면 부르지도 않는다', async () => {
    const result = await openPairScreen(person('민수'), person(''), null);

    expect(saveCall()).toBeUndefined();
    expect(result.ok).toBe(false);
  });

  it('모르는 도시는 저장하러 가지 않는다', async () => {
    const result = await openPairScreen(
      person('민수'),
      { from: 'typed', query: { ...DEFAULT_QUERY, name: '지영', date: '1990-05-15', time: '14:30', city: '어딘가' as never } },
      null,
    );

    expect(saveCall()).toBeUndefined();
    expect(result.ok).toBe(false);
  });

  /** 0행은 저장이 아니다 — 「했다」로 읽으면 없는 사람에게 풀이 화면을 연다 */
  /** 0행은 저장이 아니다 — 「했다」로 읽으면 없는 사람에게 풀이 화면을 연다 */
  it('아무 줄도 안 오면 실패로 읽는다', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    expect((await openPairScreen(person('민수'), person('지영'), null)).ok).toBe(false);
  });

  it('DB 가 거절한 말을 그대로 옮긴다', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: '등록할 수 있는 사람은 10명까지입니다.' } });

    expect(await openPairScreen(person('민수'), person('지영'), null)).toEqual({
      ok: false,
      kind: 'failed',
      message: '등록할 수 있는 사람은 10명까지입니다.',
    });
  });
});

/**
 * **네 조합이 같은 키 한 벌을 보낸다** — 이것이 안 지켜지면 그 조합은 운영에서 안 열린다.
 *
 * PostgREST 는 **보낸 키 이름의 집합**으로 서명을 고른다. 그래서 「저장한 사람 + 직접
 * 입력」처럼 두 가지가 섞이면, 한쪽 가지가 키를 덜 실은 순간 24인자(옛)·28인자(새)
 * 어느 쪽에도 안 맞는 호출이 된다. 실제로 그렇게 깨진 적이 있다 — A2 가 빌더에 여덟
 * 글자 둘을 더했는데 「고른 사람」 가지가 손으로 적은 열 칸이어서 26키가 나갔고,
 * 운영에서 `PGRST202`(함수를 못 찾음)로 떨어졌다.
 *
 * **그래서 수를 여기에 박아 둔다.** 「두 가지가 같다」만 재면 둘이 함께 덜 실리는 날을
 * 못 잡고, 이름 목록까지 재야 키 하나가 이름만 바뀌는 것도 걸린다.
 */
describe('네 조합이 같은 인자 이름을 보낸다', () => {
  const typed = (name: string): PairSide => ({
    from: 'typed',
    query: { ...DEFAULT_QUERY, name, date: '1990-05-15', time: '14:30' },
  });
  const saved = (personId: string): PairSide => ({ from: 'saved', personId });

  const argNamesOf = async (a: PairSide, b: PairSide): Promise<string[]> => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: [{ person_a: 'x', person_b: 'y' }], error: null });
    await openPairScreen(a, b, null);
    const call = rpc.mock.calls.find(([name]) => name === 'create_pair_for_reading');
    if (call === undefined) throw new Error('문을 부르지 않았다');
    return Object.keys(call[1] as Record<string, unknown>).sort();
  };

  /** 새 서명이 받는 스물여덟 — 이 목록이 곧 계약이다(`20260924090000`) */
  const EXPECTED = [
    ...['a', 'b'].flatMap((side) =>
      [
        'local_label', 'note', 'calendar', 'original_date', 'solar_date', 'birth_time',
        'gender', 'city', 'late_night_rule', 'time_basis', 'chart', 'chart_engine_version',
      ].map((key) => `p_${side}_${key}`),
    ),
    'p_relation', 'p_a_person', 'p_b_person', 'p_listed',
  ].sort();

  it.each([
    ['직접 입력 × 직접 입력', typed('민수'), typed('지영')],
    ['저장한 사람 × 직접 입력', saved('already-there'), typed('지영')],
    ['직접 입력 × 저장한 사람', typed('민수'), saved('already-there')],
    ['저장한 사람 × 저장한 사람', saved('one'), saved('two')],
  ])('%s', async (_label, a, b) => {
    const names = await argNamesOf(a, b);

    expect(names).toEqual(EXPECTED);
    /* 스물여덟이 아니면 어느 서명에도 안 맞는다 — 26키로 나가던 고장이 그것이었다 */
    expect(names).toHaveLength(28);
  });
});

/**
 * **같은 명식이면 묻고 나서 저장한다** (ADR 0034).
 *
 * 막으려는 것은 중복 행이 아니라 **풀이권이 두 번 나가는 것**이다. 대상이 둘이면
 * 풀이도 둘이고 풀이권도 둘이다(ADR 0013·0021).
 */
describe('같은 명식을 묻는 자리', () => {
  const person = (name: string): PairSide => ({
    from: 'typed',
    query: { ...DEFAULT_QUERY, name, date: '1990-05-15', time: '14:30' },
  });
  const saveCall = () => rpc.mock.calls.find(([name]) => name === 'create_pair_for_reading');
  const same = { personId: 'already-there', label: '엄마', isSelfPerson: false, listed: true };

  beforeEach(() => {
    rpc.mockResolvedValue({ data: [{ person_a: 'saved-a', person_b: 'saved-b' }], error: null });
  });

  /** 물어야 하면 **아무것도 저장하지 않는다** — 저장하고 물으면 물을 이유가 없다 */
  it('묻는 동안에는 저장하지 않는다', async () => {
    sameChart.mockResolvedValueOnce(same);

    expect(await openPairScreen(person('민수'), person('지영'), 'family')).toEqual({
      ok: false,
      kind: 'same-chart',
      side: 'a',
      same,
    });
    expect(saveCall()).toBeUndefined();
  });

  /** 「맞다」고 답한 쪽은 **만들지 않고 있는 것을 쓴다** */
  it('맞다고 답한 쪽은 있는 사람으로 보낸다', async () => {
    await openPairScreen(person('민수'), person('지영'), 'family', { a: 'already-there' });

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

    const result = await openPairScreen(person('민수'), person('지영'), null, { a: null });

    // a 는 답이 있으니 건너뛰고 b 를 묻는다.
    expect(result).toMatchObject({ kind: 'same-chart', side: 'b' });
  });

  /**
   * **숨은 사람에게는 안 묻는다.** 궁합만 보려고 만들어 둔 사람은 목록에 없어서 물어도
   * 확인할 데가 없다. 새로 만들면 같은 두 사람이 대상 두 벌로 갈리고, 풀이 목록에 같은
   * 쌍이 두 줄 선다 — 풀이권도 두 번 나간다.
   */
  it('목록에 없는 같은 명식은 묻지 않고 그대로 쓴다', async () => {
    sameChart.mockResolvedValueOnce({ ...same, label: '민수', listed: false });

    const result = await openPairScreen(person('민수'), person('지영'), 'family');

    expect(result).toEqual({ ok: true, personA: 'saved-a', personB: 'saved-b' });
    expect(saveCall()?.[1]).toMatchObject({ p_a_person: 'already-there', p_b_person: null });
  });

  it('둘 다 답했으면 더 묻지 않고 저장한다', async () => {
    sameChart.mockResolvedValue(same);

    const result = await openPairScreen(person('민수'), person('지영'), null, {
      a: null,
      b: 'already-there',
    });

    expect(result).toEqual({ ok: true, personA: 'saved-a', personB: 'saved-b' });
    expect(saveCall()?.[1]).toMatchObject({ p_a_person: null, p_b_person: 'already-there' });
  });
});

/**
 * **같은 명식을 못 물어도 던지지 않는다**(ADR 0078). 액션이 던지면 운영의 Next 가 문장을
 * 영어 안내로 바꾼다 — 폼이 세울 줄 아는 `kind: 'failed'` 로 낸다. 궁합은 열지 않는다.
 */
describe('같은 명식을 못 물으면', () => {
  const typed: PairSide = {
    from: 'typed',
    query: { ...DEFAULT_QUERY, name: '민수', date: '1990-05-15', time: '14:30' },
  };
  const opened = () => rpc.mock.calls.filter(([name]) => name === 'create_pair_for_reading');

  it('문이 지은 우리말 문장을 값으로 낸다 — 궁합을 열지 않는다', async () => {
    sameChart.mockRejectedValue(
      dbFailure({ message: '이용이 정지된 계정입니다', code: '42501' }, 'user_person_access.same_chart'),
    );

    await expect(openPairScreen(typed, typed, 'family')).resolves.toEqual({
      ok: false,
      kind: 'failed',
      message: '이용이 정지된 계정입니다',
    });
    expect(opened()).toEqual([]);
  });

  it('우리가 안 쓴 오류는 안 옮긴다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    sameChart.mockRejectedValue(new RangeError('Invalid time value'));

    await expect(openPairScreen(typed, typed, 'family')).resolves.toEqual({
      ok: false,
      kind: 'failed',
      message: '요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
    });
    expect(opened()).toEqual([]);
    logged.mockRestore();
  });
});
