import type { ReadingKind } from '@/src/lib/reading';

/**
 * 보관함의 이름(옛 「만든 풀이」) — 머리 · 폰의 뒤로 가기 · 결과 화면의 되돌아가는 길 · 나 탭의 바로가기가 같은 말을
 * 쓴다(ADR 0133). 탭 불이 꺼진 화면이라 이 이름이 곧 「지금 어디인가」다.
 */
export const SHELF_TITLE = '풀이 보관함';

/**
 * 풀이 보관함의 **필터 넷** — 전체 · 사주풀이 · 궁합풀이 · 인연 궁합(ADR 0133).
 *
 * 주소가 든다: `/me/readings?kind=saju|compat|match`. 궁합 탭 · 인연 탭의 「모두 보기」가 이 주소로 보낸다(ADR 0129 ·
 * 0130). 없거나 모르는 값은 **전체**다 — 옛 링크 · 손으로 고친 주소가 빈 책장에 떨어지지 않는다.
 */
export const SHELF_KINDS = ['all', 'saju', 'compat', 'match'] as const;
export type ShelfKind = (typeof SHELF_KINDS)[number];

export const SHELF_KIND_LABEL: Record<ShelfKind, string> = {
  all: '전체',
  saju: '사주풀이',
  compat: '궁합풀이',
  match: '인연 궁합',
};

export function shelfKindOf(value: string | null | undefined): ShelfKind {
  return SHELF_KINDS.find((kind) => kind !== 'all' && kind === value) ?? 'all';
}

/** 풀이 한 편이 어느 칸에 서는가 — 사주풀이는 나와 저장한 사람, 궁합풀이는 직접 고른 두 사람, 인연 궁합은 동의로 열린 것 */
export function shelfKindOfReading(kind: ReadingKind): Exclude<ShelfKind, 'all'> {
  if (kind === 'match') return 'match';
  if (kind === 'private') return 'compat';
  return 'saju';
}

/**
 * 보관함 안의 주소에 지금 켠 칸을 붙인다 — 한 사람 풀이를 펼쳐도 책장이 같은 칸에 남는다. 전체는 안 붙인다.
 */
export function withShelfKind(href: string, kind: ShelfKind): string {
  return kind === 'all' ? href : `${href}?kind=${kind}`;
}
