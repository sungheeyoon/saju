import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));

import { supabaseOnServer } from '../auth/server-client';
import { payloadForViewer } from './payload';

/**
 * **못 읽은 엣지를 「없는 사람」으로 내지 않는다**(ADR 0078).
 *
 * `null` 은 「없거나 못 본다」 하나의 답이고 화면은 그것을 없는 사람으로 세운다. 앞서는
 * 엣지의 `error` 를 안 꺼내서, 조회가 터진 것도 그 `null` 로 흘렀다 — 저장한 사람이
 * 사라진 것처럼 보였다. 입력을 못 읽을 때(`storedInputOf`)와 같은 길로 던진다.
 */

type Answer = { data: unknown; error: unknown };

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

const ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';

const PERSON = {
  id: ID,
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

describe('한 사람의 payload', () => {
  it('엣지가 없으면 null 이다 — 없는 것과 못 보는 것을 안 가른다', async () => {
    answering({ person: OK(PERSON), user_person_access: OK(null) });

    expect(await payloadForViewer(ID)).toBeNull();
  });

  it('엣지를 못 읽으면 null 이 아니라 던진다', async () => {
    answering({ person: OK(PERSON), user_person_access: BROKEN });

    await expect(payloadForViewer(ID)).rejects.toThrow('요청을 처리하지 못했습니다');
  });
});
