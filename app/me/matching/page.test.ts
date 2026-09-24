import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));
vi.mock('../summary', () => ({
  selfElementSummary: async () => ({
    personId: 'p-self',
    summary: {
      glyphCount: 8,
      counts: { 木: 2, 火: 2, 土: 2, 金: 1, 水: 1 },
      ratios: { 木: 0.25, 火: 0.25, 土: 0.25, 金: 0.125, 水: 0.125 },
    },
  }),
}));
vi.mock('../discovery/discovery-profile', () => ({ myDiscoveryProfile: async () => ({ ok: true, value: null }) }));
vi.mock('../payload', () => ({ payloadForViewer: async () => null }));
vi.mock('../candidates', () => ({
  candidatesForViewer: async () => ({ cards: [], teaser: null, notice: null }),
  boardStamp: async () => null,
  passedForViewer: async () => [],
}));

import { supabaseOnServer } from '../../auth/server-client';
import MatchingPage from './page';

/**
 * **참여를 못 열어 본 것을 「참여할 수 없다」로 세우지 않는다**(ADR 0078).
 *
 * `ensure_discovery_participation` 이 `false` 를 내면 자격이 없는 것이고, 화면은 채우러 가는
 * 길(`Guide`)을 세운다. 앞서는 `error` 를 안 꺼내서 부름이 터진 것도 그 길로 흘렀다 — 사주가
 * 있는 사람이 「사주를 먼저 채우라」를 받았다. 덱이 이 화면의 본체라 오류 경계로 던진다.
 */

const answering = (joined: { data: unknown; error: unknown }) =>
  vi.mocked(supabaseOnServer).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } } }) },
    rpc: async () => joined,
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: { status: 'active', self_person_id: 'p-self' }, error: null }) }) }),
  } as never);

beforeEach(() => vi.mocked(supabaseOnServer).mockReset());

describe('오늘의 인연', () => {
  it('자격이 없으면(`false`) 화면이 선다 — 문은 성공했고 답이 「아니다」다', async () => {
    answering({ data: false, error: null });

    await expect(MatchingPage()).resolves.toBeDefined();
  });

  it('참여를 여는 부름이 터지면 안내가 아니라 던진다', async () => {
    answering({ data: null, error: { message: 'fetch failed' } });

    await expect(MatchingPage()).rejects.toThrow('요청을 처리하지 못했습니다');
  });
});
