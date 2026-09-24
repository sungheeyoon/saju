import { READING_NOUN } from '@/src/lib/reading';

import type { ReadingEntry } from '../reading/current';
import { readingDate, readingHref, readingTitle } from '../reading/line';
import type { DayMaster } from './subject';

/**
 * 풀이 목록의 **책 한 권** — 목록 행 하나를 표지로 옮긴 것.
 *
 * 한 편이 한 권이다(시안 3차 warm 「책장」). 표지 색은 대상의 일간 오행이고, 두 사람짜리는 두 색이
 * 비스듬히 만난다. 목록은 본문을 안 싣는다(ADR 0033) — 표지에 서는 것은 비유 한 줄 · 날짜 · 점수 ·
 * 「이전 명식」과 가는 길뿐이다.
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

export function bookOf(
  entry: ReadingEntry,
  dayMasters: ReadonlyMap<string, DayMaster>,
  selfPersonId: string | null,
): Book {
  const single = READING_NOUN[entry.kind] === '사주풀이';
  const of = (personId: string | null) => (personId === null ? null : (dayMasters.get(personId) ?? null));

  /*
    **인연 궁합의 앞자리는 늘 나다.** 행이 든 `personA` 는 match 에서 비어 있고(가는 길이 `matchId`),
    상대의 명식은 이 목록에서 읽을 수 없다 — 동의로 열린 여덟 글자는 결과 화면의 문만 낸다(ADR 0012).
    그래서 상대 자리는 회색으로 둔다.
  */
  const subjects =
    entry.kind === 'self'
      ? [of(selfPersonId)]
      : entry.kind === 'person'
        ? [of(entry.personA)]
        : entry.kind === 'private'
          ? [of(entry.personA), of(entry.personB)]
          : [of(selfPersonId), null];

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

/** 표지 색을 세우려면 명식을 읽어야 하는 사람들 — 목록에 선 사람만 */
export function coverPersonIds(entries: readonly ReadingEntry[], selfPersonId: string | null): string[] {
  const ids = new Set<string>();
  for (const entry of entries) {
    if ((entry.kind === 'self' || entry.kind === 'match') && selfPersonId !== null) ids.add(selfPersonId);
    if (entry.kind === 'person' || entry.kind === 'private') {
      if (entry.personA !== null) ids.add(entry.personA);
      if (entry.personB !== null) ids.add(entry.personB);
    }
  }
  return [...ids];
}
