import { READING_NOUN, READING_STALE_NOTE } from '@/src/lib/reading';
import { ELEMENTS, ELEMENT_PICTURE_KO, STEM_INFO, type Element, type Saju } from '@/src/lib/saju';

import type { VariantProps } from '../..';
import type { ReadingEntry } from '../../../../reading/current';
import { readingDate, readingHref, readingTitle } from '../../../../reading/line';
import { previewHref } from '../../../shared/preview-href';
import { ROOT_CLASS } from '../symbols';
import { Library, type Book, type Making } from './library';
import { Dock, TopBar } from './menu';

/*
  **3차 · 라이프스타일 — 풀이.** 만든 글이 **책장**에 꽂힌다: 한 권이 한 글이고, 표지는 그 글의 비유 한 줄,
  표지 색은 대상의 일간 오행(홈의 사람 타일과 같은 규칙). 궁합은 두 사람의 색이 비스듬히 만나는 표지다.
  한 권을 펼치면 에세이 앱처럼 읽는다 — 비유를 인용구로 크게, 리드 문단, 소제목, 17px 본문.

  데이터는 모두 `PreviewState` 에서 온다. 표지 색에 필요한 일간만 여기서 사람 id 로 찾아 붙인다 — 목록
  행(`ReadingEntry`)에는 명식이 없고, 실제로 옮기면 `my_readings()` 가 일간 한 글자를 함께 내주면 된다.
*/
export default function Screen({ state }: VariantProps) {
  const charts = new Map<string, Saju | null>();
  if (state.self !== null) charts.set(state.self.personId, state.self.saju);
  for (const person of state.people) charts.set(person.personId, person.chart.ok ? person.chart.saju : null);

  const subjectOf = (personId: string | null) => {
    const saju = personId === null ? null : (charts.get(personId) ?? null);
    if (saju === null) return null;
    const dayMaster = saju.pillars.dayMaster;
    const element: Element = STEM_INFO[dayMaster].element;
    return { dayMaster, element, picture: ELEMENT_PICTURE_KO[element] };
  };

  const bookOf = (entry: ReadingEntry): Book => {
    const single = READING_NOUN[entry.kind] === '사주풀이';
    const selfId = state.self?.personId ?? null;
    const ids = entry.kind === 'self' ? [selfId] : [entry.personA, entry.personB].slice(0, single ? 1 : 2);
    const subjects = ids.map(subjectOf);
    return {
      key: `${entry.kind}:${entry.matchId ?? entry.personA ?? 'me'}:${entry.personB ?? ''}`,
      single,
      title: readingTitle(entry),
      name: entry.kind === 'self' ? '내 사주' : (entry.labelA ?? ''),
      metaphor: entry.metaphor,
      date: readingDate(entry.createdAt),
      score: entry.score,
      stale: !entry.fromCurrentChart,
      subjects: subjects.every((one) => one !== null) ? subjects : null,
      href: previewHref(readingHref(entry)),
      chartHref: previewHref(entry.kind === 'self' ? '/me' : `/me/people/${entry.personA}`),
      essayKey: entry.kind === 'self' ? 'self' : (entry.personA ?? ''),
    };
  };

  const books = state.readings.map(bookOf);
  const making: Making[] = state.making.map((match) => {
    const element = ELEMENTS.find((one) => one === match.suppliedToMe) ?? null;
    return {
      matchId: match.matchId,
      nickname: match.nickname,
      photoUrl: state.cards.find((card) => card.candidateUserId === match.partnerUserId)?.photoUrl ?? null,
      supplied: element === null ? null : { element, picture: ELEMENT_PICTURE_KO[element] },
      balanceLabel: match.balanceLabel,
    };
  });

  return (
    <div className={`${ROOT_CLASS} flex min-w-0 flex-col gap-8 break-keep sm:gap-10`}>
      <TopBar active="/me/readings" unread={state.unread} unreadChat={state.unreadChat} />
      <Library
        singles={books.filter((book) => book.single)}
        pairs={books.filter((book) => !book.single)}
        making={making}
        hasSelf={state.self !== null}
        staleNote={READING_STALE_NOTE}
      />
      <Dock active="/me/readings" unreadChat={state.unreadChat} />
    </div>
  );
}
