import { readingHrefOf } from '../../reading/target';

/**
 * 넓은 화면에서 목록만 열면 **펼 한 권** — 내 사주풀이가 있으면 그것, 없으면 가장 최근 한 사람 풀이(2026-09-27 운영자).
 * 책장의 차례는 그대로 DB 가 준 최근 순이다 — 여기서는 펼 한 권만 고른다.
 *
 * `book.ts` 가 아니라 따로 두는 것은 `frame.tsx`(클라이언트)가 부르기 때문이다 — 엔진 표를 브라우저로 끌고 가지 않는다.
 */
export function openingHref(singles: readonly { readonly href: string }[]): string | null {
  const self = readingHrefOf({ kind: 'self' });
  return singles.find((book) => book.href === self)?.href ?? singles[0]?.href ?? null;
}
