import { READING_NOUN } from '@/src/lib/reading';
import { STEM_INFO, type Stem } from '@/src/lib/saju';

import type { ReadingEntry } from '../reading/current';
import { readingDate, readingHref, readingTitle } from '../reading/line';
import type { DayMaster } from './subject';

/**
 * 풀이 목록의 **책 한 권** — 목록 행 하나를 표지로 옮긴 것.
 *
 * 한 편이 한 권이다(시안 3차 warm 「책장」). 표지 색은 대상의 일간 오행이고, 두 사람짜리는 두 색이
 * 비스듬히 만난다. 목록은 본문을 안 싣는다(ADR 0033) — 표지에 서는 것은 비유 한 줄 · 날짜 · 점수 ·
 * 「수정 전」과 가는 길뿐이다.
 *
 * 화면(`shelf.tsx`)이 아니라 여기 두는 것은 **누가 표지의 주인인가**를 kind 넷으로 가르는 자리라서다 —
 * 시험이 그 갈래를 부를 수 있어야 한다.
 */
export type Book = {
  readonly key: string;
  /** 한 사람 풀이인가 — 사주풀이 책장에 선다 */
  readonly single: boolean;
  /** 목록에서 부르는 말(`readingTitle`) */
  readonly title: string;
  readonly metaphor: string | null;
  readonly date: string;
  readonly dateTime: string;
  readonly score: number | null;
  readonly stale: boolean;
  /** 표지의 주인 — 한 사람이면 하나, 궁합이면 둘. 못 읽은 사람은 `null`(회색 표지) */
  readonly subjects: readonly (DayMaster | null)[];
  readonly href: string;
};

export function bookOf(entry: ReadingEntry): Book {
  const single = READING_NOUN[entry.kind] === '사주풀이';
  const of = (stem: Stem | null): DayMaster | null => (stem === null ? null : { stem, element: STEM_INFO[stem].element });

  /*
    **두 일간은 목록 문이 준다**(G-59). 앞서는 표지 색 하나를 위해 여기서 명식을 다시 읽었다. 앞자리 ·
    뒷자리를 누가 차지하는가도 문이 정한다 — `match` 의 앞자리는 나, 뒷자리는 동의 당시 사본의 상대다.
    한 사람짜리는 뒷자리를 안 그린다. 모르는 자리는 `null`(회색 표지)이다.
  */
  const subjects = single ? [of(entry.dayMasterA)] : [of(entry.dayMasterA), of(entry.dayMasterB)];

  return {
    key: `${entry.kind}:${entry.matchId ?? entry.personA ?? 'me'}:${entry.personB ?? ''}`,
    single,
    title: readingTitle(entry),
    metaphor: entry.metaphor,
    date: readingDate(entry.createdAt),
    dateTime: entry.createdAt,
    score: entry.score,
    stale: !entry.fromCurrentChart,
    subjects,
    href: readingHref(entry),
  };
}
