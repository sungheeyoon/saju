/**
 * **판의 모양과 글자의 단** — 부드러움(5차)의 카드 · 타일 · 제목을 한 자리에서 든다.
 *
 * 모서리는 큰 판 32px · 카드 28px(`CARD`) · 타일 24px · 줄 카드 20px ·
 * 단추는 알약. 간격은 4 · 8 · 12 · 16 · 24 · 32 · 48 단계다(시안 `NOTES.md`).
 */

/**
 * 카드 한 장 — 흰 면 · 가는 테 · 카드 그림자. 앱에서 가장 많이 부르는 판이다(스무 자리 넘게).
 *
 * 모서리는 **1.75rem 이다.** 내 명식과 저장한 사람 카드가 그 반지름으로 서면서 같은 화면 안에서 카드마다 모서리가
 * 갈렸다 — 한 화면에 두 벌이 서면 어느 쪽이 이 앱의 카드인지 사용자가 정하게 된다. `app/card.ts` 에 따로 살다가
 * 공용 판이 모인 이 파일로 왔다(2026-09-26).
 */
export const CARD = 'rounded-[1.75rem] border border-border bg-surface p-5 shadow-card sm:p-6';

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

/*
  **여러 화면이 같은 글자로 적던 모양.** 2026-09-25 에 재어 보니 아래 셋은 화면마다 한 글자도 다르지 않게
  다시 적혀 있었다 — 확인 창 셋, 「수정 전」 딱지 넷, 펼침 줄 넷. 한쪽만 고치면 같은 것이 두 벌로 선다.
*/

/**
 * 확인 창 — 되돌리기 어려운 누름 앞의 `<dialog>`. `m-auto` 는 장식이 아니다 — Tailwind 의 preflight 이
 * 여백을 0 으로 되돌려, 브라우저가 가운데에 놓던 `margin: auto` 를 다시 세운다
 */
export const DIALOG =
  'm-auto w-[min(26rem,calc(100%-2rem))] rounded-[1.75rem] border border-border bg-surface p-6 text-foreground shadow-float backdrop:bg-black/40';

/** 확인 창의 단추 줄 — 누르는 쪽이 오른쪽이고, 좁은 화면에서는 위아래로 서며 그때도 확인이 위다 */
export const DIALOG_ACTIONS = 'mt-6 flex flex-col gap-2 sm:flex-row-reverse';

/** 「수정 전」 딱지 — 출생 정보를 고치기 전에 만든 풀이. 11px 딱지 단이다 */
export const STALE_CHIP = 'rounded-full bg-warning-wash px-1.5 py-0.5 text-[11px] font-semibold text-warning';

/** 펼침 줄 — 명식 화면 안 `<details>` 의 `<summary>`. 누를 자리 44px, 기본 삼각표는 숨긴다 */
export const DISCLOSURE_SUMMARY =
  'flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden';
