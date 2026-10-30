import Link from 'next/link';

import { Icon } from '../../ui/icons';
import { isStem } from '../../ui/stem-symbol';
import { STALE_CHIP, TYPE_SECTION } from '../../ui/surfaces';
import { READING_STALE_LABEL } from '@/src/lib/reading/notes';
import { bookOf, type Book } from '../(shelf)/readings/book';
import { SHELF_TITLE, withShelfKind } from '../(shelf)/readings/kind';
import type { ReadingEntry } from '@/src/lib/reading';
import { HOME_HEAD, HOME_HEAD_COUNT, HOME_HEAD_LINK, HOME_ROW, HOME_ROW_LINK, HomeMark } from './home-list';
import { MoreList } from './more-list';
import { withFromMe } from '@/src/lib/home/from-me';
import { READING_CONTINUE_NOTE } from '@/src/lib/home/making';

/**
 * 구역 제목 — 「받은 사주풀이」(2026-10-26 2차, 전에는 「내가 받은 사주풀이」). 내 홈이라 「내가」는 군말이다 — 카카오톡 선물하기의
 * 「받은 선물」과 같은 꼴. 확인 전 문구(대장 `home-01`)
 */
const RECEIVED_READINGS_TITLE = '받은 사주풀이';

/** 머리 오른쪽 링크의 글자 — 궁합 탭 · 인연 탭이 보관함으로 가던 링크와 같은 글자(대장 05 「모두 보기」) */
const SEE_ALL = '모두 보기';

/** 홈 탭에 서는 줄 수 — **셋**(u2, 운영자 2026-09-29). 전부는 보관함이 든다 */
const SHOWN = 3;

/**
 * **`lg` 에서는 넷**(2026-09-29) — 그 폭에서는 이 칸이 내 사주 카드(594px) 오른쪽 칸에 서서 높이가 남는다. 넷째 줄은 그 아래
 * 폭에서 숨는다.
 */
const SHOWN_WIDE = 4;

/**
 * **「더보기」로 펴면 열까지**(2026-10-26 운영자 「많을 때 더보기」). 그 너머는 머리의 「모두 보기」(풀이 보관함)가 든다 — 홈에 끝없이
 * 늘어나는 목록을 두지 않는다(당근페이 홈 「진행 중인 거래」의 「전체보기 ⌄」도 몇 줄만 더 편다).
 */
const SHOWN_OPEN = 10;

/**
 * **받은 사주풀이** — 한 사람 풀이(나 · 저장한 사람)만(ADR 0129). 책장의 표지가 들던 것(일간 · 이름 · 비유 · 날짜 · 「수정 전」)을
 * 흰 판 안의 줄로 든다(2026-10-25 홈 위계 정리, `home-list.tsx`).
 *
 * 차례는 DB 가 준 그대로(최근 것이 앞)이고 앞의 셋(`lg` 는 넷)만 세운다 — 전부는 「풀이 보관함」의 사주풀이 칸(`/me/readings?kind=saju`)이
 * 든다. 그 길은 **늘 선다**(u2) — 셋이 다여도 보관함에는 궁합풀이 · 인연 궁합이 함께 있다. 표지는 결과 화면으로 가고 주소가
 * `from=me` 를 들어 ← 가 홈 탭으로 돌아온다.
 *
 * 내 사주풀이는 이 목록에 없다 — 받는 길 · 보는 길은 내 사주 카드의 단추 하나다(2026-10-26 운영자). 줄의 이름은 사람 이름만이다
 * (「하은 사주」 → 「하은」).
 */
export function ReceivedReadings({ readings }: { readings: readonly ReadingEntry[] }) {
  /*
    **내 사주풀이는 이 목록에 없다**(2026-10-26 운영자) — 바로 위 내 사주 카드에 「사주풀이 보기」가 있다. 풀이 보관함(「모두 보기」)에는
    그대로 선다. 개수(「3개」)도 이 목록 기준이다. 저장한 사람의 풀이가 하나도 없으면 이 구역이 안 선다
  */
  const singles = readings
    .filter((entry) => entry.kind !== 'self')
    .map(bookOf)
    .filter((book) => book.single);
  const narrow = SHOWN;
  const wide = SHOWN_WIDE;
  if (singles.length === 0) return null;
  const shown = singles.slice(0, SHOWN_OPEN);

  return (
    <section aria-labelledby="home-readings" className="flex min-w-0 flex-col gap-2 sm:gap-4">
      <div className={HOME_HEAD}>
        <h2 id="home-readings" className={`${TYPE_SECTION} flex items-baseline gap-1.5`}>
          {RECEIVED_READINGS_TITLE}
          {singles.length > 0 && <span className={HOME_HEAD_COUNT}>{singles.length}개</span>}
        </h2>
        {/*
          화면 글자는 「모두 보기」(App Store 의 구역 머리 · 궁합 탭이 쓰던 같은 글자, 대장 05), 읽는 이름은 가는 곳의 이름을 앞에 단다
        */}
        <Link href={withShelfKind('/me/readings', 'saju')} className={HOME_HEAD_LINK} aria-label={`${SHELF_TITLE} ${SEE_ALL}`}>
          {SEE_ALL}
          <Icon name="chevron" className="size-4" />
        </Link>
      </div>

      {/*
        **흰 판 안의 줄 목록이다**(2026-10-25 홈 위계 정리) — 색띠 표지를 옆으로 넘기던 줄(B13)은 홈에 판 모양을 하나 더 세웠다. 줄마다
        왼쪽의 작은 표시가 그 사람의 일간이고, 이름 · 날짜 · 비유 한 줄이 선다. 넓은 화면에서는 내 사주 카드 오른쪽 칸에 넷까지 선다
        — 넷째 줄은 그 아래 폭에서 숨는다. 전부는 보관함이 든다.
      */}
      {/*
        접힌 동안 폰은 앞의 셋(내 사주풀이가 없으면 둘), 넓은 화면은 넷까지 — 나머지 줄은 `data-fold` 로 숨고 판 아래 「더보기」가 편다
      */}
      <MoreList
        collapsed="[&>li[data-fold]]:hidden lg:[&>li[data-fold=wide]]:block"
        more={shown.length > narrow}
        moreWide={shown.length > wide}
      >
        {shown.map((book, index) => (
          <li
            key={book.key}
            data-fold={index < narrow ? undefined : index < wide ? 'wide' : 'all'}
            className={HOME_ROW}
          >
            <ReadingRow book={book} />
          </li>
        ))}
      </MoreList>
    </section>
  );
}

/** 받은 사주풀이 한 줄 — 줄 전체가 그 풀이로 가는 링크다(표지 한 권과 같은 길) */
function ReadingRow({ book }: { book: Book }) {
  const subject = book.subjects[0] ?? null;
  return (
    <Link href={withFromMe(book.href)} className={HOME_ROW_LINK}>
      <HomeMark stem={subject !== null && isStem(subject.stem) ? subject.stem : null} element={subject?.element ?? null} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-body font-semibold">{book.names[0] ?? book.title}</span>
          {book.stale && <span className={`shrink-0 ${STALE_CHIP}`}>{READING_STALE_LABEL}</span>}
          <time dateTime={book.dateTime} className="shrink-0 whitespace-nowrap text-fine tabular-nums text-muted">
            {book.date}
          </time>
        </span>
        <span className="truncate text-small leading-5 text-secondary">{book.metaphor ?? READING_CONTINUE_NOTE}</span>
      </span>
    </Link>
  );
}
