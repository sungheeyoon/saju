/**
 * 오행(五行)과 음양(陰陽) — 천간·지지가 공유하는 기반 타입.
 *
 * 십성 도출은 "일간 오행 대비 상대 오행의 관계" × "음양 동이(同異)"의 곱이므로,
 * 그 1단계인 생극 관계를 여기서 정의한다.
 */

/** 오행 */
export type Element = '木' | '火' | '土' | '金' | '水';

/** 음양 */
export type YinYang = '陽' | '陰';

export const ELEMENTS = ['木', '火', '土', '金', '水'] as const satisfies readonly Element[];

export const ELEMENT_KO: Record<Element, string> = {
  木: '목',
  火: '화',
  土: '토',
  金: '금',
  水: '수',
};

export const YIN_YANG_KO: Record<YinYang, string> = {
  陽: '양',
  陰: '음',
};

/** 상생(相生) — 키가 생(生)해 주는 오행. 木生火 火生土 土生金 金生水 水生木 */
export const GENERATES: Record<Element, Element> = {
  木: '火',
  火: '土',
  土: '金',
  金: '水',
  水: '木',
};

/** 상생 역방향 — 키를 생해 주는 오행 */
export const GENERATED_BY: Record<Element, Element> = {
  火: '木',
  土: '火',
  金: '土',
  水: '金',
  木: '水',
};

/** 상극(相剋) — 키가 극(剋)하는 오행. 木剋土 土剋水 水剋火 火剋金 金剋木 */
export const CONTROLS: Record<Element, Element> = {
  木: '土',
  土: '水',
  水: '火',
  火: '金',
  金: '木',
};

/** 상극 역방향 — 키를 극하는 오행 */
export const CONTROLLED_BY: Record<Element, Element> = {
  土: '木',
  水: '土',
  火: '水',
  金: '火',
  木: '金',
};

/**
 * 기준 오행(일간) 대비 상대 오행의 관계.
 * 괄호 안은 여기에 음양 동이를 적용했을 때 나오는 십성 계열.
 */
export type ElementRelation =
  /** 비겁(比劫) — 나와 같은 오행 */
  | 'same'
  /** 식상(食傷) — 내가 생하는 오행 */
  | 'generates'
  /** 재성(財星) — 내가 극하는 오행 */
  | 'controls'
  /** 관성(官星) — 나를 극하는 오행 */
  | 'controlledBy'
  /** 인성(印星) — 나를 생하는 오행 */
  | 'generatedBy';

/** 기준 오행 `self`에서 본 `other`의 관계를 반환한다. */
export function elementRelation(self: Element, other: Element): ElementRelation {
  if (self === other) return 'same';
  if (GENERATES[self] === other) return 'generates';
  if (CONTROLS[self] === other) return 'controls';
  if (CONTROLLED_BY[self] === other) return 'controlledBy';
  return 'generatedBy';
}
