import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));
vi.mock('../../auth/signed-in', () => ({ signedInUser: async () => ({ id: 'u-1', email: undefined }) }));
vi.mock('../summary', () => ({
  selfElementSummary: async () => ({
    personId: 'p-self',
    summary: {
      glyphCount: 8,
      counts: { 木: 2, 火: 2, 土: 2, 金: 1, 水: 1 },
      ratios: { 木: 0.25, 火: 0.25, 土: 0.25, 金: 0.125, 水: 0.125 },
    },
    need: { primary: '木', heaviest: '金', rule: 'test-rule' },
  }),
}));
vi.mock('../discovery/discovery-profile', () => ({ myDiscoveryProfile: async () => ({ ok: true, value: null }) }));
vi.mock('../payload', () => ({ payloadForViewer: async () => null }));
vi.mock('../requests/inbox', () => ({ requestsForViewer: async () => ({ requests: [], blocked: 0 }) }));
vi.mock('../reading/current', () => ({ myReadings: vi.fn(async () => []) }));
vi.mock('../candidates', () => ({
  candidatesForViewer: async () => ({ cards: [], teaser: null, notice: null }),
  passedForViewer: async () => [],
}));

import { supabaseOnServer } from '../../auth/server-client';
import { myReadings } from '../reading/current';
import MatchingPage from './page';
import { RecentMatchShelf } from './recent-match-shelf';

/**
 * **참여를 못 열어 본 것을 「참여할 수 없다」로 세우지 않는다**(ADR 0078).
 *
 * `ensure_discovery_participation` 이 `false` 를 내면 자격이 없는 것이고, 화면은 채우러 가는
 * 길(`Guide`)을 세운다. 앞서는 `error` 를 안 꺼내서 부름이 터진 것도 그 길로 흘렀다 — 사주가
 * 있는 사람이 「사주를 먼저 채우라」를 받았다. 덱이 이 화면의 본체라 오류 경계로 던진다.
 */

const answering = (joined: { data: unknown; error: unknown }) =>
  vi.mocked(supabaseOnServer).mockResolvedValue({
    rpc: async () => joined,
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: { status: 'active', self_person_id: 'p-self' }, error: null }) }) }),
  } as never);

beforeEach(() => vi.mocked(supabaseOnServer).mockReset());

describe('오늘의 인연', () => {
  it('자격이 없으면(`false`) 화면이 선다 — 문은 성공했고 답이 「아니다」다', async () => {
    answering({ data: false, error: null });

    /*
      **무엇이 섰는지 본다.** 「무언가 돌아왔다」만 재면 덱이 서도, 쉬는 자리가 서도 통과한다.
      안내는 채우러 가는 길(`/me`)을 들고, 가운데에 내 표식이 선다 — 사주가 없어서 선 안내
      (`me` 가 `null`)와 갈린다.
    */
    const page = (await MatchingPage()) as { type: unknown; props: { me: unknown } };
    expect(typeof page.type === 'function' && page.type.name).toBe('Guide');
    expect(page.props.me).not.toBeNull();

    const drawn = (page.type as (props: unknown) => { props: { href: string } })(page.props);
    expect(drawn.props.href).toBe('/me');
  });

  it('참여를 여는 부름이 터지면 안내가 아니라 던진다', async () => {
    answering({ data: null, error: { message: 'fetch failed' } });

    await expect(MatchingPage()).rejects.toThrow('요청을 처리하지 못했습니다');
  });

  /*
    **최근 인연 궁합은 부속 정보다**(ADR 0078, 2026-09-29 e+). 풀이 목록 문이 터져도 화면은 서고, 그 구역만 못 읽었다는
    값을 받는다 — 덱을 세우는 부름 뒤로 밀리지도, 덱을 막지도 않는다.
  */
  it('풀이 목록을 못 읽어도 화면은 서고 최근 인연 궁합 구역만 비운다', async () => {
    answering({ data: false, error: null });
    vi.mocked(myReadings).mockRejectedValueOnce(new Error('fetch failed'));

    const page = (await MatchingPage()) as { props: { tail: { props: { children: { type: unknown; props: unknown }[] } } } };
    const shelf = page.props.tail.props.children.find((child) => child.type === RecentMatchShelf);
    expect(shelf?.props).toMatchObject({ loaded: { ok: false } });
  });
});
