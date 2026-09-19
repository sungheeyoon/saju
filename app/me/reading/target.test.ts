import { describe, expect, it } from 'vitest';

import { READING_KINDS, type ReadingKind } from '@/src/lib/reading';

import {
  isShareable,
  readingHrefOf,
  readingPathsOf,
  readingTargetArgs,
  shareTargetArgs,
  type ReadingTarget,
} from './target';

/**
 * **네 갈래를 푸는 자리가 하나인가.**
 *
 * 앞서는 같은 갈래가 네 자리에서 따로 풀렸다(`current.ts`·`pipeline.ts`·`share.ts`·
 * `actions.ts`). 한 벌로 모은 뒤 여기서 붙드는 것은 **그 한 벌이 네 갈래를 다 덮는가**와
 * **공유가 인연 궁합을 실을 수 없는가** 둘이다.
 */

const SAMPLE: { readonly [K in ReadingKind]: Extract<ReadingTarget, { kind: K }> } = {
  self: { kind: 'self' },
  person: { kind: 'person', personId: 'p1' },
  private: { kind: 'private', personA: 'p1', personB: 'p2' },
  match: { kind: 'match', matchId: 'm1' },
};

describe('대상을 RPC 인자로', () => {
  /**
   * 갈래가 하나 늘면 **여기가 먼저 깨진다.** `READING_KINDS` 는 계약이 드는 목록이고,
   * 그 목록에 이름이 늘었는데 푸는 자리가 안 늘면 그 갈래는 조용히 `self` 처럼 나간다.
   */
  it('계약이 드는 네 낱말을 다 푼다', () => {
    for (const kind of READING_KINDS) {
      expect(readingTargetArgs(SAMPLE[kind]).p_kind).toBe(kind);
    }
  });

  /** `self` 는 아무것도 안 싣는다 — DB 가 스스로 내 사람을 찾는다 */
  it('내 사주는 대상 id 를 한 자도 안 싣는다', () => {
    expect(readingTargetArgs(SAMPLE.self)).toEqual({
      p_kind: 'self',
      p_person_a: null,
      p_person_b: null,
      p_match_id: null,
    });
  });

  it('저장한 사람은 한 사람만 싣는다', () => {
    expect(readingTargetArgs(SAMPLE.person)).toEqual({
      p_kind: 'person',
      p_person_a: 'p1',
      p_person_b: null,
      p_match_id: null,
    });
  });

  it('고른 두 사람은 둘 다 싣고, 차례가 그대로다', () => {
    expect(readingTargetArgs(SAMPLE.private)).toEqual({
      p_kind: 'private',
      p_person_a: 'p1',
      p_person_b: 'p2',
      p_match_id: null,
    });
  });

  /** 인연 궁합은 사람이 아니라 **Match 를** 댄다 — 두 사람은 DB 가 그 행에서 찾는다 */
  it('인연 궁합은 사람 대신 Match 를 댄다', () => {
    expect(readingTargetArgs(SAMPLE.match)).toEqual({
      p_kind: 'match',
      p_person_a: null,
      p_person_b: null,
      p_match_id: 'm1',
    });
  });
});

describe('공유하는 문', () => {
  it('셋은 열리고 인연 궁합은 닫힌다', () => {
    expect(isShareable(SAMPLE.self)).toBe(true);
    expect(isShareable(SAMPLE.person)).toBe(true);
    expect(isShareable(SAMPLE.private)).toBe(true);
    expect(isShareable(SAMPLE.match)).toBe(false);
  });

  /**
   * **`p_match_id` 자리가 아예 없어야 한다.**
   *
   * `null` 로 실어 보내는 것과 안 싣는 것은 다르다 — PostgREST 는 **인자 이름 묶음으로**
   * 문을 고르므로(#75 가 그것으로 떨어졌다), 키 하나가 늘면 `share_my_reading` 을 아예
   * 못 찾는다. 그래서 값이 아니라 **키 목록**을 잰다.
   */
  it('공유 인자에는 Match 자리가 아예 없다', () => {
    for (const kind of ['self', 'person', 'private'] as const) {
      expect(Object.keys(shareTargetArgs(SAMPLE[kind])).sort()).toEqual([
        'p_kind',
        'p_person_a',
        'p_person_b',
      ]);
    }
  });

  it('공유도 같은 사람을 같은 차례로 싣는다', () => {
    expect(shareTargetArgs(SAMPLE.private)).toEqual({
      p_kind: 'private',
      p_person_a: 'p1',
      p_person_b: 'p2',
    });
    expect(shareTargetArgs(SAMPLE.person)).toEqual({
      p_kind: 'person',
      p_person_a: 'p1',
      p_person_b: null,
    });
  });
});

describe('가는 곳과 무를 곳', () => {
  it('네 갈래가 저마다 제 대상의 화면으로 간다', () => {
    expect(readingHrefOf(SAMPLE.self)).toBe('/me/readings/self');
    expect(readingHrefOf(SAMPLE.person)).toBe('/me/readings/p1');
    expect(readingHrefOf(SAMPLE.private)).toBe('/me/compat?a=p1&b=p2');
    expect(readingHrefOf(SAMPLE.match)).toBe('/me/match/m1');
  });

  /** 갈래가 늘면 무를 곳이 빈 채로 서는 일이 없어야 한다 — 그러면 옛 글이 남는다 */
  it('어떤 갈래든 무를 곳이 적어도 하나 있다', () => {
    for (const kind of READING_KINDS) {
      expect(readingPathsOf(SAMPLE[kind]).length).toBeGreaterThan(0);
    }
  });

  /**
   * `revalidatePath` 는 질의 문자열을 안 본다. 그래서 비공개 궁합만 **주소와 무를 곳이
   * 다르다** — 그 차이를 값으로 들어 둔다.
   */
  it('비공개 궁합은 질의 없는 경로를 무른다', () => {
    expect(readingPathsOf(SAMPLE.private)).toEqual(['/me/compat']);
    expect(readingHrefOf(SAMPLE.private)).toContain('?');
  });

  it('나머지 셋은 가는 곳과 무를 곳이 같다', () => {
    for (const kind of ['self', 'person', 'match'] as const) {
      expect(readingPathsOf(SAMPLE[kind])).toEqual([readingHrefOf(SAMPLE[kind])]);
    }
  });
});
