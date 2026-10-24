import Link from 'next/link';

import { BUTTON_TERTIARY } from '../../ui/buttons';
import { Icon } from '../../ui/icons';
import { isStem } from '../../ui/stem-symbol';
import { STALE_CHIP, TYPE_SECTION } from '../../ui/surfaces';
import { READING_STALE_LABEL } from '@/src/lib/reading/notes';
import { bookOf, type Book } from '../(shelf)/readings/book';
import { SHELF_TITLE, withShelfKind } from '../(shelf)/readings/kind';
import type { ReadingEntry } from '@/src/lib/reading';
import { HOME_LIST, HOME_ROW, HOME_ROW_LINK, HomeMark } from './home-list';
import { withFromMe } from './from-me';
import { READING_CONTINUE_NOTE, SELF_READING_MAKING } from './making';

/** 홈 탭에 서는 줄 수 — **셋**(u2, 운영자 2026-09-29). 전부는 보관함이 든다 */
const SHOWN = 3;

/**
 * **`lg` 에서는 넷**(2026-09-29) — 그 폭에서는 이 칸이 내 사주 카드(594px) 오른쪽 칸에 서서 높이가 남는다. 넷째 줄은 그 아래
 * 폭에서 숨는다.
 */
const SHOWN_WIDE = 4;

/**
 * **내가 받은 사주풀이** — 한 사람 풀이(나 · 저장한 사람)만(ADR 0129). 책장의 표지가 들던 것(일간 · 이름 · 비유 · 날짜 · 「수정 전」)을
 * 흰 판 안의 줄로 든다(2026-10-25 홈 위계 정리, `home-list.tsx`).
 *
 * 차례는 DB 가 준 그대로(최근 것이 앞)이고 앞의 셋(`lg` 는 넷)만 세운다 — 전부는 「풀이 보관함」의 사주풀이 칸(`/me/readings?kind=saju`)이
 * 든다. 그 길은 **늘 선다**(u2) — 셋이 다여도 보관함에는 궁합풀이 · 인연 궁합이 함께 있다. 표지는 결과 화면으로 가고 주소가
 * `from=me` 를 들어 ← 가 홈 탭으로 돌아온다.
 *
 * 내 사주풀이가 아직 없으면 줄 하나가 받는 자리로 간다. 만드는 중이면 그 줄이 「받기」 대신 만드는 중임을 말한다 — 같은
 * 자리(풀이 화면)로 가서 같은 목차를 본다.
 */
export function ReceivedReadings({
  readings,
  makingSelf = false,
}: {
  readings: readonly ReadingEntry[];
  /** 내 사주풀이를 지금 만드는 중인가 — 받는 줄이 「받기」 대신 이 일을 말한다(ADR 0157) */
  makingSelf?: boolean;
}) {
  const singles = readings.map(bookOf).filter((book) => book.single);
  const hasSelf = readings.some((entry) => entry.kind === 'self');
  const narrow = hasSelf ? SHOWN : SHOWN - 1;
  const shown = singles.slice(0, hasSelf ? SHOWN_WIDE : SHOWN_WIDE - 1);

  return (
    <section aria-labelledby="home-readings" className="flex min-w-0 flex-col gap-2 sm:gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 id="home-readings" className={`${TYPE_SECTION} flex items-baseline gap-2`}>
          내가 받은 사주풀이
          {singles.length > 0 && (
            <span className="font-sans text-small font-semibold tabular-nums text-secondary">{singles.length}개</span>
          )}
        </h2>
        <Link href={withShelfKind('/me/readings', 'saju')} className={BUTTON_TERTIARY}>
          {SHELF_TITLE}
          <Icon name="arrow" className="size-4" />
        </Link>
      </div>

      {/*
        **흰 판 안의 줄 목록이다**(2026-10-25 홈 위계 정리) — 색띠 표지를 옆으로 넘기던 줄(B13)은 홈에 판 모양을 하나 더 세웠다. 줄마다
        왼쪽의 작은 표시가 그 사람의 일간이고, 이름 · 날짜 · 비유 한 줄이 선다. 넓은 화면에서는 내 사주 카드 오른쪽 칸에 넷까지 선다
        — 넷째 줄은 그 아래 폭에서 숨는다. 전부는 보관함이 든다.
      */}
      <ul className={HOME_LIST}>
        {shown.map((book, index) => (
          <li key={book.key} className={`${HOME_ROW} ${index < narrow ? '' : 'hidden lg:block'}`}>
            <ReadingRow book={book} />
          </li>
        ))}
        {!hasSelf && (
          <li className={HOME_ROW}>
            <Link href={withFromMe('/me/readings/self')} className={HOME_ROW_LINK}>
              <HomeMark element="木" />
              <span className="min-w-0 flex-1 truncate text-body font-semibold">{makingSelf ? SELF_READING_MAKING : '사주풀이 받기'}</span>
              <Icon name="arrow" className="size-4 shrink-0 text-secondary" />
            </Link>
          </li>
        )}
      </ul>
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
          <span className="min-w-0 flex-1 truncate text-body font-semibold">{book.title}</span>
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
