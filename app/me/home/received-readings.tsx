import Link from 'next/link';

import { BUTTON_TERTIARY } from '../../ui/buttons';
import { Icon } from '../../ui/icons';
import { TYPE_SECTION } from '../../ui/surfaces';
import { bookOf } from '../(shelf)/readings/book';
import { SHELF_TITLE, withShelfKind } from '../(shelf)/readings/kind';
import { BlankBook, SingleCover } from '../(shelf)/readings/shelf';
import type { ReadingEntry } from '../reading/current';
import { withFromMe } from './from-me';

/** 나 탭 홈에 서는 표지 수 — **한 줄 셋**(u2, 운영자 2026-09-29). 넷을 두 줄로 세우면 저장한 사람 머리가 폰 첫 화면 밖으로 나갔다 */
const SHOWN = 3;

/**
 * **내가 받은 사주풀이** — 한 사람 풀이(나 · 저장한 사람)만, 책장의 표지 그대로(ADR 0129).
 *
 * 차례는 DB 가 준 그대로(최근 것이 앞)이고 앞의 셋만 세운다 — 전부는 「풀이 보관함」의 사주풀이 칸(`/me/readings?kind=saju`)이
 * 든다. 그 길은 **늘 선다**(u2) — 셋이 다여도 보관함에는 궁합풀이 · 인연 궁합이 함께 있다. 표지는 결과 화면으로 가고 주소가
 * `from=me` 를 들어 ← 가 나 탭 홈으로 돌아온다.
 *
 * 내 사주풀이가 아직 없으면 점선 한 권이 받는 자리로 간다 — 책장의 빈 자리와 같은 모양이다.
 */
export function ReceivedReadings({ readings }: { readings: readonly ReadingEntry[] }) {
  const singles = readings.map(bookOf).filter((book) => book.single);
  const hasSelf = readings.some((entry) => entry.kind === 'self');
  const shown = singles.slice(0, hasSelf ? SHOWN : SHOWN - 1);

  return (
    <section aria-labelledby="home-readings" className="flex min-w-0 flex-col gap-3 sm:gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 id="home-readings" className={`${TYPE_SECTION} flex items-baseline gap-2`}>
          내가 받은 사주풀이
          {singles.length > 0 && (
            <span className="font-sans text-[13px] font-semibold tabular-nums text-secondary">{singles.length}개</span>
          )}
        </h2>
        <Link href={withShelfKind('/me/readings', 'saju')} className={BUTTON_TERTIARY}>
          {SHELF_TITLE}
          <Icon name="arrow" className="size-4" />
        </Link>
      </div>

      <ul className="grid grid-cols-3 gap-2 sm:gap-3">
        {shown.map((book) => (
          <li key={book.key}>
            <SingleCover book={{ ...book, href: withFromMe(book.href) }} row />
          </li>
        ))}
        {!hasSelf && <BlankBook href={withFromMe('/me/readings/self')} element="木" label="내 사주풀이" row />}
      </ul>
    </section>
  );
}
