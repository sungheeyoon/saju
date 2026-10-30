import type { ReadingEntry } from '../reading';

import type { InboxMatch, InboxRequest, Requests } from './inbox';

/**
 * **인연 기록의 셈** — 인연 탭의 「인연 기록 N」 한 줄과 기록 화면이 같은 셈에서 나와야 줄이 말한 수와 화면에 선 수가 갈리지 않는다.
 * 웹(`app/me/matching/history.ts`)과 앱이 함께 쓴다.
 */

/** 못 읽을 수 있는 부속 읽기 — `app/db-error.ts` 의 `SkippableRead` 와 같은 모양 */
type Skippable<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

/** 결과 화면의 ← 가 돌아올 곳을 싣는다 — 이미 실었으면 그대로다(`app/came-from.ts` 의 `withCameFrom` 과 같은 답) */
export function withFrom(href: string, from: 'history' | 'news'): string {
  if (/[?&]from=/.test(href)) return href;
  return `${href}${href.includes('?') ? '&' : '?'}from=${from}`;
}

/**
 * 성립했지만 글이 아직 없는 인연 궁합 — 수락 직후 풀이가 만들어지는 동안이다. 책장(`/me/readings`)과 같은 셈으로 가른다:
 * 성립한 Match(`my_matches`) 가운데 글(`my_readings`)이 없는 것.
 */
export function makingMatches(readings: readonly ReadingEntry[], matches: readonly InboxMatch[]): readonly InboxMatch[] {
  const made = new Set(readings.flatMap((entry) => (entry.kind === 'match' && entry.matchId !== null ? [entry.matchId] : [])));
  return matches.filter((match) => !made.has(match.matchId));
}

/**
 * 성립한 요청이 여는 인연 궁합 — **지금 볼 수 있는 Match 가운데 상대가 같은 것**이다.
 *
 * 한 쌍 사이의 Match 는 하나뿐이라(`match` 의 `unique (user_low, user_high)`) 상대로 찾으면 그 요청의 Match 다. 요청 줄은
 * Match id 를 안 든다 — 읽는 문을 넓히지 않고 이미 내려오는 두 문(`my_match_requests` · `my_matches`)을 잇는다. 차단 · 정지로
 * 닫힌 Match 는 `my_matches` 에 없으니 `null` 이다 — 누르면 404 가 되는 링크를 세우지 않는다.
 */
export function acceptedMatchOf(
  request: Pick<InboxRequest, 'status' | 'counterpartUserId'>,
  matches: readonly Pick<InboxMatch, 'matchId' | 'partnerUserId'>[],
): string | null {
  if (request.status !== 'accepted') return null;
  return matches.find((match) => match.partnerUserId === request.counterpartUserId)?.matchId ?? null;
}

/** 끝난 요청 한 줄 — 성립해 지금 열 수 있는 인연 궁합이 있으면 그 주소를 든다 */
export type DecidedRequest = InboxRequest & {
  /** `/me/match/[id]?from=history` — 성립하지 않았거나 그 Match 를 지금 못 열면(차단 · 정지) `null` */
  readonly matchHref: string | null;
};

export type PastRequests = {
  /** 내가 보내고 답을 기다리는 요청 */
  readonly sent: readonly InboxRequest[];
  /** 답이 났거나 무효 · 기한 지남으로 끝난 요청 — 방향을 가리지 않는다 */
  readonly decided: readonly DecidedRequest[];
  readonly blocked: number;
};

/**
 * 지난 요청 — 답할 일(받은 요청)은 빠진다. 그것은 탭 맨 위 띠가 든다.
 *
 * **성립한 끝난 요청은 그 인연 궁합으로 간다**(ADR 0130 「2026-10-11」). 갈 곳은 성립한 Match(`my_matches`)에서 찾고, 그 목록을
 * 못 읽었거나(`null`) 거기 없으면 링크를 안 세운다 — 누르면 404 가 되는 줄을 만들지 않는다.
 */
export function pastRequests(
  { requests, blocked }: Requests,
  matches: readonly InboxMatch[] | null = null,
): PastRequests {
  return {
    sent: requests.filter((request) => request.direction === 'sent' && request.status === 'pending'),
    decided: requests
      .filter((request) => request.status !== 'pending')
      .map((request) => {
        const matchId = matches === null ? null : acceptedMatchOf(request, matches);
        return { ...request, matchHref: matchId === null ? null : withFrom(`/me/match/${matchId}`, 'history') };
      }),
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
  matches: Skippable<readonly InboxMatch[]>,
  requests: Skippable<Requests>,
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
