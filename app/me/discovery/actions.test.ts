import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));
/* 무르는 부름을 적는다 — 덱은 경로가 아니라 지금 화면을 다시 그린다(`app/refresh.ts`) */
const cacheCalls = vi.hoisted(() => [] as string[]);
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => cacheCalls.push(`revalidatePath ${path}`),
  refresh: () => cacheCalls.push('refresh'),
}));
vi.mock('../summary', () => ({ selfElementSummary: vi.fn() }));
/* 참여를 켜는 문은 열쇠 모듈이 세션의 사람으로 부른다(G-64, ADR 0136) — 세션과 열쇠만 가짜로 댄다 */
vi.mock('../../auth/signed-in', () => ({ signedInUser: async () => ({ id: 'u-1', email: undefined }) }));
vi.mock('../../keyed-client', () => ({ keyedClient: () => ({ rpc: async () => ({ data: null, error: null }) }) }));

import { supabaseOnServer } from '../../auth/server-client';
import { selfElementSummary } from '../summary';
import { passCandidate, requestMatch, restorePassed, savePreferGender, setDiscoveryParticipation } from './actions';

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

    expect(await savePreferGender('any')).toEqual({ ok: false, message: '요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.' });
    expect(writes).toEqual([]);
  });
});

/**
 * **내 사주 요약을 못 읽어도 액션은 던지지 않는다.** 요약의 문이 DB 실패를 던지게 된 뒤에도
 * 액션은 값으로 말한다 — 던지면 폼에는 운영 Next 가 바꾼 영어 안내가 선다.
 */
describe('요약을 못 읽은 액션', () => {
  beforeEach(() => {
    vi.mocked(selfElementSummary).mockReset();
    vi.mocked(selfElementSummary).mockRejectedValue(new Error('요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.'));
    vi.mocked(supabaseOnServer).mockResolvedValue({ rpc: async () => ({ data: null, error: null }) } as never);
  });

  it('참여를 켜는 액션은 거절을 값으로 낸다', async () => {
    expect(await setDiscoveryParticipation(true)).toEqual({
      ok: false,
      message: '내 사주를 불러오지 못했어요. 홈 탭에 내 사주 카드가 보이는지 확인하고 다시 시도해 주세요.',
    });
  });

  it('보관함에서 꺼내는 액션은 거절을 값으로 낸다', async () => {
    expect(await restorePassed('someone')).toEqual({ ok: false, message: '내 사주를 먼저 확인해 주세요.' });
  });
});

/**
 * **덱에서 지나치면 지금 화면을 다시 그린다 — 경로를 무르지 않는다**(2026-09-30).
 *
 * 전에는 `/me` 를 물러 경로 무르기의 「임시」 부수효과(지금 화면도 다시 그림)로 덱의 빈자리를 채웠다. Next 가 그
 * 동작을 「그 경로에만」으로 좁히면 덱이 조용히 옛 목록을 든다 — 그래서 `refresh()` 를 부르는지 여기서 잰다.
 */
describe('덱에서 지나치기', () => {
  beforeEach(() => {
    cacheCalls.length = 0;
    vi.mocked(supabaseOnServer).mockResolvedValue({
      from: () => ({ upsert: async () => ({ data: null, error: null }) }),
    } as never);
  });

  it('지나치면 지금 화면을 다시 그리고 경로는 무르지 않는다', async () => {
    expect(await passCandidate('someone')).toEqual({ ok: true });
    expect(cacheCalls).toEqual(['refresh']);
  });
});

/**
 * **잔액을 본 뒤 그 사이 풀이권이 바닥났으면** 요청 문이 잔액으로 막는다 — 화면이 오류 줄 대신 풀이권 창을 열 수 있게 그 거절에 표를 단다
 * (ADR 0171 「덧」). 같은 코드의 다른 거절에는 안 단다.
 */
describe('인연 요청이 풀이권으로 막힌 거절', () => {
  const refusing = (error: { code: string; message: string }) =>
    vi.mocked(supabaseOnServer).mockResolvedValue({ rpc: async () => ({ data: null, error }) } as never);

  it('풀이권이 없어 막혔으면 문장과 함께 outOfCredits 를 단다', async () => {
    const message = '풀이권이 없어 요청할 수 없습니다. 요청 한 건이 풀이권 한 장을 잡고, 동의가 나면 그 한 장으로 궁합 풀이가 만들어집니다.';
    refusing({ code: '23514', message });

    expect(await requestMatch('c-1')).toEqual({ ok: false, message, outOfCredits: true });
  });

  it('같은 코드의 다른 거절은 문장만 낸다', async () => {
    refusing({ code: '23514', message: '이미 요청을 보냈어요.' });

    const answer = await requestMatch('c-1');
    expect(answer.ok).toBe(false);
    expect('outOfCredits' in answer).toBe(false);
  });
});
