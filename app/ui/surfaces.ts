/**
 * **판의 모양과 글자의 단** — 부드러움(5차)의 카드 · 타일 · 제목을 한 자리에서 든다.
 *
 * 모서리는 큰 판 32px · 카드 28px(`app/card.ts` 의 `CARD`, 스물한 자리가 쓴다) · 타일 24px · 줄 카드 20px ·
 * 단추는 알약. 간격은 4 · 8 · 12 · 16 · 24 · 32 · 48 단계다(시안 `NOTES.md`).
 */

/** 크림 종이 판 — 한 화면의 주인공(관계 지도 · 내 사주 등록). 한 화면에 하나 */
export const PAPER = 'rounded-[2rem] bg-cream p-6 sm:p-8';

/**
 * 오행 타일 — `ELEMENT_TONE[x].scope`(또는 `elementScope`)와 함께 단다. 면이 그 오행의 파스텔이 되고 안의
 * `BUTTON_ON_TILE` · `ElementSymbol` 이 같은 색을 따른다.
 */
export const TILE = 'rounded-[1.5rem] bg-[var(--tile)] p-4 text-foreground';

/** 줄 카드 — 목록의 한 줄(소식 · 대화방 · 풀이 줄) */
export const ROW_CARD = 'rounded-[1.25rem] border border-border bg-surface px-4 py-3';

/** 점선 빈 자리 — 「한 자리 더」(사람 추가 타일 · 빈 목록) */
export const EMPTY_SLOT = 'rounded-[1.5rem] border-2 border-dashed border-border-strong p-6';

/*
  **글자의 단.** 둥근 서체(`font-rounded`, 고운돋움)는 제목 단에만 쓴다 — 굵기가 400 하나뿐이라 작은
  크기에서 획이 흐리다. 본문 · 단추 · 보조는 Pretendard 다. 12px 아래는 딱지(11px)뿐이다.
*/

/** 표시 — 화면의 첫 한 줄(인사 · 빈 상태의 큰 말) */
export const TYPE_DISPLAY = 'font-rounded text-[1.75rem] leading-[1.3] tracking-[-0.02em] text-foreground sm:text-[2.25rem]';

/** 제목 — 화면 제목(`h1`) */
export const TYPE_TITLE = 'font-rounded text-[1.75rem] leading-[1.3] tracking-[-0.02em] text-foreground sm:text-[2rem]';

/** 구역 제목 — 카드 · 구역의 `h2` */
export const TYPE_SECTION = 'font-rounded text-[1.5rem] leading-8 text-foreground';

/** 이름 — 사람 · 카드 머리 */
export const TYPE_NAME = 'font-rounded text-[1.3rem] leading-7 text-foreground';

/** 보조 — 날짜 · 메모 · 설명 아래 줄 */
export const TYPE_META = 'text-[13px] font-medium leading-5 text-secondary';

/** 딱지 — 안 읽은 수 · 짧은 상태 표시. 12px 아래가 허락되는 유일한 자리 */
export const BADGE =
  'inline-grid h-5 min-w-5 place-items-center rounded-full bg-badge px-1 text-[11px] font-bold leading-none tabular-nums text-on-badge';
