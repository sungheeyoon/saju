import Link from 'next/link';

import { BUTTON_TERTIARY } from '../ui/buttons';
import { Icon } from '../ui/icons';
import { TYPE_SECTION } from '../ui/surfaces';
import { bookOf } from '../me/(shelf)/readings/book';
import { PairCover } from '../me/(shelf)/readings/shelf';
import type { ReadingEntry } from '../me/reading/current';

/** 이 탭에 서는 최근 궁합풀이의 수 — 나머지는 풀이 보관함의 궁합풀이 필터가 든다(ADR 0129 「2026-09-29 e+」) */
export const RECENT_COMPAT = 3;

/** 궁합풀이만 걸러 보는 풀이 보관함 — 모르는 값이면 보관함이 전체로 떨어지므로 먼저 걸어도 안전하다 */
export const COMPAT_SHELF_HREF = '/me/readings?kind=compat';

/**
 * 궁합 탭에 서는 궁합풀이 — **직접 본 궁합만, 최근 것 셋.**
 *
 * 직접 본 궁합은 `private`(저장한 사람 · 적어 넣은 사람끼리)이다. 인연 궁합(`match`)은 이 탭에 안 선다 — 인연 탭이
 * 제 자리에 세운다(ADR 0126 · 0130). 차례는 DB 가 준 그대로(최근 것이 앞)이고 여기서 다시 정렬하지 않는다.
 */
export function recentCompat(readings: readonly ReadingEntry[]): { recent: ReadingEntry[]; more: boolean } {
  const direct = readings.filter((entry) => entry.kind === 'private');
  return { recent: direct.slice(0, RECENT_COMPAT), more: direct.length > RECENT_COMPAT };
}

/**
 * **최근 궁합풀이** — 책장의 궁합 표지 그대로, 셋까지(ADR 0129 「2026-09-29 e+」).
 *
 * 셋을 넘으면 「모두 보기」가 풀이 보관함의 궁합풀이 필터로 간다. 한 권도 없으면 이 구역은 안 선다 — 바로 위의
 * 고르는 칸이 궁합을 만드는 자리다.
 */
export function CompatArchive({ readings }: { readings: readonly ReadingEntry[] }) {
  const { recent, more } = recentCompat(readings);
  if (recent.length === 0) return null;

  return (
    <section aria-labelledby="compat-recent" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 id="compat-recent" className={TYPE_SECTION}>
          최근 궁합풀이
        </h2>
        {more && (
          <Link href={COMPAT_SHELF_HREF} className={BUTTON_TERTIARY}>
            모두 보기
            <Icon name="arrow" className="size-4" />
          </Link>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {recent.map((entry) => {
          const book = bookOf(entry);
          return (
            <li key={book.key}>
              <PairCover book={book} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
