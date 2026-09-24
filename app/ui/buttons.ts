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
 */

const PRESS = 'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55';

export const BUTTON_PRIMARY = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent shadow-[0_8px_18px_-10px_rgba(38,36,31,0.7)] hover:bg-accent-strong ${PRESS}`;

export const BUTTON_SECONDARY = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 text-[15px] font-semibold text-foreground hover:border-border-strong ${PRESS}`;

export const BUTTON_TERTIARY = `inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-foreground underline decoration-[color-mix(in_srgb,var(--foreground)_25%,transparent)] decoration-2 underline-offset-[6px] hover:decoration-foreground active:opacity-70 disabled:opacity-55`;

/** 작은 자리의 주 · 보조 — 줄 끝 · 카드 머리처럼 48px 이 무거운 곳. 누를 자리는 44px 그대로다 */
export const BUTTON_PRIMARY_SMALL = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-strong ${PRESS}`;
export const BUTTON_SECONDARY_SMALL = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-foreground hover:border-border-strong ${PRESS}`;

/** 되돌릴 수 없는 누름(탈퇴 · 차단 · 삭제) — 주 단추의 모양에 위험 색 */
export const BUTTON_DANGER = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-danger px-5 text-[15px] font-semibold text-surface hover:opacity-90 ${PRESS}`;

/** 동그란 아이콘 단추 44px — 안에 `<Icon>` 하나. 이름은 `aria-label` 이 든다 */
export const ICON_BUTTON = `relative grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-surface text-foreground ring-1 ring-border hover:ring-border-strong active:scale-95`;

/**
 * 오행 판(`tone-*`) 안의 보조 — 반투명 흰 면이 판의 색을 조금 비치고, 글자는 그 오행의 진한 색이다.
 * `ELEMENT_TONE[x].scope` 를 단 판 안에서만 뜻이 선다.
 */
export const BUTTON_ON_TILE = `inline-flex min-h-11 items-center justify-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--surface)_78%,transparent)] px-3 text-[13px] font-semibold text-[var(--ink)] ring-1 ring-[color-mix(in_srgb,var(--ink)_18%,transparent)] hover:bg-surface active:scale-[0.96]`;

/** 오행 판 안의 주 — 아직 없는 것을 받을 때만. 한 판에 하나 */
export const BUTTON_ON_TILE_PRIMARY = `inline-flex min-h-11 items-center justify-center gap-1 rounded-full bg-accent px-3 text-[13px] font-semibold text-on-accent hover:bg-accent-strong active:scale-[0.96]`;
