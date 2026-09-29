import { describe, expect, it } from 'vitest';

import type { ReadingEntry } from '../reading/current';
import { recentMatches } from './recent-matches';

/**
 * 인연 탭의 최근 인연 궁합 — **인연 궁합만, DB 가 준 차례대로 셋**(2026-09-29 e+).
 *
 * 직접 본 궁합이나 한 사람 풀이가 섞이면 궁합 탭 · 보관함과 같은 글이 여기 또 선다. 차례를 여기서 다시 세우면
 * 판정하는 자리가 둘이 된다.
 */
const entry = (over: Partial<ReadingEntry>): ReadingEntry => ({
  kind: 'match',
  personA: null,
  personB: null,
  matchId: null,
  labelA: null,
  labelB: null,
  score: null,
  metaphor: null,
  createdAt: '2026-09-03T00:00:00Z',
  fromCurrentChart: true,
  dayMasterA: null,
  dayMasterB: null,
  ...over,
});

const match = (id: string) => entry({ kind: 'match', matchId: id, labelB: id });

describe('최근 인연 궁합', () => {
  it('인연 궁합만 고르고 받은 차례 그대로 셋까지 세운다', () => {
    const got = recentMatches([
      entry({ kind: 'self' }),
      match('m1'),
      entry({ kind: 'private', personA: 'a', personB: 'b' }),
      match('m2'),
      match('m3'),
      match('m4'),
    ]);

    expect(got.books.map((book) => book.href)).toEqual(['/me/match/m1', '/me/match/m2', '/me/match/m3']);
    expect(got.more).toBe(true);
  });

  it('셋 이하면 「모두 보기」가 안 선다', () => {
    expect(recentMatches([match('m1'), match('m2'), match('m3')]).more).toBe(false);
  });

  it('인연 궁합이 없으면 빈 구역이다 — 직접 본 궁합은 여기 안 선다', () => {
    const got = recentMatches([entry({ kind: 'private', personA: 'a', personB: 'b' }), entry({ kind: 'self' })]);
    expect(got).toEqual({ books: [], more: false });
  });
});
