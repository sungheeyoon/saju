import type { SupabaseClient } from '@supabase/supabase-js';

import { accountNoticeOf, isBlocked, selfPersonIdOf, type AccountState } from '@/src/lib/account';
import { SUPPORT_EMAIL } from '@/src/lib/brand';
import type { Database } from '@/src/lib/db';
import { isSolo, selfSectionTitlesOf } from '@/src/lib/reading';
import type { ReadingView, ShelfBook, ShelfMaking, ShelfView } from '@/src/lib/reading/door';
import { readingWaitNote } from '@/src/lib/reading/notes';
import { when } from '@/src/lib/reading/when';
import type { ReadingTarget } from '@/src/lib/reading/target';
import { STEM_INFO } from '@/src/lib/saju';

import { readAccount } from '../../../me/account';
import { readReadingCredits } from '../../../me/credits/remaining';
import { runningReadings } from '../../../me/home/running';
import { runningName } from '../../../me/home/running-line';
import { bookOf, shelfNamesOf } from '../../../me/(shelf)/readings/book';
import { shelfKindOfReading } from '../../../me/(shelf)/readings/kind';
import { dayMastersOf, savedPersonOf } from '../../../me/(shelf)/readings/subject';
import { currentReading, lastReadingRun, myReadings } from '../../../me/reading/current';
import { readingMinutes } from '../../../me/reading/essay';
import { GENERATION } from '../../../me/reading/generation';
import { readingHrefOf } from '../../../me/reading/target';
import { matchesForViewer } from '../../../me/requests/inbox';

type Client = SupabaseClient<Database>;

/**
 * **앱이 받는 화면 값 — 웹의 화면이 읽는 문을 그대로 부른다**(ADR 0211).
 *
 * 앱은 여기서 얻은 값을 그리기만 한다. 글의 근거 절은 `currentReading` 이 자른 뒤라 앱까지 안 간다(ADR 0008) — 앱이 `my_reading` 을
 * 직접 부르면 그 경계가 앱 코드로 옮겨 간다. 읽기만 하므로 이 파일로는 모델이 안 불린다(ADR 0001).
 */

/** 웹의 `[subject]/page.tsx` 와 `app/me/reading/section.tsx` 가 읽는 것 — `null` 은 내 목록에 없는 사람이다 */
export async function readingViewFor(client: Client, target: ReadingTarget): Promise<ReadingView | null> {
  const { state } = await readAccount(client);
  if (isBlocked(state)) return blockedView(state);

  const selfPersonId = selfPersonIdOf(state);
  if (target.kind === 'self' && selfPersonId === null) return { view: 'no-self' };

  const saved = target.kind === 'person' ? await savedPersonOf(client, target.personId) : null;
  if (target.kind === 'person') {
    if (saved === null) return null;
    if (saved.personId === selfPersonId) return { view: 'is-self' };
  }

  const [reading, run, credits] = await Promise.all([
    currentReading(target, client),
    lastReadingRun(target, client),
    readReadingCredits(client),
  ]);

  const personId = saved?.personId ?? selfPersonId;
  const dayMaster =
    reading?.dayMasterA != null
      ? { stem: reading.dayMasterA, element: STEM_INFO[reading.dayMasterA].element }
      : isSolo(target.kind) && personId !== null
        ? ((await dayMastersOf(client, [personId])).get(personId) ?? null)
        : null;

  return {
    view: 'reading',
    reading,
    createdLabel: reading === null ? null : when(reading.createdAt),
    minutes: reading === null ? null : readingMinutes(reading.output),
    run,
    credits: credits.ok ? credits.value : null,
    outline: isSolo(target.kind) ? selfSectionTitlesOf() : null,
    waitNote: readingWaitNote(GENERATION.settings.timeout),
    subject: isSolo(target.kind)
      ? {
          name: saved?.localLabel ?? '내 사주',
          title: saved === null ? '내 사주풀이' : `${saved.localLabel}의 사주풀이`,
          dayMaster,
        }
      : null,
  };
}

/** 웹의 `app/me/(shelf)/readings/layout.tsx` 가 읽는 것 — 칩마다 책장을 가르는 일은 앱 화면이 칸(`shelf`)으로 한다 */
export async function shelfViewFor(client: Client): Promise<ShelfView> {
  const { state } = await readAccount(client);
  if (isBlocked(state)) return blockedView(state);

  const [readings, matches, running] = await Promise.all([
    myReadings(client),
    matchesForViewer(client),
    runningReadings(client),
  ]);

  const books: ShelfBook[] = readings.map((entry) => {
    const book = bookOf(entry);
    return {
      key: book.key,
      href: book.href,
      single: book.single,
      shelf: shelfKindOfReading(entry.kind),
      title: book.title,
      metaphor: book.metaphor,
      date: book.date,
      score: book.score,
      stale: book.stale,
      subjects: book.subjects,
      names: book.names,
    };
  });

  /* 레이아웃과 같은 가름 — 다시 받는 중인 글은 제 표지가 그대로 서고, 인연 궁합은 글이 없는 Match 가 든다 */
  const shelved = new Set(books.map((book) => book.href));
  const madeMatchIds = new Set(readings.flatMap((entry) => (entry.matchId === null ? [] : [entry.matchId])));
  const making: ShelfMaking[] = [
    ...matches
      .filter((match) => !madeMatchIds.has(match.matchId))
      .map((match) => ({
        href: `/me/match/${match.matchId}`,
        name: `${match.nickname} 님과의 궁합풀이`,
        shelf: 'match' as const,
        names: [match.nickname],
      })),
    ...(running.ok ? running.value : []).flatMap((one) => {
      const href = readingHrefOf(one.target);
      if (one.target.kind === 'match' || shelved.has(href)) return [];
      return [{ href, name: runningName(one), shelf: shelfKindOfReading(one.target.kind), names: shelfNamesOf(one.labelA, one.labelB) }];
    }),
  ];

  return { view: 'shelf', books, making, hasSelf: selfPersonIdOf(state) !== null };
}

function blockedView(state: AccountState) {
  const text = accountNoticeOf(state, SUPPORT_EMAIL);
  return { view: 'blocked' as const, title: text?.title ?? '', detail: text?.detail ?? '' };
}
