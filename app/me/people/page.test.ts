import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));
vi.mock('../reading/current', () => ({ myReadings: async () => [] }));

import { supabaseOnServer } from '../../auth/server-client';
import PeoplePage from './page';

/**
 * **못 읽은 목록을 「저장한 사람이 없다」로 세우지 않는다**(ADR 0078).
 *
 * 목록이 이 화면의 본체다. 앞서는 `user_person_access` 의 `error` 를 안 꺼내서, 조회가
 * 터지면 빈 목록 — 사용자에게는 「내 사람들이 지워졌다」— 이 섰다. 본체라 오류 경계로 던진다.
 */

type Answer = { data: unknown; error: unknown };

const chain = (answer: Answer) => {
  const link = {
    select: () => link,
    eq: () => link,
    order: async () => answer,
    maybeSingle: async () => answer,
  };
  return link;
};

const answering = (tables: Record<string, Answer>) =>
  vi.mocked(supabaseOnServer).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } } }) },
    rpc: async () => ({ data: [{ used: 1, total: 5, remaining: 4 }], error: null }),
    from: (table: string) => chain(tables[table]),
  } as never);

const OK = (data: unknown): Answer => ({ data, error: null });
const ACCOUNT = OK({ status: 'active', self_person_id: 'p-self' });

beforeEach(() => vi.mocked(supabaseOnServer).mockReset());

describe('저장한 사람', () => {
  it('목록이 비었으면 화면이 선다 — 문은 성공했고 자료가 없다', async () => {
    answering({ app_user: ACCOUNT, user_person_access: OK([]) });

    await expect(PeoplePage()).resolves.toBeDefined();
  });

  it('목록을 못 읽으면 빈 목록이 아니라 던진다', async () => {
    answering({ app_user: ACCOUNT, user_person_access: { data: null, error: { message: 'fetch failed' } } });

    await expect(PeoplePage()).rejects.toThrow('요청을 처리하지 못했습니다');
  });
});
