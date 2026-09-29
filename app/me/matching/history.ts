import type { SkippableRead } from '../../db-error';
import { bookOf, type Book } from '../(shelf)/readings/book';
import type { ReadingEntry } from '../reading/current';
import type { InboxMatch, InboxRequest, Requests } from '../requests/inbox';

/**
 * **인연 기록** — 인연 궁합 전부와 지난 요청(운영자 답 2026-09-29 u2, ADR 0130 덧붙임).
 *
 * 인연 탭 첫 화면은 덱이 주인이라 지나간 것은 「인연 기록 N」 한 줄로만 선다. 그 줄의 수와 한 줄 요약, 그리고 기록 화면
 * (`/me/matching/history`)의 목록이 같은 셈에서 나와야 줄이 말한 수와 화면에 선 수가 갈리지 않는다 — 그래서 셈은 여기 한 자리다.
 */

/** 기록 화면 — 인연 탭에 불이 켜진 채 들어간다(주소가 `/me/matching` 아래다) */
export const HISTORY_HREF = '/me/matching/history';

/** 인연 궁합 — DB 가 준 차례(최근 것이 앞) 그대로, 표지는 책장의 한 권. 누르면 결과 화면이 「인연 기록」으로 돌아온다 */
export function matchBooks(readings: readonly ReadingEntry[]): readonly Book[] {
  return readings
    .filter((entry) => entry.kind === 'match')
    .map((entry) => {
      const book = bookOf(entry);
      return { ...book, href: `${book.href}?from=history` };
    });
}

/**
 * 성립했지만 글이 아직 없는 인연 궁합 — 수락 직후 풀이가 만들어지는 동안이다. 책장(`/me/readings`)과 같은 셈으로 가른다:
 * 성립한 Match(`my_matches`) 가운데 글(`my_readings`)이 없는 것.
 */
export function makingMatches(readings: readonly ReadingEntry[], matches: readonly InboxMatch[]): readonly InboxMatch[] {
  const made = new Set(readings.flatMap((entry) => (entry.kind === 'match' && entry.matchId !== null ? [entry.matchId] : [])));
  return matches.filter((match) => !made.has(match.matchId));
}

export type PastRequests = {
  /** 내가 보내고 답을 기다리는 요청 */
  readonly sent: readonly InboxRequest[];
  /** 답이 났거나 무효 · 기한 지남으로 끝난 요청 — 방향을 가리지 않는다 */
  readonly decided: readonly InboxRequest[];
  readonly blocked: number;
};

/** 지난 요청 — 답할 일(받은 요청)은 빠진다. 그것은 탭 맨 위 띠가 든다 */
export function pastRequests({ requests, blocked }: Requests): PastRequests {
  return {
    sent: requests.filter((request) => request.direction === 'sent' && request.status === 'pending'),
    decided: requests.filter((request) => request.status !== 'pending'),
    blocked,
  };
}

export type HistorySummary = {
  readonly count: number;
  /** 「인연 궁합 4 · 지난 요청 3 — 최근 다온」 */
  readonly hint: string;
};

/**
 * 요약 한 줄 — **수가 0 이면 줄이 안 선다**(`null`). 인연 궁합은 성립한 Match 의 수다(`my_matches` — 글이 만들어지는 중인 것도
 * 센다. 기록 화면은 그것을 「만드는 중」으로 세운다). 둘 중 하나를 못 읽었으면 읽은 쪽만 센다 — 부속 정보라(ADR 0078) 못 읽은
 * 까닭은 기록 화면이 말한다. 둘 다 못 읽었으면 줄이 안 선다.
 */
export function historySummary(
  matches: SkippableRead<readonly InboxMatch[]>,
  requests: SkippableRead<Requests>,
): HistorySummary | null {
  const made = matches.ok ? matches.value.length : null;
  const past = requests.ok ? (({ sent, decided }) => sent.length + decided.length)(pastRequests(requests.value)) : null;
  const count = (made ?? 0) + (past ?? 0);
  if (count === 0) return null;

  const parts = [made === null ? null : `인연 궁합 ${made}`, past === null ? null : `지난 요청 ${past}`].filter(
    (part) => part !== null,
  );
  /* `my_matches` 는 최근 것이 앞이다 */
  const latest = matches.ok ? (matches.value[0]?.nickname ?? '') : '';
  return { count, hint: latest === '' ? parts.join(' · ') : `${parts.join(' · ')} — 최근 ${latest}` };
}
