import { isOpenResult, withCameFrom } from '../../../came-from';
import { readingHrefOf } from '../../reading/target';
import { SHELF_KINDS, type ShelfKind } from './kind';

/**
 * 넓은 화면에서 목록만 열면 **펼 한 권** — 칩마다 고른다(운영자 2026-10-09: 「당연히 최근에 본 것을 펼쳐야지」).
 *
 * 1. 그 칩에서 **이 브라우저가 마지막으로 연 풀이** — 아직 책장에 있으면.
 * 2. 없으면 그 칩의 기본 — 전체 · 사주풀이 칩은 내 사주풀이, 없으면 가장 최근 한 사람 풀이(2026-09-27 운영자).
 *    궁합풀이 · 인연 궁합 칩은 책장의 첫 권(DB 가 준 최근 순).
 * 3. 그 칩에 한 권도 없을 때만 아무것도 펴지 않는다 — 오른쪽은 빈 자리 안내다.
 *
 * 기억은 이 브라우저의 `localStorage` 에만 둔다 — 서버에 열람 기록을 남기지 않는다. 못 읽으면 기억이 없는 것과 같다.
 *
 * `book.ts` 가 아니라 따로 두는 것은 `frame.tsx`(클라이언트)가 부르기 때문이다 — 엔진 표를 브라우저로 끌고 가지 않는다.
 */

/** 칩마다 책장에 선 차례 그대로의 주소 — 온 곳(`?from=`)을 싣기 전의 제 주소다(`readingHref` · `/me/match/[id]`) */
export type ShelfLists = Readonly<Record<ShelfKind, readonly string[]>>;

/** 칩마다 마지막으로 연 풀이의 주소 */
export type LastOpened = Partial<Record<ShelfKind, string>>;

export function openingHref(kind: ShelfKind, lists: ShelfLists, last: LastOpened): string | null {
  const list = lists[kind];
  const remembered = last[kind];
  if (remembered !== undefined && list.includes(remembered)) return remembered;
  if (kind === 'all' || kind === 'saju') {
    const self = readingHrefOf({ kind: 'self' });
    const singles = lists.saju;
    const single = singles.includes(self) ? self : singles[0];
    if (single !== undefined) return single;
  }
  return list[0] ?? null;
}

/** 지금 펼친 글이 책장의 어느 권인가 — 표지의 테와 같은 잣대(`isOpenResult`: 경로와 두 사람) */
export function openBookOf(lists: ShelfLists, pathname: string, search: string): string | null {
  return lists.all.find((href) => isOpenResult(withCameFrom(href, 'shelf'), pathname, search)) ?? null;
}

/** 한 권을 열었다 — 그 권이 선 칩마다(전체와 제 종류) 마지막으로 연 풀이가 된다 */
export function withOpened(last: LastOpened, lists: ShelfLists, href: string): LastOpened {
  const next: LastOpened = { ...last };
  for (const kind of SHELF_KINDS) if (lists[kind].includes(href)) next[kind] = href;
  return next;
}

/** 저장해 둔 글자를 읽는다 — 모르는 모양이면 기억이 없는 것이다 */
export function lastOpenedOf(raw: string | null): LastOpened {
  if (raw === null) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return {};
    const last: LastOpened = {};
    for (const kind of SHELF_KINDS) {
      const href = (value as Record<string, unknown>)[kind];
      if (typeof href === 'string') last[kind] = href;
    }
    return last;
  } catch {
    return {};
  }
}

/** 이 브라우저에 두는 자리의 이름 */
export const LAST_OPENED_KEY = 'shelf:last-opened';
