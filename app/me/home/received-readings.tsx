import Link from 'next/link';

import { BUTTON_TERTIARY } from '../../ui/buttons';
import { Icon } from '../../ui/icons';
import { TYPE_SECTION } from '../../ui/surfaces';
import { bookOf } from '../(shelf)/readings/book';
import { BlankBook, SingleCover } from '../(shelf)/readings/shelf';
import type { ReadingEntry } from '../reading/current';

/** 홈에 서는 표지 수 — 폰 두 줄 · 넓은 화면 한 줄. 나머지는 책장이 든다 */
const SHOWN = 4;

/**
 * **내가 받은 사주풀이** — 한 사람 풀이(나 · 저장한 사람)만, 책장의 표지 그대로(ADR 0129).
 *
 * 궁합풀이는 궁합 탭의 보관함에 선다. 차례는 DB 가 준 그대로(최근 것이 앞)이고 앞의 몇 권만 세운다 — 전부는
 * 「만든 풀이 다시 보기」(책장, `/me/readings`)가 든다. 표지를 누르면 책장의 그 글이 열린다.
 *
 * 내 사주풀이가 아직 없으면 점선 한 권이 받는 자리로 간다 — 책장의 빈 자리와 같은 모양이다.
 */
export function ReceivedReadings({ readings }: { readings: readonly ReadingEntry[] }) {
  const singles = readings.map(bookOf).filter((book) => book.single);
  const hasSelf = readings.some((entry) => entry.kind === 'self');
  const shown = singles.slice(0, hasSelf ? SHOWN : SHOWN - 1);

  return (
    <section aria-labelledby="home-readings" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 id="home-readings" className={`${TYPE_SECTION} flex items-baseline gap-2`}>
          내가 받은 사주풀이
          {singles.length > 0 && (
            <span className="font-sans text-[13px] font-semibold tabular-nums text-secondary">{singles.length}개</span>
          )}
        </h2>
        {singles.length > shown.length && (
          <Link href="/me/readings" className={BUTTON_TERTIARY}>
            만든 풀이 다시 보기
            <Icon name="arrow" className="size-4" />
          </Link>
        )}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {shown.map((book) => (
          <li key={book.key}>
            <SingleCover book={book} />
          </li>
        ))}
        {!hasSelf && <BlankBook href="/me/readings/self" element="木" label="내 사주풀이" />}
      </ul>
    </section>
  );
}
