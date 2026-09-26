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

  **누른 사람의 카드는 「나와 이 사람」의 궁합을 이어받는다.** 지도가 그리는 것이 궁합의 연결이라, 카드에 그 사람
  혼자의 사주풀이 단추와 그 비유가 같은 무게로 섰을 때 하트 점수 · 「풀이 보기」 · 「자세히」 중 무엇이 궁합풀이를
  여는지 읽히지 않았다(2026-09-26 운영자). 그 사람의 사주풀이는 아래 사람 타일과 사람 상세의 탭이 든다 — 그래서
  여기에는 그 사람의 풀이가 없고, 나와 본 궁합풀이의 점수 · 비유 · 수정 전 여부가 있다.
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
  /**
   * 나와의 궁합 — 이미 본 것이면 `seen` 이고 그 궁합풀이로 간다. 안 봤으면 두 칸이 찬 궁합 화면으로 간다.
   * 점수 · 비유는 그 글이 든 값 그대로다 — 옛 글은 비유가 없을 수 있다(`CurrentReading.metaphor`).
   * `current` 는 그 글의 여덟 글자가 아직 지금 명식인가(ADR 0071) — 안 봤으면 참이다.
   */
  compat: { href: string; seen: boolean; score: number | null; metaphor: string | null; current: boolean };
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
  const note = person.note?.trim() ?? '';
  return {
    id: person.personId,
    label: person.label,
    note: note === '' ? null : note,
    day: person.chart.ok ? dayOf(person.chart.saju) : null,
    unreadable: person.chart.ok ? null : person.chart.message,
    tileHref: `#${tileAnchor(person.personId)}`,
    detailHref: `/me/people/${person.personId}`,
    compat: {
      href: compatHrefOf(pair, selfId, person.personId),
      seen: pair !== null,
      score: pair?.score ?? null,
      metaphor: pair?.metaphor ?? null,
      current: pair?.fromCurrentChart ?? true,
    },
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
