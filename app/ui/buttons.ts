/**
 * **단추 세 층과 아이콘 단추** — 모양만 봐도 눌리는 것임을 안다(5차, 부드러움).
 *
 * 2026-09-24 에 재어 보니 앱의 「주 단추」가 화면마다 달랐다 — 모서리 `rounded-xl` · `rounded-full`, 높이 36~48px,
 * 초록 채움과 테두리 알약이 섞여 있었다. 채택한 부드러움 시안(ADR 0109)의 세 층을 제품 토큰으로 옮긴다.
 *
 * - **주**(`BUTTON_PRIMARY`): 먹색 채움 알약. 파스텔 위 어디에 놓여도 가장 먼저 보이도록 오행 색을 안 입는다. 한 영역에 하나.
 * - **보조**(`BUTTON_SECONDARY`): 흰 알약 + 가는 테.
 * - **셋째**(`BUTTON_TERTIARY`): 밑줄 글자(+ 화살표). 누를 자리는 글자보다 넓게 44px.
 * - **아이콘**(`ICON_BUTTON`): 동그란 흰 단추 44px — 종 · 톱니 · 닫기.
 *
 * 누르면 조금 줄어든다(`active:scale`) — 손가락 아래에서 「눌렸다」를 말하는 유일한 신호라 빼지 않는다.
 * 비활성은 `disabled:` 로 흐려지고 줄지 않는다. 포커스 테는 `globals.css` 가 전역으로 세운다.
 *
 * **주 단추의 비활성은 그림자 없는 낮은 대비 면이다**(`PRIMARY_OFF`, ADR 0160). 먹색 채움을 흐리기만 하면
 * 그림자가 남아 눌릴 것처럼 떠 보였다 — 판마다 저장 단추가 주 · 보조로 갈려 있던 것과 함께, 「지금은 못 누른다」가 모양으로
 * 한 벌이 되게 한다. 눌러야 이유를 말할 수 있는 단추(궁합 보기)는 `disabled` 대신 `aria-disabled` 를 달고 같은 모양을 입는다.
 */

/** 누를 때 조금 준다 · 못 누를 때 흐려진다. 누름을 받아 까닭을 말하는 단추(`aria-disabled`, ADR 0160)도 같은 흐림이고 줄지 않는다 */
const PRESS =
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55 aria-disabled:opacity-55 aria-disabled:active:scale-100';

/** 주 단추가 못 눌릴 때 — 먹색 대신 가라앉은 면 · 흐린 글자 · 그림자 없음. `aria-disabled` 도 같은 모양이고 줄지 않는다 */
const PRIMARY_OFF =
  'active:scale-[0.97] disabled:pointer-events-none disabled:bg-surface-sunken disabled:text-muted disabled:shadow-none aria-disabled:bg-surface-sunken aria-disabled:text-muted aria-disabled:shadow-none aria-disabled:hover:bg-surface-sunken aria-disabled:active:scale-100';

/*
 * **덧붙여 바꿀 속성은 면(`*_FACE`)에서 뺐다.** 상수 뒤에 `px-3` · `text-danger` 같은 클래스를 이어 붙이면 이기는 쪽은 클래스를
 * 적은 차례가 아니라 Tailwind 가 지은 CSS 의 차례가 정한다 — 폰의 `px-3` 이 `px-5` 에 져 단추가 넓었고, 「차단으로 넘어가기」의
 * 위험 색이 `text-foreground` 에 져 검게 섰다(G-109). 옆 여백 · 글자색처럼 자리마다 바꾸는 속성은 면에 두지 않고, 쓰는 자리가
 * 한 번만 적는다. 잠금은 `buttons.test.ts`(상수 뒤에 그 상수가 이미 세운 속성을 덧붙이지 않는다).
 */

/** 주 단추의 면 — 옆 여백만 뺐다. 폭에 따라 여백을 바꾸는 자리(내 사주 카드의 반반 단추)가 쓴다 */
export const BUTTON_PRIMARY_FACE = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent text-body font-semibold text-on-accent shadow-lift hover:bg-accent-strong ${PRIMARY_OFF}`;
export const BUTTON_PRIMARY = `${BUTTON_PRIMARY_FACE} px-5`;

/** 보조 단추의 면 — 옆 여백만 뺐다 */
export const BUTTON_SECONDARY_FACE = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface text-body font-semibold text-foreground hover:border-border-strong ${PRESS}`;
export const BUTTON_SECONDARY = `${BUTTON_SECONDARY_FACE} px-5`;

/** 셋째 단추의 면 — 글자 크기 · 굵기 · 색을 뺐다. 결제 화면의 작은 링크처럼 글자를 따로 정하는 자리가 쓴다 */
export const BUTTON_TERTIARY_FACE = `inline-flex min-h-11 items-center gap-1 rounded-cell px-1 underline decoration-[color-mix(in_srgb,var(--foreground)_25%,transparent)] decoration-2 underline-offset-[6px] hover:decoration-foreground active:opacity-70 disabled:opacity-55`;
export const BUTTON_TERTIARY = `${BUTTON_TERTIARY_FACE} text-sm font-semibold text-foreground`;
/** 셋째 단추의 위험 색 — 「차단으로 넘어가기」처럼 되돌리기 어려운 쪽으로 가는 글자 단추 */
export const BUTTON_TERTIARY_DANGER = `${BUTTON_TERTIARY_FACE} text-sm font-semibold text-danger`;

/** 작은 자리의 주 · 보조 — 줄 끝 · 카드 머리처럼 48px 이 무거운 곳. 누를 자리는 44px 그대로다 */
export const BUTTON_PRIMARY_SMALL = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-strong ${PRIMARY_OFF}`;
/**
 * 작은 보조의 **면만** — 높이 · 옆 여백은 쓰는 자리가 한 번만 정한다. 클래스 문자열을 이어 붙여 `px-4` 를 `px-3` 으로 덮으면
 * 어느 쪽이 이길지는 CSS 의 순서가 정해 폰에서 덮은 값이 안 먹는다 — 크기를 바꾸는 자리(방 머리의 궁합 단추)는 이것을 쓴다.
 */
export const BUTTON_SECONDARY_SMALL_FACE = `inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-surface text-sm font-semibold text-foreground hover:border-border-strong ${PRESS}`;
export const BUTTON_SECONDARY_SMALL = `${BUTTON_SECONDARY_SMALL_FACE} min-h-11 px-4`;

/** 되돌릴 수 없는 누름(탈퇴 · 차단 · 삭제) — 주 단추의 모양에 위험 색 */
export const BUTTON_DANGER = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-danger px-5 text-body font-semibold text-surface hover:opacity-90 ${PRESS}`;

/** 판 위에 테 없이 서는 아이콘 단추 44px — 화면 머리의 ← · 「⋯」. 이름은 `aria-label` 이 든다 */
export const ICON_BUTTON_GHOST =
  'grid size-11 shrink-0 place-items-center rounded-full text-foreground hover:bg-surface-soft active:scale-95';

/** 동그란 아이콘 단추 44px — 안에 `<Icon>` 하나. 이름은 `aria-label` 이 든다 */
const ICON_BUTTON_SHAPE = `relative grid size-11 shrink-0 cursor-pointer place-items-center rounded-full ring-1 hover:ring-border-strong active:scale-95`;
export const ICON_BUTTON = `${ICON_BUTTON_SHAPE} bg-surface text-foreground ring-border`;
/** 흰 아이콘 단추의 옅은 그림 — 카드 구석의 관리 · 고치기처럼 읽는 것보다 한 단 물러선 자리. 올리면 진해진다 */
export const ICON_BUTTON_QUIET = `${ICON_BUTTON_SHAPE} bg-surface text-secondary ring-border hover:text-foreground`;
/**
 * 지금 선 자리의 아이콘 단추 — 먹색 면에 밝은 그림. `ICON_BUTTON` 뒤에 `bg-accent` 를 덧붙이면 같은 속성의 두 클래스가
 * CSS 순서로 갈려 흰 면에 밝은 그림이 서서 그림이 사라졌다(소식 종, 2026-09-27). 색은 덧붙이지 말고 이 한 벌을 쓴다
 */
export const ICON_BUTTON_ACTIVE = `${ICON_BUTTON_SHAPE} bg-accent text-on-accent ring-accent`;

/**
 * 오행 판(`tone-*`) 안의 보조 — 반투명 흰 면이 판의 색을 조금 비치고, 글자는 그 오행의 진한 색이다.
 * `ELEMENT_TONE[x].scope` 를 단 판 안에서만 뜻이 선다.
 */
export const BUTTON_ON_TILE_FACE = `inline-flex min-h-11 items-center justify-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--surface)_78%,transparent)] text-small font-semibold text-[var(--ink)] ring-1 ring-[color-mix(in_srgb,var(--ink)_18%,transparent)] hover:bg-surface active:scale-[0.96]`;
export const BUTTON_ON_TILE = `${BUTTON_ON_TILE_FACE} px-3`;

/** 오행 판 안의 주 — 아직 없는 것을 받을 때만. 한 판에 하나 */
export const BUTTON_ON_TILE_PRIMARY = `inline-flex min-h-11 items-center justify-center gap-1 rounded-full bg-accent px-3 text-small font-semibold text-on-accent hover:bg-accent-strong active:scale-[0.96]`;

/**
 * **고르는 칸 묶음** — 둘 · 셋 가운데 하나를 고르는 칸이 한 면 위에 붙어 선다(궁합 고르는 판의 「저장한 사람 · 직접 입력」).
 * 칸 수는 부르는 쪽이 `grid-cols-*` 로 정한다. 탭 목록(`app/saju/card-tabs.tsx` 의 알약)과는 다르다 — 이것은 화면을
 * 바꾸는 탭이 아니라 입력 방법을 고르는 단추라 모서리가 조금 각지다(#543 의 운영자 승인 모양, 2026-10-08). 글자는 작은
 * 단추와 같은 14px(`text-sm`)이다.
 */
export const SEGMENTS = 'grid gap-1 rounded-cell bg-surface-sunken p-1';

const SEGMENT_SHAPE = 'min-h-11 rounded-cell px-3 text-sm disabled:cursor-not-allowed disabled:opacity-45';

/** 고르는 칸 한 칸 — 안 고른 칸. 고른 칸은 `SEGMENT_ON` 한 벌을 쓴다(굵기 · 면을 덧붙이지 않는다, 아이콘 단추와 같은 까닭) */
export const SEGMENT = `${SEGMENT_SHAPE} font-medium text-secondary hover:text-foreground`;

export const SEGMENT_ON = `${SEGMENT_SHAPE} bg-surface font-semibold text-foreground shadow-soft`;

/**
 * 사진 위의 동그란 아이콘 단추 44px — 반투명 검정 면 · 흰 그림 · 흐린 뒤판. 사진이 희어도 읽힌다. 오늘의 인연 카드의 ⓘ 와
 * 신고 · 차단 「⋯」(`app/me/requests/report-block.tsx` 의 `look="photo"`)와 사진 넘기기 화살(`app/me/matching/card-photos.tsx`)이 한 벌이다.
 * 화살은 넓은 화면에만 서서(`hidden lg:grid`) 보이기를 면(`_FACE`)에서 뺐다 — 화살의 면은 한 단 옅은 검정 45% 였는데 운영자가
 * 맞추라고 했다(2026-10-14, G-109). 이름은 `aria-label` 이 든다
 */
export const ICON_BUTTON_ON_PHOTO_FACE =
  'size-11 place-items-center rounded-full bg-black/50 text-white shadow-[0_2px_8px_rgb(0_0_0/0.25)] ring-1 ring-white/30 backdrop-blur-sm';
export const ICON_BUTTON_ON_PHOTO = `grid ${ICON_BUTTON_ON_PHOTO_FACE}`;
