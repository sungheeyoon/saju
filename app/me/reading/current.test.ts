import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readUnreadNotifications } from '../requests/unread';
import { myReadings } from './current';

vi.mock('../../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));

import { supabaseOnServer } from '../../auth/server-client';

/**
 * **읽는 문이 실패를 어떻게 말하는가**(ADR 0078).
 *
 * 세 갈래를 가른다 — 화면의 본체는 던지고, 부속 정보는 값으로 내고, 문이 성공했는데
 * 자료가 없는 것만 `null`·`[]`·`0` 이다.
 *
 * 앞서는 열네 자리가 `if (error) return []` 한 줄로 **「DB 성공 + 자료 없음」과
 * 「DB 실패 + 못 읽음」을 한 값으로 합쳤다.** 그래서 소식 배지가 사라진 화면과 읽을
 * 것이 없는 화면이 같은 얼굴이었고, 어느 쪽인지 묻는 자리가 없었다.
 *
 * 지난 라운드가 같은 종류를 리뷰에서 걸렸다(`bb4f464`) — 문을 모은 뒤에는 **그 문이
 * 실패할 때**를 따로 재야 한다.
 */

const answering = (answer: { data: unknown; error: unknown }) =>
  vi.mocked(supabaseOnServer).mockResolvedValue({ rpc: async () => answer } as never);

const BROKEN = { data: null, error: { message: 'fetch failed' } };

beforeEach(() => vi.mocked(supabaseOnServer).mockReset());

describe('화면의 본체는 던진다', () => {
  it('목록을 못 읽으면 빈 목록이 아니라 던진다', async () => {
    answering(BROKEN);

    await expect(myReadings()).rejects.toThrow();
  });

  /** 던지는 말도 한 문을 지난다 — 영어 원문이 화면에 서지 않는다(`dbFailure`) */
  it('던지는 말에 영어 원문이 안 실린다', async () => {
    answering(BROKEN);

    await expect(myReadings()).rejects.toThrow('요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  });

  it('문이 성공했고 0행이면 빈 목록이다', async () => {
    answering({ data: [], error: null });

    expect(await myReadings()).toEqual([]);
  });
});

/**
 * 표지의 두 일간(G-59) — **천간 열 중 하나만 받는다.** 옛 DB 가 칸을 안 주면(앱이 먼저 배포됐을 때)
 * 회색 표지로 선다.
 */
describe('표지의 일간', () => {
  const row = {
    kind: 'match', person_a: null, person_b: null, match_id: 'm1', label_a: '서하', label_b: null,
    score: 70, metaphor: null, created_at: '2026-09-24T00:00:00Z', from_current_chart: true,
  };

  it('천간 한 글자를 그대로 옮긴다', async () => {
    answering({ data: [{ ...row, day_master_a: '甲', day_master_b: '庚' }], error: null });

    const [entry] = await myReadings();
    expect([entry?.dayMasterA, entry?.dayMasterB]).toEqual(['甲', '庚']);
  });

  it('모르는 글자와 없는 칸은 null 이다', async () => {
    answering({ data: [{ ...row, day_master_a: '木' }], error: null });

    const [entry] = await myReadings();
    expect([entry?.dayMasterA, entry?.dayMasterB]).toEqual([null, null]);
  });
});

/**
 * **목록의 한 줄 요약에 자리 호칭이 날것으로 서지 않는다**(ADR 0181) — 내 궁합은 두 이름표로, 인연 궁합은 내 닉네임과
 * 상대 닉네임으로 바꾼다. 내가 어느 자리인지는 `my_matches` 의 상대 id 와 내 id 를 견줘 안다(`user_low` 가 첫 자리).
 */
describe('목록의 두 사람 요약', () => {
  const ME = '50000000-0000-4000-8000-000000000000';
  const LOW_PARTNER = '10000000-0000-4000-8000-000000000000';
  const HIGH_PARTNER = 'a0000000-0000-4000-8000-000000000000';
  const base = { person_a: null, person_b: null, created_at: '2026-10-15T00:00:00Z', from_current_chart: true, score: 70 };
  const matchRow = (matchId: string, metaphor: string | null) => ({
    ...base, kind: 'match', match_id: matchId, label_a: '바람', label_b: null, metaphor,
  });

  const serving = (
    rows: unknown[],
    { matches = { data: [] as unknown[] | null, error: null as unknown } as { data: unknown[] | null; error: unknown }, me = { id: ME, nickname: '달빛' } as unknown } = {},
  ) => {
    const calls: string[] = [];
    vi.mocked(supabaseOnServer).mockResolvedValue({
      rpc: async (name: string) => {
        calls.push(name);
        return name === 'my_readings' ? { data: rows, error: null } : matches;
      },
      from: () => ({
        select: () => ({ maybeSingle: async () => ({ data: me === null ? null : { status: 'active', ...(me as object) }, error: null }) }),
      }),
    } as never);
    return calls;
  };

  it('내 궁합 — 두 이름표로 바꾼다', async () => {
    serving([{ ...base, kind: 'private', match_id: null, person_a: 'p1', person_b: 'p2', label_a: '엄마', label_b: '아빠', metaphor: '첫번째님이 두번째님을 챙기는 사이' }]);
    const [entry] = await myReadings();
    expect(entry?.metaphor).toBe('엄마님이 아빠님을 챙기는 사이');
  });

  it('인연 궁합 — 내가 첫 자리면 내 닉네임이 첫번째님, 둘째 자리면 두번째님이다', async () => {
    serving(
      [matchRow('m-high', '첫번째님은 묻고 두번째님은 기다리는 사이'), matchRow('m-low', '첫번째님은 묻고 두번째님은 기다리는 사이')],
      { matches: { data: [{ match_id: 'm-high', partner_user_id: HIGH_PARTNER }, { match_id: 'm-low', partner_user_id: LOW_PARTNER }], error: null } },
    );
    const [first, second] = await myReadings();
    expect(first?.metaphor).toBe('달빛님은 묻고 바람님은 기다리는 사이');
    expect(second?.metaphor).toBe('바람님은 묻고 달빛님은 기다리는 사이');
  });

  it('짝을 못 찾거나 못 읽으면 호칭이 남은 요약은 안 세운다 — 호칭 없는 요약은 그대로', async () => {
    serving([matchRow('m-gone', '첫번째님이 먼저 다가가는 사이'), matchRow('m-plain', '서로 속도를 맞춰 가는 사이')], {
      matches: { data: null, error: { message: 'fetch failed' } },
    });
    const [gone, plain] = await myReadings();
    expect(gone?.metaphor).toBeNull();
    expect(plain?.metaphor).toBe('서로 속도를 맞춰 가는 사이');
  });

  it('호칭이 없으면 더 읽지 않는다', async () => {
    const calls = serving([matchRow('m-plain', '서로 속도를 맞춰 가는 사이')]);
    await myReadings();
    expect(calls).toEqual(['my_readings']);
  });
});

/** 풀이권(부속 정보)의 같은 갈래는 `app/me/credits/remaining.test.ts` 가 잰다 */
describe('부속 정보는 값으로 말한다', () => {
  /**
   * **0 과 「모른다」는 다른 값이다.**
   *
   * 앞서는 둘 다 `0` 이라, 배지를 못 읽은 사람과 읽을 소식이 없는 사람이 같은 화면을
   * 봤다. 못 읽은 쪽은 띠를 안 세우는 것이 맞고, 0 인 쪽도 안 세우는 것이 맞지만 —
   * **같은 이유로 안 세우는 것이 아니다.**
   */
  it('소식 0건은 읽어서 안 값이고, 못 읽은 것과 갈린다', async () => {
    answering({ data: [], error: null });
    expect(await readUnreadNotifications(await supabaseOnServer())).toEqual({ ok: true, value: 0 });

    /* 요청이 왔다는 소식은 인연 탭이 센다 — 종의 수에서 빠진다(ADR 0130) */
    answering({
      data: [
        { kind: 'request_received', read_at: null },
        { kind: 'reading_failed', read_at: null },
        { kind: 'request_accepted', read_at: '2026-09-29T00:00:00Z' },
      ],
      error: null,
    });
    expect(await readUnreadNotifications(await supabaseOnServer())).toEqual({ ok: true, value: 1 });

    answering(BROKEN);
    expect((await readUnreadNotifications(await supabaseOnServer())).ok).toBe(false);
  });
});
