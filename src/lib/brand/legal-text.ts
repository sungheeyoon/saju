/**
 * 이용약관 · 환불정책 화면이 그리는 글의 모양 — 문단 · 번호 목록 · 점 목록 · 표 넷뿐이다. 글자는 `terms.ts` · `refund.ts` 가
 * 들고, 화면(`app/legal-body.tsx`)은 이 모양을 그리기만 한다.
 */
export type LegalTable = {
  readonly head: readonly string[];
  readonly rows: readonly (readonly string[])[];
};

/** 번호 목록의 한 항 — 아래에 점 목록이나 표가 붙을 수 있다 */
export type LegalItem = {
  readonly text: string;
  readonly bullets?: readonly string[];
  readonly table?: LegalTable;
  readonly after?: string;
};

export type LegalBlock =
  | { readonly kind: 'para'; readonly text: string }
  | { readonly kind: 'numbered'; readonly items: readonly LegalItem[] }
  | { readonly kind: 'bullets'; readonly items: readonly string[] }
  | { readonly kind: 'table'; readonly table: LegalTable };

export type LegalSection = {
  readonly title: string;
  readonly blocks: readonly LegalBlock[];
};

export type LegalPart = {
  /** 장 제목 — 없으면 조항만 잇는다(환불정책) */
  readonly title: string | null;
  readonly sections: readonly LegalSection[];
};

export type LegalDocument = {
  /** 시행일 — 정하지 않았으면 `null` 이고 화면에 줄째 안 선다 */
  readonly effectiveDate: string | null;
  readonly parts: readonly LegalPart[];
};

export const para = (text: string): LegalBlock => ({ kind: 'para', text });
export const numbered = (...items: readonly (string | LegalItem | null)[]): LegalBlock => ({
  kind: 'numbered',
  items: items.flatMap((item) => (item === null ? [] : [typeof item === 'string' ? { text: item } : item])),
});
export const bullets = (...items: readonly (string | null)[]): LegalBlock => ({
  kind: 'bullets',
  items: items.filter((item): item is string => item !== null),
});
export const table = (head: readonly string[], ...rows: readonly (readonly string[])[]): LegalTable => ({ head, rows });
