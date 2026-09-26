import { ELEMENT_PICTURE_KO, STEM_INFO, type Element, type Saju } from '@/src/lib/saju';

import type { ReadingEntry } from '../../reading/current';
import { readingHref } from '../../reading/line';

/*
  **관계 지도가 먹는 값 — 서버가 한 번 접어 내려보낸다.**

  지도는 「누구를 눌렀나」 하나 때문에 브라우저에서 돈다. 거기에 `Saju` 를 넘기면 엔진이 브라우저 묶음으로
  따라 내려가므로 글자 · 오행 · 주소를 여기서 문자열로 만든다 — 지도는 그리기만 한다.

  **거리는 아무것도 판정하지 않는다.** 저장한 사람은 모두 한 궤도에 앉는다 — 풀이를 봤는지는 카드가, 궁합은
  선이 말한다. 선은 **이미 만든 궁합풀이가 있을 때만** 긋는다(`my_readings` 의 `private` 줄). 없는 관계를
  지어내지 않는다 — 점수는 그 글이 들고 있던 값 그대로이고, 안 본 짝을 권하지도 않는다.
*/

export type DayMark = { stem: string; element: Element; picture: string };

/** 홈이 들고 있는 한 사람 — 명식을 못 세웠으면 그 까닭을 든다 */
export type HomePerson = {
  personId: string;
  label: string;
  note: string | null;
  chart: { ok: true; saju: Saju } | { ok: false; message: string };
};

export type MapPerson = {
  id: string;
  label: string;
  note: string | null;
  /** 명식을 못 읽으면 `null` — 그때 `unreadable` 이 까닭을 든다 */
  day: DayMark | null;
  unreadable: string | null;
  /** 아래 사람 타일의 앵커 — 자바스크립트가 없으면 지도의 원이 여기로 간다 */
  tileHref: string;
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
  self: { label: string } & DayMark;
  people: MapPerson[];
  links: MapLink[];
};

export function dayOf(saju: Saju): DayMark {
  const stem = saju.pillars.dayMaster;
  const element = STEM_INFO[stem].element;
  return { stem, element, picture: ELEMENT_PICTURE_KO[element] };
}

/** 사람 타일의 `id` — 지도의 원이 자바스크립트 없이 가는 자리 */
export const tileAnchor = (personId: string): string => `person-${personId}`;

/**
 * 나 × 그 사람의 궁합풀이 — `my_readings` 는 최근 것이 앞이라 처음 만난 것이 가장 최근이다.
 * 두 사람의 차례는 안 가린다(DB 의 쌍도 차례를 안 탄다).
 */
export function pairWithSelf(
  readings: readonly ReadingEntry[],
  selfId: string | null,
  personId: string,
): ReadingEntry | null {
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

/** 그 사람 한 명의 사주풀이 — 사람 하나에 지금 글 하나다 */
export function readingOf(readings: readonly ReadingEntry[], personId: string): ReadingEntry | null {
  return readings.find((entry) => entry.kind === 'person' && entry.personA === personId) ?? null;
}

/** 내 사주풀이 */
export function selfReadingOf(readings: readonly ReadingEntry[]): ReadingEntry | null {
  return readings.find((entry) => entry.kind === 'self') ?? null;
}

/**
 * 나와 궁합을 보러 가는 곳 — **본 적이 있으면 그 글, 없으면 두 칸이 찬 궁합 화면.**
 *
 * 궁합 화면(`app/compat-picker.tsx`)은 주소의 `a.person` · `b.person` 을 읽어, 목록에 선 사람이면 그
 * 칸을 고른 채로 선다. 내 엣지도 목록에 서므로(`listed` 의 기본값) 두 칸이 다 찬다.
 */
export function compatHrefOf(pair: ReadingEntry | null, selfId: string | null, personId: string): string {
  if (pair !== null) return readingHref(pair);
  return selfId === null ? `/compat#b.person=${personId}` : `/compat#a.person=${selfId}&b.person=${personId}`;
}

function personOf(person: HomePerson, readings: readonly ReadingEntry[], selfId: string | null): MapPerson {
  const pair = pairWithSelf(readings, selfId, person.personId);
  const reading = readingOf(readings, person.personId);
  const note = person.note?.trim() ?? '';
  return {
    id: person.personId,
    label: person.label,
    note: note === '' ? null : note,
    day: person.chart.ok ? dayOf(person.chart.saju) : null,
    unreadable: person.chart.ok ? null : person.chart.message,
    tileHref: `#${tileAnchor(person.personId)}`,
    detailHref: `/me/people/${person.personId}`,
    readingHref: `/me/readings/${person.personId}`,
    reading: reading === null ? null : { metaphor: reading.metaphor, current: reading.fromCurrentChart },
    compat: { href: compatHrefOf(pair, selfId, person.personId), score: pair?.score ?? null, seen: pair !== null },
  };
}

export function mapModelOf({
  self,
  people,
  readings,
}: {
  self: { personId: string; label: string; saju: Saju };
  people: readonly HomePerson[];
  readings: readonly ReadingEntry[];
}): MapModel {
  const selfId = self.personId;
  const ids = new Set(people.map((person) => person.personId));

  return {
    self: { label: self.label, ...dayOf(self.saju) },
    people: people.map((person) => personOf(person, readings, selfId)),
    /* 나 밖의 두 사람 궁합 — 둘 다 지도에 있을 때만 선이 선다. 같은 쌍은 가장 최근 글 하나 */
    links: readings.flatMap((entry, index) =>
      entry.kind === 'private' &&
      entry.personA !== null &&
      entry.personB !== null &&
      ids.has(entry.personA) &&
      ids.has(entry.personB) &&
      !readings.slice(0, index).some((earlier) => samePair(earlier, entry))
        ? [
            {
              a: entry.personA,
              b: entry.personB,
              score: entry.score,
              href: readingHref(entry),
              label: `${entry.labelA ?? ''} × ${entry.labelB ?? ''}`,
            },
          ]
        : [],
    ),
  };
}

const samePair = (one: ReadingEntry, other: ReadingEntry): boolean =>
  one.kind === 'private' &&
  ((one.personA === other.personA && one.personB === other.personB) ||
    (one.personA === other.personB && one.personB === other.personA));

/** 한 사람과 이미 본 다른 저장한 사람의 궁합 — 누른 사람의 카드가 칩으로 든다 */
export function linksOf(
  model: MapModel,
  personId: string,
): { otherLabel: string; score: number | null; href: string }[] {
  return model.links.flatMap((link) => {
    const otherId = link.a === personId ? link.b : link.b === personId ? link.a : null;
    const other = otherId === null ? undefined : model.people.find((one) => one.id === otherId);
    return other === undefined ? [] : [{ otherLabel: other.label, score: link.score, href: link.href }];
  });
}
