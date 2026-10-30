import { bookOf, type Book } from '../(shelf)/readings/book';
import type { ReadingEntry } from '@/src/lib/reading';

/**
 * **인연 기록** — 인연 궁합 전부와 지난 요청(운영자 답 2026-09-29 u2, ADR 0130 덧붙임).
 *
 * 인연 탭 첫 화면은 덱이 주인이라 지나간 것은 「인연 기록 N」 한 줄로만 선다. 그 줄의 수와 한 줄 요약, 그리고 기록 화면
 * (`/me/matching/history`)의 목록이 같은 셈에서 나와야 줄이 말한 수와 화면에 선 수가 갈리지 않는다 — 그래서 셈은 여기 한 자리다.
 */

export { HISTORY_HREF } from './history-href';
export {
  acceptedMatchOf,
  historySummary,
  makingMatches,
  pastRequests,
  type DecidedRequest,
  type HistorySummary,
  type PastRequests,
} from '@/src/lib/matching/history';

/** 인연 궁합 — DB 가 준 차례(최근 것이 앞) 그대로, 표지는 책장의 한 권. 누르면 결과 화면이 「인연 기록」으로 돌아온다 */
export function matchBooks(readings: readonly ReadingEntry[]): readonly Book[] {
  return readings
    .filter((entry) => entry.kind === 'match')
    .map((entry) => {
      const book = bookOf(entry);
      return { ...book, href: `${book.href}?from=history` };
    });
}
