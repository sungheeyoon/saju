import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

import { supabaseOnServer } from '../../auth/server-client';
import { savePreferGender } from './actions';

/**
 * **처음인지를 못 읽었으면 저장하지 않고 값으로 말한다**(ADR 0078).
 *
 * 앞서는 `discovery_profile` 을 읽을 때 `error` 를 안 꺼냈다. 조회가 터지면 「처음이다」로
 * 읽혀 새 행을 넣으러 갔고, 폼에는 그 넣기가 낸 엉뚱한 거절이 섰다.
 */

type Answer = { data: unknown; error: unknown };

const writes: string[] = [];

const answering = (read: Answer) =>
  vi.mocked(supabaseOnServer).mockResolvedValue({
    from: () => ({
      select: () => ({ maybeSingle: async () => read }),
      insert: async () => {
        writes.push('insert');
        return { data: null, error: null };
      },
      update: () => ({
        eq: async () => {
          writes.push('update');
          return { data: null, error: null };
        },
      }),
    }),
  } as never);

beforeEach(() => {
  vi.mocked(supabaseOnServer).mockReset();
  writes.length = 0;
});

describe('만나볼 상대의 조건', () => {
  it('처음이면 넣는다', async () => {
    answering({ data: null, error: null });

    expect(await savePreferGender('any')).toEqual({ ok: true });
    expect(writes).toEqual(['insert']);
  });

  it('처음인지를 못 읽으면 쓰지 않고 거절을 값으로 낸다', async () => {
    answering({ data: null, error: { message: 'fetch failed' } });

    expect(await savePreferGender('any')).toEqual({ ok: false, message: '요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' });
    expect(writes).toEqual([]);
  });
});
