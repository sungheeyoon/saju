import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));

import { supabaseOnServer } from '../auth/server-client';
import { selfElementSummary } from './summary';

/**
 * **못 읽은 것을 「내 사주가 없다」로 내지 않는다**(ADR 0078).
 *
 * 앞서는 계정과 엣지를 읽을 때 `error` 를 안 꺼냈다. 조회가 터지면 `data: null` 이 와서
 * 「selfPerson 이 없다」와 같은 `null` 이 났고, 매칭 화면은 사주가 있는 사람에게 채우러
 * 가는 길을 세웠다. 입력을 고친 뒤의 요약 갱신도 소리 없이 빠졌다.
 */

type Answer = { data: unknown; error: unknown };

/** 사슬을 어디서 끊든 그 표의 답 하나가 온다 */
const chain = (answer: Answer) => {
  const link = {
    select: () => link,
    eq: () => link,
    maybeSingle: async () => answer,
  };
  return link;
};

const answering = (answers: Record<string, Answer>) =>
  vi.mocked(supabaseOnServer).mockResolvedValue({ from: (table: string) => chain(answers[table]) } as never);

const OK = (data: unknown): Answer => ({ data, error: null });
const BROKEN: Answer = { data: null, error: { message: 'fetch failed' } };

const PERSON = {
  id: 'p-1',
  calendar: 'solar',
  original_date: '1990-05-15',
  solar_date: '1990-05-15',
  birth_time: '14:30:00',
  gender: 'male',
  city: '서울',
  late_night_rule: 'jo',
  time_basis: 'localMean',
};

beforeEach(() => vi.mocked(supabaseOnServer).mockReset());

describe('내 오행 요약', () => {
  it('계정 · 엣지 · 입력을 읽으면 요약을 낸다', async () => {
    answering({ app_user: OK({ self_person_id: 'p-1' }), person: OK(PERSON), user_person_access: OK({ local_label: '나' }) });

    expect((await selfElementSummary())?.personId).toBe('p-1');
  });

  it('selfPerson 이 없으면 null 이다 — 문은 성공했고 자료가 없다', async () => {
    answering({ app_user: OK({ self_person_id: null }) });

    expect(await selfElementSummary()).toBeNull();
  });

  it('계정을 못 읽으면 null 이 아니라 던진다', async () => {
    answering({ app_user: BROKEN });

    await expect(selfElementSummary()).rejects.toThrow('요청을 처리하지 못했습니다');
  });

  it('엣지를 못 읽으면 null 이 아니라 던진다', async () => {
    answering({ app_user: OK({ self_person_id: 'p-1' }), person: OK(PERSON), user_person_access: BROKEN });

    await expect(selfElementSummary()).rejects.toThrow('요청을 처리하지 못했습니다');
  });
});
