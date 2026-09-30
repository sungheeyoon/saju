import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chartOf } from '@/src/lib/input/chart';
import { DEFAULT_QUERY, type Query } from '@/src/lib/input/query';
import { storedChartOf, type StoredInput } from '@/src/lib/input/stored';
import { chartSnapshotOf } from '@/src/lib/saju';

vi.mock('../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));
vi.mock('../auth/signed-in', () => ({ signedInUser: vi.fn() }));

const keyedRpc = vi.fn();
vi.mock('../keyed-client', () => ({ keyedClient: () => ({ rpc: keyedRpc }) }));

import { supabaseOnServer } from '../auth/server-client';
import { signedInUser } from '../auth/signed-in';
import { createSelfPerson, editPersonInput, openParticipation, setParticipation } from './keyed-chart-writes';
import { selfSummaryOf } from './summary';

/**
 * **열쇠 모듈은 세션의 사람으로, 저장된 입력에서 지은 값만 내보낸다**(G-64, ADR 0136).
 *
 * 풀에 오르는 값을 쓰는 문 넷은 열쇠로만 열리므로, 그 문에 무엇이 실리는지는 이 모듈이 정한다. 여기서 잰다 —
 * 사람 id 는 세션(`signedInUser`)에서 오고, 여덟 글자는 저장할 입력을 엔진이 센 것이며, 참여를 켤 때의 요약은
 * **DB 에 저장된 내 입력**(가짜 DB 의 `person` 행)에서 지은 것이다. 세션이 없으면 열쇠 문을 아예 안 부른다.
 *
 * 가짜는 세션 · DB 읽기 · 열쇠 문 셋뿐이다. 요약을 짓는 `app/me/summary.ts` 와 엔진은 진짜를 지난다.
 */

type Answer = { data: unknown; error: unknown };

/** 사슬을 어디서 끊든 그 표의 답 하나가 온다 — `summary.test.ts` 와 같은 가짜 */
const chain = (answer: Answer) => {
  const link = { select: () => link, eq: () => link, maybeSingle: async () => answer };
  return link;
};

const OK = (data: unknown): Answer => ({ data, error: null });

/** DB 에 저장된 내 입력 — 요약은 이 행에서 나와야 한다 */
const STORED: StoredInput & { id: string } = {
  id: 'p-self',
  calendar: 'solar',
  original_date: '1990-05-15',
  solar_date: '1990-05-15',
  birth_time: '14:30:00',
  gender: 'male',
  city: '서울',
  late_night_rule: 'jo',
  time_basis: 'localMean',
} as StoredInput & { id: string };

const storing = (stored = STORED) =>
  vi.mocked(supabaseOnServer).mockResolvedValue({
    from: (table: string) =>
      chain(
        {
          app_user: OK({ self_person_id: stored.id }),
          person: OK(stored),
          user_person_access: OK({ local_label: '나' }),
        }[table] ?? OK(null),
      ),
  } as never);

const QUERY: Query = { ...DEFAULT_QUERY, name: '나', date: '1993-11-03', time: '08:10', city: '대구', gender: 'female' };

const sent = (name: string) => keyedRpc.mock.calls.filter(([called]) => called === name).map(([, args]) => args);

beforeEach(() => {
  keyedRpc.mockReset();
  keyedRpc.mockResolvedValue({ data: true, error: null });
  vi.mocked(signedInUser).mockReset();
  vi.mocked(signedInUser).mockResolvedValue({ id: 'u-session', email: undefined });
  storing();
});

describe('사람은 세션에서 온다', () => {
  it('넷 다 세션의 id 를 싣는다', async () => {
    const self = selfSummaryOf('p-self', storedChartOf(STORED, '나'))!;

    await createSelfPerson(QUERY);
    await editPersonInput('p-other', QUERY);
    await setParticipation(true);
    await setParticipation(false);
    await openParticipation(self);

    const ids = keyedRpc.mock.calls.map(([, args]) => (args as { p_user_id: unknown }).p_user_id);
    expect(ids.length).toBeGreaterThanOrEqual(5);
    expect(new Set(ids)).toEqual(new Set(['u-session']));
  });

  it('세션이 없으면 열쇠 문을 안 부르고 「로그인」 거절을 낸다', async () => {
    vi.mocked(signedInUser).mockResolvedValue(null);

    const answers = [
      await createSelfPerson(QUERY),
      await editPersonInput('p-self', QUERY),
      await setParticipation(true),
      await openParticipation(selfSummaryOf('p-self', storedChartOf(STORED, '나'))!),
    ];

    expect(keyedRpc).not.toHaveBeenCalled();
    expect(answers.map((answer) => answer.error?.code)).toEqual(['28000', '28000', '28000', '28000']);
  });
});

describe('값은 서버가 짓는다', () => {
  it('여덟 글자는 저장할 입력을 엔진이 센 것이다', async () => {
    await createSelfPerson(QUERY);
    await editPersonInput('p-self', QUERY);

    const expected = chartSnapshotOf(chartOf(QUERY).pillars);
    expect(sent('create_self_person').map((args) => (args as { p_chart: unknown }).p_chart)).toEqual([expected]);
    expect(sent('edit_person_input').map((args) => (args as { p_chart: unknown }).p_chart)).toEqual([expected]);
  });

  it('참여를 켤 때의 요약은 DB 에 저장된 내 입력에서 지은 것이다', async () => {
    await setParticipation(true);

    const self = selfSummaryOf('p-self', storedChartOf(STORED, '나'))!;
    expect(sent('set_discovery_participation')).toEqual([
      { p_user_id: 'u-session', p_on: true, p_summary: self.summary, p_need: self.need },
    ]);
  });

  it('저장된 입력이 다르면 실리는 요약도 다르다 — 고정값을 싣지 않는다', async () => {
    await setParticipation(true);
    storing({ ...STORED, original_date: '1971-02-20', solar_date: '1971-02-20', birth_time: '03:05:00' });
    await setParticipation(true);

    const [first, second] = sent('set_discovery_participation') as { p_summary: unknown }[];
    expect(first.p_summary).not.toEqual(second.p_summary);
  });

  it('입력을 고치면 요약도 저장된 입력에서 다시 지어 따라간다', async () => {
    await editPersonInput('p-self', QUERY);

    const self = selfSummaryOf('p-self', storedChartOf(STORED, '나'))!;
    expect(sent('ensure_discovery_participation')).toEqual([
      { p_user_id: 'u-session', p_person_id: 'p-self', p_summary: self.summary, p_need: self.need },
    ]);
  });

  it('입력 저장이 거절되면 요약을 따라 올리지 않는다', async () => {
    keyedRpc.mockResolvedValueOnce({ data: null, error: { message: '이 사람의 출생정보를 고칠 수 없습니다.', code: '42501' } });

    const answer = await editPersonInput('p-someone', QUERY);

    expect(answer.error?.code).toBe('42501');
    expect(sent('ensure_discovery_participation')).toEqual([]);
  });

  it('내 사주를 못 세우면 참여를 켜지 않는다 — 빈 요약을 싣지 않는다', async () => {
    vi.mocked(supabaseOnServer).mockResolvedValue({
      from: (table: string) => chain(table === 'app_user' ? OK({ self_person_id: null }) : OK(null)),
    } as never);

    expect(await setParticipation(true)).toEqual({ data: null, error: null, noSelf: true });
    expect(keyedRpc).not.toHaveBeenCalled();
  });
});
