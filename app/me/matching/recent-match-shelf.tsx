import Link from 'next/link';

import type { SkippableRead } from '../../db-error';
import { Icon } from '../../ui/icons';
import { TYPE_SECTION } from '../../ui/surfaces';
import { PairCover } from '../(shelf)/readings/shelf';
import { ALL_MATCHES_HREF, type RecentMatches } from './recent-matches';

/**
 * **최근 인연 궁합** — 덱 아래, 인연에서 난 궁합풀이 최근 셋(2026-09-29 e+, ADR 0130 덧붙임).
 *
 * 표지는 책장의 궁합 표지 그대로다(`PairCover`) — 누르면 제 결과 화면(`/me/match/…`)으로 가고 거기서도 인연 탭이
 * 켜진다(ADR 0126). 셋 밖에 더 있으면 「모두 보기」가 탭 불이 없는 풀이 보관함의 인연 궁합 필터로 보낸다.
 *
 * **부속 정보다**(ADR 0078) — 못 읽으면 이 구역만 안 서고 덱은 그대로 선다. 한 권도 없어도 안 선다: 인연 궁합은
 * 요청이 수락돼야 생기므로 빈 자리에 줄 갈 길이 이 탭의 덱 말고는 없다.
 */
export function RecentMatchShelf({ loaded }: { loaded: SkippableRead<RecentMatches> }) {
  if (!loaded.ok || loaded.value.books.length === 0) return null;
  const { books, more } = loaded.value;

  return (
    <section aria-labelledby="recent-matches" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="recent-matches" className={TYPE_SECTION}>
          최근 인연 궁합
        </h2>
        {more && (
          <Link
            href={ALL_MATCHES_HREF}
            className="inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold text-secondary hover:text-foreground"
          >
            모두 보기
            <Icon name="arrow" className="size-4" />
          </Link>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {books.map((book) => (
          <li key={book.key}>
            <PairCover book={book} />
          </li>
        ))}
      </ul>
    </section>
  );
}
