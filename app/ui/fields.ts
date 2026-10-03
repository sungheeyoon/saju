/**
 * **입력 타일 한 벌** — 칸마다 떠 있는 흰 타일이다(폼 디자인 B 「떠 있는 타일」, 2026-10-03).
 *
 * 한 판에 줄을 긋고 줄마다 같은 여백을 두던 묶음 목록(ADR 0132 의 「설정 목록」)을 버렸다. 칸 하나가 타일 하나이고, 타일
 * 사이의 틈(10px)이 리듬을 만든다. 이름표는 타일 안 위쪽에 작게 붙고(12px · 600), 비어 있고 초점이 없을 때만 타일 가운데로
 * 내려와 자리표시처럼 선다 — 그 움직임은 `globals.css` 의 `.field-head` · `.field-label` 이 든다.
 *
 * 여백은 **일부러 비대칭이다** — 좌우 18px, 위 10px(이름표) · 아래 10px(값). 값 줄이 타일 바닥에 앉고 이름표가 그 위에 붙어
 * 한 덩어리로 읽힌다. 타일 높이는 64px(테 포함 66px)로 모든 칸이 같다 — 줄마다 높이가 다르면 틈의 리듬이 깨진다.
 *
 * 초점은 타일이 받는다 — 먹색을 반쯤 비친 테 한 줄 + 바깥 번짐 한 단(`shadow-field-focus`). 안의 칸은 제 테를 안 두른다.
 * 숫자 칸만은 한 타일에 여럿이라 **어느 칸인지** 밑줄(안쪽 그림자) 한 줄로 따로 말한다.
 */

/** 타일 — 흰 면 · 옅은 테 · 얕은 그림자 · 모서리 18px. 펼침(`data-open`) · 초점 · 오류 · 비활성이 여기서 갈린다 */
export const FIELD_TILE =
  'min-w-0 rounded-[1.125rem] border border-border bg-field shadow-field transition-[border-color,box-shadow,opacity] duration-150 hover:border-border-strong focus-within:border-field-ring focus-within:shadow-field-focus data-[open]:border-field-ring data-[open]:shadow-field-focus has-[[aria-invalid=true]]:border-danger has-[[aria-invalid=true]]:shadow-[0_0_0_4px_color-mix(in_srgb,var(--danger)_12%,transparent)] has-[:disabled]:opacity-50 has-[:disabled]:shadow-none has-[:disabled]:hover:border-border';

/** 타일 안 적는 칸 — 타일을 꽉 채운다(누를 자리 64px). 값은 바닥에서 10px, 이름표 아래 4px */
export const FIELD_INPUT =
  'block h-16 w-full rounded-[1.125rem] bg-transparent px-[1.125rem] pb-2.5 pt-[1.875rem] text-[17px] font-medium leading-6 text-foreground outline-none placeholder:font-normal placeholder:text-muted';

/** 여러 줄 칸 — 이름표 자리만큼 위를 비우고, 줄은 본문 높이다 */
export const FIELD_AREA =
  'block w-full resize-y rounded-[1.125rem] bg-transparent px-[1.125rem] pb-3 pt-[1.875rem] text-[15px] leading-6 text-foreground outline-none placeholder:text-muted';

/**
 * 한 타일 안의 숫자 칸(년 · 월 · 일 · 시 · 분) — 테 없는 큰 숫자(19px · 600, 고정폭 숫자). 자리표시는 15px 보통 굵기라 적은
 * 값과 한눈에 갈린다. 초점이면 옅은 면 + 먹색 밑줄, 범위를 벗어나면 붉은 면 + 붉은 밑줄.
 */
export const FIELD_DIGIT =
  'h-11 min-w-0 rounded-[0.625rem] bg-transparent px-1.5 text-[19px] font-semibold tabular-nums tracking-[-0.01em] text-foreground outline-none placeholder:text-[15px] placeholder:font-normal placeholder:tracking-normal placeholder:text-muted focus:bg-surface-soft focus:shadow-[inset_0_-2px_0_var(--accent)] aria-invalid:bg-danger-wash aria-invalid:text-danger aria-invalid:shadow-[inset_0_-2px_0_var(--danger)] disabled:cursor-not-allowed';

/** 숫자 칸 뒤의 단위(년 · 월 · 시) — 숫자보다 한참 작고 옅게, 숫자의 바닥선에 붙는다 */
export const FIELD_UNIT = 'text-[13px] font-medium text-secondary';

/** 타일 안의 작은 딱지(「24시간」) */
export const FIELD_TAG = 'rounded-full bg-field-well px-1.5 py-px text-[11px] font-semibold text-secondary';

/** 고르는 타일의 꺾쇠 — 28px 동그란 옅은 면 안에. 펼치면 위를 본다 */
export const FIELD_CHEVRON =
  'grid size-7 shrink-0 place-items-center rounded-full bg-field-well text-secondary transition-transform duration-200';

/**
 * 펼친 고르는 타일 안의 칩 — 알약 44px. 고르면 먹색 면에 밝은 글자와 체크가 선다(색만으로 말하지 않는다).
 * 칸 전체를 덮는 라디오가 눌리고 초점을 받는다 — 초점 테는 칩이 두른다.
 */
export const FIELD_CHIP =
  'relative inline-flex min-h-11 max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-[15px] font-medium leading-5 text-foreground hover:border-border-strong active:scale-[0.97] has-checked:border-accent has-checked:bg-accent has-checked:text-on-accent has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-field-ring';

/**
 * 타일 격자 — 좁으면 한 줄에 하나, 폼 폭이 19rem 을 넘으면 둘. 틈 10px. 재는 것은 화면이 아니라 폼의 폭(`@container`)이다 —
 * 같은 폼이 첫 화면의 넓은 종이와 궁합 화면의 반쪽 카드에 함께 선다.
 */
export const FIELD_GRID = 'grid grid-cols-1 items-start gap-2.5 @min-[19rem]:grid-cols-2';

/** 격자에서 한 줄을 다 쓰는 타일 */
export const FIELD_WIDE = '@min-[19rem]:col-span-2';

/**
 * 숫자 칸 둘(시 · 분)이 반쪽에 들려면 폼이 20rem 은 돼야 한다 — 비어 있을 때의 자리표시(「0~23」 「0~59」)가 가장 넓다.
 * 그보다 좁으면 그 타일과 짝(출생지)이 한 줄씩 쓴다.
 */
export const FIELD_WIDE_UNTIL_ROOMY = '@min-[19rem]:col-span-2 @xs:col-span-1';

/**
 * 폼의 제출 단추 — 타일과 같은 모서리(18px)와 비슷한 높이(56px)로, 타일 더미의 마지막 한 장처럼 선다. 알약 주 단추
 * (`BUTTON_PRIMARY`)와 색 · 글자 · 누름은 같다.
 */
export const FIELD_SUBMIT =
  'inline-flex min-h-14 items-center justify-center gap-2 rounded-[1.125rem] bg-accent px-6 text-base font-semibold tracking-[-0.01em] text-on-accent shadow-lift hover:bg-accent-strong active:scale-[0.98] disabled:pointer-events-none disabled:bg-field-well disabled:text-secondary disabled:shadow-none';

/** 제출을 못 한 까닭 — 붉은 옅은 면의 한 덩이(아이콘 + 문장) */
export const FIELD_ERROR =
  'flex items-start gap-2 rounded-[0.875rem] bg-danger-wash px-3.5 py-2.5 text-sm font-medium leading-5 text-danger';

/** 아직 못 누르는 까닭 — 잠긴 제출 단추 곁의 안내(경고가 아니다) */
export const FIELD_HINT = 'flex items-center gap-1.5 text-[13px] leading-5 text-secondary';

/** 펼친 고르는 타일 — 폼 폭이 얼마든 한 줄을 다 쓴다(`FIELD_WIDE_UNTIL_ROOMY` 의 반쪽 되돌림까지 덮는다) */
export const FIELD_WIDE_OPEN = '@min-[19rem]:col-span-2 @xs:col-span-2';

/** 타일 곁의 단추(「중복 확인」) — 타일과 같은 높이 · 모서리의 흰 판. 누르는 것이라 그림자 대신 테가 진하다 */
export const FIELD_SIDE_BUTTON =
  'inline-flex min-h-[4.125rem] shrink-0 items-center justify-center rounded-[1.125rem] border border-border-strong bg-field px-4 text-sm font-semibold text-foreground hover:border-foreground active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55';

/** 고르는 줄(설문의 보기 · 가입의 동의) — 타일 한 장. 세로 정렬과 위아래 여백은 쓰는 자리가 붙인다. 고르면 먹색 테와 크림 면, 상자도 그대로 남는다 */
export const FIELD_CHOICE =
  'flex min-h-14 cursor-pointer gap-3 rounded-[1.125rem] border border-border bg-field px-[1.125rem] text-[15px] leading-6 shadow-field hover:border-border-strong has-checked:border-field-ring has-checked:bg-cream has-checked:shadow-none has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-field-ring';
