/*
  **단추 세 층** — 모양만 봐도 눌리는 것임을 안다. 1차 시안들은 테두리 알약 하나에 호버만 달려 있었다.

  - 주(채움): 먹색 알약. 파스텔 타일 위 어디에 놓여도 가장 먼저 보이도록 오행 색을 안 입는다. 한 영역에 하나.
  - 보조(옅은 채움): 흰 알약 + 가는 테. 파스텔 위에서는 반투명 흰색이 타일 색을 살짝 비친다.
  - 셋째(글자): 밑줄 + 화살표. 누를 자리는 글자보다 넓게 44px.
  누르면 3% 줄어든다(`active:scale`) — 손가락 아래에서 「눌렸다」를 말하는 유일한 신호라 빼지 않는다.
*/

const FOCUS =
  'focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--btn)_45%,transparent)]';

export const PRIMARY = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--btn)] px-5 text-[15px] font-semibold text-[var(--on-btn)] shadow-[0_8px_18px_-10px_rgba(38,36,31,0.7)] hover:bg-[var(--btn-press)] active:scale-[0.97] ${FOCUS}`;

export const SECONDARY = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-[var(--card)] px-5 text-[15px] font-semibold text-foreground hover:border-[color-mix(in_srgb,var(--foreground)_35%,transparent)] active:scale-[0.97] ${FOCUS}`;

/** 파스텔 타일 안의 보조 — 흰 면이 타일 색을 조금 비친다 */
export const ON_TILE = `inline-flex min-h-11 items-center justify-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--card)_78%,transparent)] px-2 text-[13px] font-semibold text-[var(--ink)] ring-1 ring-[color-mix(in_srgb,var(--ink)_18%,transparent)] hover:bg-[var(--card)] active:scale-[0.96] ${FOCUS}`;

/** 파스텔 타일 안의 주 — 아직 없는 풀이를 받을 때만 */
export const ON_TILE_PRIMARY = `inline-flex min-h-11 items-center justify-center gap-1 rounded-full bg-[var(--btn)] px-2 text-[13px] font-semibold text-[var(--on-btn)] hover:bg-[var(--btn-press)] active:scale-[0.96] ${FOCUS}`;

export const TERTIARY = `inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-foreground underline decoration-[color-mix(in_srgb,var(--foreground)_25%,transparent)] decoration-2 underline-offset-[6px] hover:decoration-foreground active:opacity-70 ${FOCUS}`;

/** 동그란 아이콘 단추 — 종 · 톱니 */
export const ROUND_ICON = `relative grid size-11 cursor-pointer place-items-center rounded-full bg-[var(--card)] text-foreground ring-1 ring-[var(--line)] hover:ring-[color-mix(in_srgb,var(--foreground)_30%,transparent)] active:scale-95 ${FOCUS}`;
