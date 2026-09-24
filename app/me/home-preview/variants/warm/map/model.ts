import { ELEMENT_PICTURE_KO, STEM_INFO, type Element, type Saju } from '@/src/lib/saju';

import type { ReadingEntry } from '../../../../reading/current';
import { readingHref, readingTitle } from '../../../../reading/line';
import type { FixturePerson } from '../../../fixtures';
import type { PreviewState } from '../../../state';
import { previewHref } from '../../../shared/preview-href';

/*
  **지도가 먹는 값 — 서버가 한 번 접어 내려보낸다.** (orbit `model.ts` 의 경계를 그대로 따른다)

  지도는 「누구를 눌렀나」 하나 때문에 브라우저에서 돈다. 거기에 `Saju` 를 넘기면 엔진이 브라우저 묶음으로
  따라 내려가므로 글자 · 오행 · 주소를 여기서 문자열로 만든다 — 지도는 그리기만 한다.

  **궤도는 판정이 아니다.** 안쪽은 「풀이나 궁합을 본 사람」, 바깥은 「저장만 한 사람」 — 사용자가 한 일의
  기록이다. 선은 **이미 만든 궁합풀이가 있을 때만** 긋는다. 없는 관계를 지어내지 않는다.
*/

export type DayMark = { stem: string; element: Element; picture: string };

export type MapPerson = {
  id: string;
  label: string;
  note: string | null;
  ring: 'inner' | 'outer';
  /** 명식을 못 읽으면 `null` — 그때 `unreadable` 이 까닭을 든다 */
  day: DayMark | null;
  unreadable: string | null;
  detailHref: string;
  readingHref: string;
  /** 이 사람의 풀이 — 없으면 `null` */
  reading: { metaphor: string | null; current: boolean } | null;
  /** 나와의 궁합 — 이미 본 것이면 `seen` 이고 그 글로 간다 */
  compat: { href: string; score: number | null; seen: boolean };
};

/** 저장한 두 사람 사이에 이미 본 궁합 — 나와의 것은 사람 쪽 `compat` 이 든다 */
export type MapLink = { a: string; b: string; score: number | null; href: string; label: string };

export type MapModel = {
  self: ({ label: string } & DayMark) | null;
  people: MapPerson[];
  links: MapLink[];
  /** 가장 최근 풀이 — 인용 카드가 빠진 자리에서 「이어서 읽기」 한 줄로 남는다 */
  recent: { href: string; title: string; score: number | null } | null;
};

function dayOf(saju: Saju): DayMark {
  const stem = saju.pillars.dayMaster;
  const element = STEM_INFO[stem].element;
  return { stem, element, picture: ELEMENT_PICTURE_KO[element] };
}

/** 나 × 그 사람의 궁합풀이 — 최근 것이 앞이라 처음 만난 것이 가장 최근이다 */
function pairOf(readings: readonly ReadingEntry[], selfId: string | null, personId: string): ReadingEntry | null {
  if (selfId === null) return null;
  return (
    readings.find(
      (entry) =>
        entry.kind === 'private' &&
        ((entry.personA === selfId && entry.personB === personId) ||
          (entry.personB === selfId && entry.personA === personId)),
    ) ?? null
  );
}

function personOf(person: FixturePerson, readings: readonly ReadingEntry[], selfId: string | null): MapPerson {
  const pair = pairOf(readings, selfId, person.personId);
  const note = person.note?.trim() ?? '';
  return {
    id: person.personId,
    label: person.local_label,
    note: note === '' ? null : note,
    ring: person.reading !== null || pair !== null ? 'inner' : 'outer',
    day: person.chart.ok ? dayOf(person.chart.saju) : null,
    unreadable: person.chart.ok ? null : person.chart.message,
    detailHref: previewHref(`/me/people/${person.personId}`),
    readingHref: previewHref(`/me/readings/${person.personId}`),
    reading:
      person.reading === null ? null : { metaphor: person.reading.metaphor, current: person.reading.fromCurrentChart },
    compat: {
      href:
        pair !== null
          ? previewHref(readingHref(pair))
          : previewHref(
              selfId === null
                ? `/compat#b.person=${person.personId}`
                : `/compat#a.person=${selfId}&b.person=${person.personId}`,
            ),
      score: pair?.score ?? null,
      seen: pair !== null,
    },
  };
}

export function mapModelOf(state: PreviewState): MapModel {
  const selfId = state.self?.personId ?? null;
  const ids = new Set(state.people.map((person) => person.personId));
  const recent = state.readings[0] ?? null;

  return {
    self: state.self === null ? null : { label: state.self.label, ...dayOf(state.self.saju) },
    people: state.people.map((person) => personOf(person, state.readings, selfId)),
    /* 나 밖의 두 사람 궁합 — 둘 다 지도에 있을 때만 선이 선다 */
    links: state.readings.flatMap((entry) =>
      entry.kind === 'private' &&
      entry.personA !== null &&
      entry.personB !== null &&
      ids.has(entry.personA) &&
      ids.has(entry.personB)
        ? [
            {
              a: entry.personA,
              b: entry.personB,
              score: entry.score,
              href: previewHref(readingHref(entry)),
              label: `${entry.labelA ?? ''} × ${entry.labelB ?? ''}`,
            },
          ]
        : [],
    ),
    recent:
      recent === null
        ? null
        : { href: previewHref(readingHref(recent)), title: readingTitle(recent), score: recent.score },
  };
}
