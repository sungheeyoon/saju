import { bookOf, type Book } from '../(shelf)/readings/book';
import type { ReadingEntry } from '../reading/current';

/** 인연 탭에 서는 인연 궁합의 수 — 운영자 답(2026-09-29 e+)이 「최근 결과 3개」다 */
export const RECENT_MATCH_LIMIT = 3;

/** 나머지를 다 보는 자리 — 탭 불이 없는 풀이 보관함의 인연 궁합 필터(ADR 0130 「2026-09-29 e+」) */
export const ALL_MATCHES_HREF = '/me/readings?kind=match';

export type RecentMatches = {
  readonly books: readonly Book[];
  /** 셋 밖에 더 있는가 — 있을 때만 「모두 보기」가 선다 */
  readonly more: boolean;
};

/**
 * 내가 만든 글 중 **인연 궁합만, 최근 것부터 셋.**
 *
 * 차례는 DB 가 정한다(`my_readings` 는 최근 것이 앞이다) — 여기서 다시 정렬하지 않고 갈래만 고른다. 차단한 사람과의
 * 글은 문이 이미 뺐다. 표지는 책장과 같은 한 권(`bookOf`)이라 누르면 제 결과 화면(`/me/match/…`)으로 간다.
 */
export function recentMatches(readings: readonly ReadingEntry[]): RecentMatches {
  const matches = readings.filter((entry) => entry.kind === 'match');
  return {
    books: matches.slice(0, RECENT_MATCH_LIMIT).map(bookOf),
    more: matches.length > RECENT_MATCH_LIMIT,
  };
}
