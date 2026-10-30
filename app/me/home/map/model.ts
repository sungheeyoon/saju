import { mapModelOf as modelWith, type MapModel } from '@/src/lib/reading/relation-map';
import type { ReadingEntry } from '@/src/lib/reading';

import { readingHref } from '../../reading/line';

export { linksOf, pairWithSelf, readingOf, selfReadingOf } from '@/src/lib/reading/relation-map';
export type { HomePerson, MapModel, MapPerson } from '@/src/lib/reading/relation-map';

/** 사람 타일의 `id` — 지도의 원이 자바스크립트 없이 가는 자리 */
export const tileAnchor = (personId: string): string => `person-${personId}`;

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

/** 값은 앱과 함께 쓴다(`src/lib/reading/relation-map.ts`) — 여기는 웹의 주소만 든다 */
export const mapModelOf = (input: Parameters<typeof modelWith>[0]): MapModel =>
  modelWith(input, {
    reading: readingHref,
    fill: (selfId, personId) => compatHrefOf(null, selfId, personId),
    tile: (personId) => `#${tileAnchor(personId)}`,
  });
