import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_QUERY, type Query } from '@/src/lib/input/query';

vi.mock('../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));

import { supabaseOnServer } from '../auth/server-client';
import { sameChartInMyList } from './same-chart';

/**
 * **못 읽은 목록을 「같은 명식이 없다」로 내지 않는다**(ADR 0078).
 *
 * 이 문이 있는 까닭은 풀이권이 두 번 나가는 것을 막는 것이다(ADR 0034). 앞서는 계정과
 * 엣지의 `error` 를 안 꺼내서, 조회가 터지면 `null` — 「같은 사람이 없다」— 이 나고
 * 저장이 묻지 않은 채 밀렸다. 사람 입력을 못 읽을 때(`storedInputsOf`)와 같은 길로 던진다.
 */

type Answer = { data: unknown; error: unknown };

/** 사슬을 어디서 끊든 그 표의 답 하나가 온다 — `.order()` · `.in()` 은 곧 결과다 */
const chain = (answer: Answer) => {
  const link = {
    select: () => link,
    in: async () => answer,
    order: async () => answer,
    maybeSingle: async () => answer,
  };
  return link;
};

const answering = (answers: Record<string, Answer>) =>
  vi.mocked(supabaseOnServer).mockResolvedValue({ from: (table: string) => chain(answers[table]) } as never);

const OK = (data: unknown): Answer => ({ data, error: null });
const BROKEN: Answer = { data: null, error: { message: 'fetch failed' } };

const QUERY: Query = { ...DEFAULT_QUERY, name: '어머니', date: '1990-05-15', time: '14:30' };

beforeEach(() => vi.mocked(supabaseOnServer).mockReset());

describe('내 목록의 같은 명식', () => {
  it('목록이 비었으면 null 이다 — 문은 성공했고 자료가 없다', async () => {
    answering({ app_user: OK({ self_person_id: null }), user_person_access: OK([]) });

    expect(await sameChartInMyList(QUERY)).toBeNull();
  });

  it('엣지를 못 읽으면 null 이 아니라 던진다 — 모르는 채로 저장을 밀지 않는다', async () => {
    answering({ app_user: OK({ self_person_id: null }), user_person_access: BROKEN });

    await expect(sameChartInMyList(QUERY)).rejects.toThrow('요청을 처리하지 못했습니다');
  });

  it('계정을 못 읽으면 던진다 — 나를 남으로 알고 답하지 않는다', async () => {
    answering({ app_user: BROKEN, user_person_access: OK([]) });

    await expect(sameChartInMyList(QUERY)).rejects.toThrow('요청을 처리하지 못했습니다');
  });
});
