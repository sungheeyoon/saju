import type { MapModel } from '../me/home/map/model';

/** 궁합 탭이 결과 화면에 싣는 온 곳 — 결과의 ← 와 탭 불이 궁합 탭을 가리킨다(「2026-09-29 u2」) */
const FROM_COMPAT = 'from=compat';

/**
 * **궁합 탭에서 여는 직접 궁합 결과에 `from=compat` 을 싣는다.** 결과 화면(`/me/compat?a&b`)이 아닌 주소 — 같은 화면의
 * 두 칸을 채우는 `/compat#…` · 사람 상세 — 는 그대로 둔다.
 */
export function fromCompat(href: string): string {
  if (!href.startsWith('/me/compat?') && href !== '/me/compat') return href;
  return `${href}${href.includes('?') ? '&' : '?'}${FROM_COMPAT}`;
}

/**
 * **궁합 탭의 관계 지도** — 나 탭 홈과 같은 모델을 궁합 탭의 자리에 맞춘다.
 *
 * 1. 지도가 여는 궁합풀이(누른 사람의 카드 · 두 사람 사이의 칩)는 궁합 탭에서 연 것이다 — `from=compat`.
 * 2. 이 탭에는 사람 타일이 없다(저장한 사람은 나 탭이 든다) — 자바스크립트 없이 원을 누르면 가던 `#person-…` 는 빈 자리라
 *    그 사람의 상세로 간다. 자바스크립트가 돌면 원은 여전히 카드를 연다.
 */
export function compatTabMap(model: MapModel): MapModel {
  return {
    ...model,
    people: model.people.map((person) => ({
      ...person,
      tileHref: person.detailHref,
      compat: { ...person.compat, href: fromCompat(person.compat.href) },
    })),
    links: model.links.map((link) => ({ ...link, href: fromCompat(link.href) })),
  };
}
