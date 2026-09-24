import { BRANCH_INFO, CALENDAR_KO, ELEMENTS, ELEMENT_KO, STEM_INFO, type Element, type Saju } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import type { ReadingEntry } from '../../../reading/current';
import { readingHref } from '../../../reading/line';
import { PILLAR_COLUMNS } from '../../../../saju/shared';
import type { FixturePerson, FixtureSelf } from '../../fixtures';
import type { PreviewState } from '../../state';
import { previewHref } from '../../shared/preview-href';

/*
  **지도가 먹는 값 — 서버가 한 번 접어 내려보낸다.**

  지도(`orbit-view.tsx`)는 선택 상태 하나 때문에 브라우저에서 돈다. 거기에 `Saju` 를 통째로 넘기면 엔진이
  브라우저 묶음으로 따라 내려가고, 주소를 짓는 규칙(`readingHref`)도 둘이 된다. 그래서 글자 · 색 이름 ·
  주소를 전부 여기서 문자열로 만들어 넘긴다 — 지도는 그리기만 한다.

  **궤도는 판정이 아니다.** 안쪽 궤도는 「풀이나 궁합을 이미 본 사람」, 바깥은 「저장만 한 사람」이다.
  사용자가 한 일의 기록이지 두 사람이 가깝다는 말이 아니다. 선은 **이미 만든 궁합풀이가 있을 때만** 긋는다.
*/

export type GlyphCell = {
  key: 'hour' | 'day' | 'month' | 'year';
  column: string;
  /** 시각을 모르면 `null` */
  pillar: { stem: string; branch: string; stemElement: Element; branchElement: Element; name: string } | null;
};

export type ReadingLink = { href: string; metaphor: string | null; current: boolean };

export type DayMark = { stem: string; element: Element; spoken: string; elementKo: string };

export type OrbitPerson = {
  id: string;
  label: string;
  note: string | null;
  ring: 'inner' | 'outer';
  /** 명식을 못 읽으면 `null` — 그때 `unreadable` 이 까닭을 든다 */
  day: DayMark | null;
  unreadable: string | null;
  cells: GlyphCell[] | null;
  detailHref: string;
  readingHref: string;
  reading: ReadingLink | null;
  /** 나와의 궁합 — 이미 본 것이면 `seen` 이고 그 글로 간다 */
  compat: { href: string; score: number | null; seen: boolean };
};

export type OrbitSelf = {
  id: string;
  label: string;
  birth: string;
  day: DayMark;
  cells: GlyphCell[];
  elements: { element: Element; ko: string; count: number }[];
  glyphCount: number;
  detailHref: string;
  readingHref: string;
  reading: ReadingLink | null;
};

/** 저장한 두 사람 사이에 이미 본 궁합 — 나와의 것은 사람 쪽 `compat` 이 든다 */
export type OrbitLink = { a: string; b: string; score: number | null; href: string; label: string };

export type OrbitModel = {
  self: OrbitSelf | null;
  people: OrbitPerson[];
  links: OrbitLink[];
};

function cellsOf(saju: Saju): GlyphCell[] {
  return PILLAR_COLUMNS.map(({ key, label }) => {
    const pillar = saju.pillars[key];
    return {
      key,
      column: label,
      pillar:
        pillar === null
          ? null
          : {
              stem: pillar.stem,
              branch: pillar.branch,
              stemElement: STEM_INFO[pillar.stem].element,
              branchElement: BRANCH_INFO[pillar.branch].element,
              name: pillar.name,
            },
    };
  });
}

function dayOf(saju: Saju): DayMark {
  const stem = saju.pillars.dayMaster;
  const info = STEM_INFO[stem];
  return {
    stem,
    element: info.element,
    elementKo: ELEMENT_KO[info.element],
    spoken: `일간 ${stem}, ${info.ko}${ELEMENT_KO[info.element]}`,
  };
}

function linkOf(reading: ReadingEntry | null): ReadingLink | null {
  if (reading === null) return null;
  return { href: previewHref(readingHref(reading)), metaphor: reading.metaphor, current: reading.fromCurrentChart };
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

function personOf(person: FixturePerson, readings: readonly ReadingEntry[], selfId: string | null): OrbitPerson {
  const pair = pairOf(readings, selfId, person.personId);
  const compatHref =
    pair !== null
      ? previewHref(readingHref(pair))
      : previewHref(
          selfId === null ? `/compat#b.person=${person.personId}` : `/compat#a.person=${selfId}&b.person=${person.personId}`,
        );
  const note = person.note?.trim() ?? '';

  return {
    id: person.personId,
    label: person.local_label,
    note: note === '' ? null : note,
    ring: person.reading !== null || pair !== null ? 'inner' : 'outer',
    day: person.chart.ok ? dayOf(person.chart.saju) : null,
    unreadable: person.chart.ok ? null : person.chart.message,
    cells: person.chart.ok ? cellsOf(person.chart.saju) : null,
    detailHref: previewHref(`/me/people/${person.personId}`),
    readingHref: previewHref(`/me/readings/${person.personId}`),
    reading: linkOf(person.reading),
    compat: { href: compatHref, score: pair?.score ?? null, seen: pair !== null },
  };
}

function selfOf(self: FixtureSelf): OrbitSelf {
  const { query, saju } = self;
  const { counts, glyphCount } = saju.analysis.elements;
  const date = query.calendar === 'solar' ? query.date : `${CALENDAR_KO[query.calendar]} ${query.date}`;
  return {
    id: self.personId,
    label: self.label,
    birth: `${date} · ${query.hourKnown === false ? HOUR_UNKNOWN_LABEL : query.time}`,
    day: dayOf(saju),
    cells: cellsOf(saju),
    elements: ELEMENTS.map((element) => ({ element, ko: ELEMENT_KO[element], count: counts[element] })),
    glyphCount,
    detailHref: previewHref(`/me/people/${self.personId}`),
    readingHref: previewHref('/me/readings/self'),
    reading: linkOf(self.reading),
  };
}

export function orbitModelOf(state: PreviewState): OrbitModel {
  const selfId = state.self?.personId ?? null;
  const ids = new Set(state.people.map((person) => person.personId));

  return {
    self: state.self === null ? null : selfOf(state.self),
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
  };
}
