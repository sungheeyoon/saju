import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));

import { supabaseOnServer } from '../../auth/server-client';
import ProfilePage from './page';

/**
 * **못 읽은 사진을 「사진이 없다」로 세우지 않는다**(ADR 0078).
 *
 * 사진 칸은 있는가 없는가로 단추와 미리보기가 갈린다. 앞서는 `photo_of` 의 `error` 를 안
 * 꺼내서, 부름이 터지면 사진이 있는 사람에게 「사진 올리기」가 섰다. 그 자리만 비우려면
 * 없는 문장이 필요하므로, 고치는 폼인 이 화면은 오류 경계로 던진다.
 */

const answering = (photo: { data: unknown; error: unknown }) =>
  vi.mocked(supabaseOnServer).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } } }) },
    rpc: async () => photo,
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: { status: 'active', nickname: '민수', intro: null }, error: null }) }),
    }),
  } as never);

beforeEach(() => vi.mocked(supabaseOnServer).mockReset());

describe('프로필', () => {
  it('사진이 없으면 화면이 선다 — 문은 성공했고 자료가 없다', async () => {
    answering({ data: [], error: null });

    await expect(ProfilePage()).resolves.toBeDefined();
  });

  it('사진을 못 읽으면 「사진 없음」이 아니라 던진다', async () => {
    answering({ data: null, error: { message: 'fetch failed' } });

    await expect(ProfilePage()).rejects.toThrow('요청을 처리하지 못했습니다');
  });
});
