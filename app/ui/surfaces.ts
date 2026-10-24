/**
 * **판의 모양과 글자의 단** — 부드러움(5차)의 카드 · 타일 · 제목을 한 자리에서 든다.
 *
 * 모서리는 세 단이다 — 카드 20px(`rounded-card`: 판 · 종이 · 타일 · 줄 카드 · 띄움 판) · 칸 12px(`rounded-cell`: 그 안의 칸 · 작은 상자) ·
 * 단추는 알약. 글자 크기도 단이다(`text-small` 13px · `text-body` 15px …) — 토큰은 `app/globals.css` 의 `@theme inline`,
 * 잠금은 `app/ui/scale.test.ts`(ADR 0109 추기 2026-10-12). 간격은 4 · 8 · 12 · 16 · 24 · 32 · 48 단계다(시안 `NOTES.md`).
 */

/*
 * **덧붙여 바꿀 속성은 면(`*_FACE`)에서 뺐다** — 단추 상수(`buttons.ts`)와 같은 까닭이다. 상수 뒤에 `py-0` · `text-foreground` 를
 * 이어 붙이면 이기는 쪽은 적은 차례가 아니라 Tailwind 가 지은 CSS 의 차례가 정한다 — 인연 탭 접이칸의 `py-0` 이 줄 카드의
 * `py-3` 에, 도움말 링크의 `text-foreground` 가 보조 글자의 `text-secondary` 에 졌다(2026-10-22 읽기 감사). 여백 · 면 · 테 색처럼
 * 자리마다 바꾸는 속성은 면 뒤에 쓰는 자리가 한 번만 적는다. 잠금은 `buttons.test.ts`(상수 뒤에 그 상수가 이미 세운 속성을
 * 덧붙이지 않는다) — 이 파일의 상수도 센다.
 */

/**
 * **화면의 기둥** — 뿌리 틀(`.app-shell`, 72rem)이 넓은 화면에서 본문을 가운데 한 기둥으로 묶는 폭. 같은 기둥을 쓰는 화면끼리는
 * 제목이 같은 자리에 선다. `app-shell` 과 함께 `main` 에 붙이거나, 그 안의 묶음에 `mx-auto w-full` 과 함께 붙인다.
 *
 * - `COLUMN` — 가운데 기둥 하나(ADR 0161). 홈의 등록 전 · 가입 · 저장한 사람 목록과 상세 · 계정 관리 · 프로필 · 설문 · 소식.
 *   42 · 44 · 46rem 로 갈렸던 것을 합쳤다. 예외로 로그인 전 첫 화면 · `/saju` 는 확정한 42rem 이다(`home-hero.tsx`). 출생 정보 폼의 상한(43rem, `birth-form.module.css`)이 이 기둥에
 *   선 카드의 안쪽이라, 종이 · 카드 · 목록에서 연 수정 판 어디서나 폼이 남는 데 없이 든다
 * - `COLUMN_READING` — 받은 공유본(`app/share/view.tsx`). 풀이 본문의 열(36rem, `READING_COLUMN`)에 판의 안쪽 여백(양쪽 2rem)
 *
 * 목록 화면(홈 · 보관함 · 인연 · 채팅)은 뿌리 틀의 전폭, 궁합 · 인연 궁합은 58rem 이다.
 */
export const COLUMN = 'max-w-[46rem]';
export const COLUMN_READING = 'max-w-[40rem]';

/**
 * 카드 한 장 — 흰 면 · 가는 테 · 카드 그림자. 앱에서 가장 많이 부르는 판이다(스무 자리 넘게).
 *
 * 모서리는 **1.75rem 이다.** 내 명식과 저장한 사람 카드가 그 반지름으로 서면서 같은 화면 안에서 카드마다 모서리가
 * 갈렸다 — 한 화면에 두 벌이 서면 어느 쪽이 이 앱의 카드인지 사용자가 정하게 된다. `app/card.ts` 에 따로 살다가
 * 공용 판이 모인 이 파일로 왔다(2026-09-26).
 *
 * 면(`CARD_FACE`)은 테 색 · 면 색 · 여백을 뺐다 — 경고 판(`app/saju/corrections.tsx`)처럼 색을 바꾸거나 공유본처럼 넓은 화면의
 * 여백을 바꾸는 자리가 쓴다.
 */
export const CARD_FACE = 'rounded-card border shadow-card';
export const CARD = `${CARD_FACE} border-border bg-surface p-5 sm:p-6`;

/**
 * 카드의 **테만** — 모서리 · 가는 테 · 흰 면. 속을 띠로 나눠 띠마다 제 여백을 두는 판이 쓴다(궁합 고르는 판 — 위 띠는
 * 두 칸, 아래 띠는 사이 · 단추). 띠의 면이 모서리 밖으로 새지 않게 `overflow-hidden` 을 함께 단다. 그림자가 없는 것은
 * 운영자가 승인한 모양 그대로다(#543, 2026-10-08) — `CARD` 와 같은 모서리 · 테를 갈라 적지 않으려고 둔다.
 */
export const CARD_FRAME = 'overflow-hidden rounded-card border border-border bg-surface';

/** 크림 종이 판 — 한 화면의 주인공(관계 지도 · 내 사주 등록). 한 화면에 하나. 면(`PAPER_FACE`)은 여백만 뺐다 */
export const PAPER_FACE = 'rounded-card bg-cream';
export const PAPER = `${PAPER_FACE} p-6 sm:p-8`;

/**
 * 크림 종이 한 장을 **위아래 두 토막으로** — 로그인 전 첫 화면이 쓴다(입력 폼 시안 n, ADR 0132).
 *
 * 제목 · 입구 둘 · 폼 · 주 단추가 한 장 안에 서야 하는데, 머리(`home-hero.tsx`)와 폼(`saju-calculator.tsx` ·
 * `pair-taste.tsx`)은 서로 다른 부품이고 결과는 폼 **밖** 아래에 선다. 한 부품으로 싸면 결과까지 종이 위에 올라간다.
 * 그래서 머리는 위 모서리만, 폼은 아래 모서리만 둥글고, 폼 쪽 자리가 둘 사이의 틈만큼 올라붙는다.
 */
export const PAPER_TOP = 'rounded-t-card bg-cream';

export const PAPER_BOTTOM = 'rounded-b-card bg-cream px-3 pb-5 sm:px-10 sm:pb-9';

/**
 * 오행 타일 — `ELEMENT_TONE[x].scope`(또는 `elementScope`)와 함께 단다. 면이 그 오행의 파스텔이 되고 안의
 * `BUTTON_ON_TILE` · `ElementSymbol` 이 같은 색을 따른다.
 */
export const TILE = 'rounded-card bg-[var(--tile)] p-4 text-foreground';

/**
 * 띄움 메뉴 판 — 단추 아래(위)에 떠서 고를 줄을 드는 흰 판(설정 톱니 · 풀이권 · 대화방 「⋯」 · 신고 · 차단 · 사진 한 장의 메뉴 ·
 * 저장한 사람의 관리 메뉴). 테는 `ring` 이라 판의 폭을 먹지 않는다. 안쪽 여백 · 폭 · 자리는 판마다 달라 쓰는 자리가 붙인다.
 * 관리 메뉴(`app/me/people/person-menu.tsx`)만 테가 `border` 였는데 운영자가 맞추라고 했다(2026-10-14, G-109)
 */
export const MENU_PANEL = 'rounded-card bg-surface shadow-float ring-1 ring-border';

/** 줄 카드 — 목록의 한 줄(소식 · 대화방 · 풀이 줄). 면(`ROW_CARD_FACE`)은 여백만 뺐다 */
export const ROW_CARD_FACE = 'rounded-card border border-border bg-surface';
export const ROW_CARD = `${ROW_CARD_FACE} px-4 py-3`;

/**
 * 선 줄 — 판 없이 위아래 가는 선 사이에 서는 한 줄. 카드와 카드 사이에 끼는 요약 한 줄(궁합 탭의 「궁합풀이」)이 쓴다 —
 * 줄 카드(`ROW_CARD`)로 세우면 위아래 카드 사이에서 판이 하나 더 늘어 보인다(#543, 2026-10-08 운영자 승인 모양)
 */
export const ROW_LINE = 'rounded-cell border-y border-border px-2 py-4';

/** 점선 빈 자리 — 「한 자리 더」(사람 추가 타일 · 빈 목록). 면(`EMPTY_SLOT_FACE`)은 여백만 뺐다 */
export const EMPTY_SLOT_FACE = 'rounded-card border-2 border-dashed border-border-strong';
export const EMPTY_SLOT = `${EMPTY_SLOT_FACE} p-6`;

/*
  **글자의 단 — 텍스트 스타일 일곱 벌**(ADR 0109 추기 2026-10-24). 크기 · 굵기 · 줄 높이를 한 벌로 묶었다 — 화면은 크기와 굵기를
  따로 붙이지 않고 이 상수를 부른다. 값은 토스 TDS(Typography 2 · 4 · 5 · 6 · 7)와 당근 SEED(screenTitle 26/35 bold)의 단을 따랐다.

  | 스타일 | 상수 | 크기/줄 높이 | 굵기 |
  | 화면 제목 | `TYPE_TITLE` | 26/35 | 700 |
  | 구역 제목 | `TYPE_SECTION` | 20/29 | 700 |
  | 카드 제목 | `TYPE_NAME` | 17/24 | 600 |
  | 본문 | `TYPE_BODY` | 15/24 | 400 |
  | 보조 | `TYPE_META` | 13/20 | 500 |
  | 캡션 | `TYPE_CAPTION` | 12/16 | 400 |
  | 딱지 | `BADGE` · `STALE_CHIP` | 11 | 700 · 600 |

  **제목은 시스템 서체 굵게다.** 고운돋움(`font-rounded`)은 굵기가 400 하나뿐이라, 600~700 인 라벨 · 단추 아래 서면 제목이 그
  아래 글보다 가벼웠다(위계가 뒤집혔다). 둥근 서체는 브랜드 자리 — 서비스 이름과 인용 — 에만 남는다(`app/layout.tsx`).
  12px 아래는 딱지(11px)뿐이다. 글을 받는 입력 칸(input · textarea · select)은 16px 아래로 두지 않는다 — iOS Safari 가 초점에
  화면을 확대한다(`app/ui/fields.test.ts`).
*/

/** 화면 제목 — 화면의 `h1` 하나. 폭마다 크기를 바꾸지 않는다 */
export const TYPE_TITLE = 'text-title font-bold leading-[1.35] tracking-[-0.02em] text-foreground';

/**
 * 옛 「표시」 단(인사 · 빈 상태의 큰 말) — 화면 제목과 한 벌로 합쳤다. 대화 화면(`app/me/chat/empty.tsx`)이 나란히 고쳐지는
 * 동안만 이름이 남는다 — 새 자리는 `TYPE_TITLE` 을 부른다
 */
export const TYPE_DISPLAY = TYPE_TITLE;

/** 구역 제목 — 카드 · 구역의 `h2` */
export const TYPE_SECTION = 'text-heading font-bold leading-[1.45] tracking-[-0.01em] text-foreground';

/** 카드 제목 — 사람 이름 · 카드 머리 · 창 제목 */
export const TYPE_NAME = 'text-lead font-semibold leading-6 text-foreground';

/** 본문 — 설명 문단 · 카드 안의 글 */
export const TYPE_BODY = 'text-body leading-6 text-foreground';

/** 보조 — 날짜 · 메모 · 설명 아래 줄 */
export const TYPE_META = 'text-small font-medium leading-5 text-secondary';

/** 캡션 — 그림 · 숫자 곁의 작은 설명, 바닥글 */
export const TYPE_CAPTION = 'text-fine leading-4 text-muted';

/** 딱지 — 안 읽은 수 · 짧은 상태 표시. 12px 아래가 허락되는 유일한 자리. 면(`BADGE_FACE`)은 옆 여백만 뺐다 */
export const BADGE_FACE =
  'inline-grid h-5 min-w-5 place-items-center rounded-full bg-badge text-tag font-bold leading-none tabular-nums text-on-badge';
export const BADGE = `${BADGE_FACE} px-1`;

/*
  **여러 화면이 같은 글자로 적던 모양.** 2026-09-25 에 재어 보니 아래 셋은 화면마다 한 글자도 다르지 않게
  다시 적혀 있었다 — 확인 창 셋, 「수정 전」 딱지 넷, 펼침 줄 넷. 한쪽만 고치면 같은 것이 두 벌로 선다.
*/

/**
 * 확인 창 — 되돌리기 어려운 누름 앞의 `<dialog>`. 창 한 벌은 `app/ui/confirm-dialog.tsx` 의 `ConfirmDialog` 가 이 판을 입는다. `m-auto` 는 장식이 아니다 — Tailwind 의 preflight 이
 * 여백을 0 으로 되돌려, 브라우저가 가운데에 놓던 `margin: auto` 를 다시 세운다
 */
export const DIALOG =
  'm-auto w-[min(26rem,calc(100%-2rem))] rounded-card border border-border bg-surface p-6 text-foreground shadow-float backdrop:bg-black/40';

/**
 * 묻는 자리의 단추 줄 — 누르는 쪽(실행)을 먼저 적고 「취소」를 뒤에 적는다. 넓으면 실행이 오른쪽, 좁은 화면에서는 위아래로 서며
 * 그때도 실행이 위다. 창이 아니라 판 안에서 한 번 더 묻는 자리(대화방의 차단 · 탈퇴)도 같은 차례다(ADR 0166)
 */
export const CONFIRM_ROW = 'flex flex-col gap-2 sm:flex-row-reverse';

/** 확인 창의 단추 줄 — `CONFIRM_ROW` 에 제목 · 본문과 띄우는 여백 */
export const DIALOG_ACTIONS = `mt-6 ${CONFIRM_ROW}`;

/** 「수정 전」 딱지 — 출생 정보를 고치기 전에 만든 풀이. 11px 딱지 단이다 */
export const STALE_CHIP = 'rounded-full bg-warning-wash px-1.5 py-0.5 text-tag font-semibold text-warning';

/** 펼침 줄 — 명식 화면 안 `<details>` 의 `<summary>`. 누를 자리 44px, 기본 삼각표는 숨긴다. 면(`DISCLOSURE_SUMMARY_FACE`)은 글자 크기 · 굵기만 뺐다 */
export const DISCLOSURE_SUMMARY_FACE =
  'flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden';
export const DISCLOSURE_SUMMARY = `${DISCLOSURE_SUMMARY_FACE} text-sm font-medium`;
