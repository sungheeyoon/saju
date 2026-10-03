/**
 * **입력 칸 한 벌 — 밑줄 칸**(폼 디자인 시안 E, 2026-10-03).
 *
 * 묻는 칸은 모양이 하나다: **위에 작은 회색 이름표, 아래에 큰 값, 그 밑에 한 줄.** 칸에 면이나 테를 두르지 않는다 —
 * 칸의 경계는 밑줄 하나가 들고, 값이 화면에서 가장 큰 글자다. 위계는 색이 아니라 회색의 단과 글자 크기로 세운다
 * (이름표 13px 보조색 → 값 20px 먹색 → 자리표시 옅은 회색).
 *
 * - 초점: 밑줄이 1px 테 색에서 **2px 강조색**으로 두꺼워지고 이름표가 먹색이 된다. 칸 둘레에 테를 더 두르지 않는다
 *   (`outline-none` — 초점은 밑줄 한 겹이다, `e2e/saju.spec.ts` 「초점은 한 겹」).
 * - 오류: 밑줄이 2px 위험색, 글자도 위험색(`aria-invalid`). 빈 채로 눌렀을 때 비어 있는 칸도 같은 밑줄을 받는다(`data-missing`).
 * - 비활성: 흐려지고(40%) 밑줄은 점선이다 — 색만으로 「못 누른다」를 말하지 않는다.
 *
 * 색은 토큰이다 — `--field-line` · `--field-placeholder` 는 `app/globals.css` 가 기존 토큰에서 짓는다.
 */

/** 이름표 — 칸 위 13px. 묶음(`group`) 안에서 초점이 서면 먹색, 빈 채로 눌렀으면 위험색 */
export const FIELD_LABEL =
  'block text-[13px] font-medium leading-[1.125rem] text-secondary transition-colors group-focus-within:text-accent group-data-[missing]:text-danger group-has-[[aria-invalid=true]]:text-danger';

/** 밑줄 — 칸 아래 1px, 초점 2px 강조색, 틀림 2px 위험색. 테두리 대신 안쪽 그림자라 칸 높이가 초점에 흔들리지 않는다 */
const UNDERLINE =
  'shadow-[inset_0_-1px_0_var(--field-line)] focus:shadow-[inset_0_-2px_0_var(--accent)] aria-invalid:shadow-[inset_0_-2px_0_var(--danger)] data-[missing]:shadow-[inset_0_-2px_0_var(--danger)]';

/** 값의 글자 — 20px 굵게. 칸에서 가장 큰 글자다 */
const VALUE_TYPE = 'text-[1.25rem] font-semibold tracking-[-0.02em] text-foreground';

/** 적는 칸의 몸 — 좌우 안쪽을 제가 정하는 칸(앞에 그림이 서는 찾기 칸)이 쓴다 */
export const FIELD_INPUT_BODY = `h-12 w-full min-w-0 rounded-none bg-transparent pb-0.5 ${VALUE_TYPE} caret-accent outline-none transition-shadow placeholder:font-medium placeholder:text-[var(--field-placeholder)] aria-invalid:text-danger disabled:cursor-not-allowed disabled:opacity-40 ${UNDERLINE}`;

/** 적는 칸 — 높이 48px, 좌우 안쪽 0(이름표와 값이 같은 세로줄에 선다), 아래 2px 은 밑줄 몫 */
export const FIELD_INPUT = `${FIELD_INPUT_BODY} px-0`;

/**
 * 숫자 칸 — 년 · 월 · 일 · 시 · 분. **칸마다 제 밑줄**이고 단위는 칸 밖 오른쪽에 17px 보조색으로 선다(빈칸 채우기의 줄).
 * 숫자는 이름표와 같은 왼쪽 줄에서 시작하고 고정폭(`tabular-nums`)이라 적는 동안 자리가 안 흔들린다. 자리표시(「1~12」)는 값보다 작은 16px 이다.
 */
export const FIELD_DIGIT = `h-12 min-w-0 rounded-none bg-transparent px-0 pb-0.5 text-left ${VALUE_TYPE} tabular-nums caret-accent outline-none transition-shadow placeholder:text-base placeholder:font-medium placeholder:text-[var(--field-placeholder)] aria-invalid:text-danger disabled:cursor-not-allowed disabled:opacity-40 ${UNDERLINE}`;

/** 숫자 칸 뒤의 단위 — 「년」 · 「월」 */
export const FIELD_UNIT = 'text-[1.0625rem] font-medium text-secondary';

/**
 * 고르는 칸 — 적는 칸과 같은 몸(이름표 · 큰 값 · 밑줄)에 오른쪽 아래 꺾쇠. 칸 전체가 단추다.
 * 키보드 초점은 둘레 테가 아니라 밑줄이 2px 강조색이 되는 것으로 말한다(적는 칸과 같은 말).
 */
export const FIELD_PICK =
  'group flex w-full flex-col items-stretch pt-0 text-left outline-none disabled:cursor-not-allowed disabled:opacity-40';

export const FIELD_PICK_VALUE = `flex h-12 items-center gap-2 pb-0.5 ${VALUE_TYPE} transition-shadow shadow-[inset_0_-1px_0_var(--field-line)] group-focus-visible:shadow-[inset_0_-2px_0_var(--accent)] group-aria-expanded:shadow-[inset_0_-2px_0_var(--accent)] group-disabled:border-b group-disabled:border-dashed group-disabled:border-[var(--field-line)] group-disabled:shadow-none group-data-[missing]:shadow-[inset_0_-2px_0_var(--danger)]`;

/** 고르는 칸의 이름표 — 펼쳐 있거나 초점이면 먹색 */
export const FIELD_PICK_LABEL =
  'block text-[13px] font-medium leading-[1.125rem] text-secondary transition-colors group-focus-visible:text-accent group-aria-expanded:text-accent group-data-[missing]:text-danger';

/**
 * 펼친 고르기 — **아래에서 올라온 시트의 몸**(모서리 22px · 위 손잡이 · 뜬 그림자 · 한 줄 56px). 화면 바닥에 붙이지는
 * 않고 칸 바로 아래에 선다 — 바닥에 띄우면 막(backdrop)과 바깥 누름으로 닫기라는 동작이 새로 붙는다.
 */
export const FIELD_SHEET_LIST =
  'mt-2 rounded-[1.375rem] bg-surface-raised p-2 pt-0 shadow-float ring-1 ring-border';

/** 시트의 한 줄 — 56px, 17px. 고른 줄은 굵고 오른쪽에 먹색 원 체크 */
export const FIELD_SHEET_ROW =
  'relative flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl px-4 hover:bg-surface-sunken/70 has-[:checked]:bg-surface-sunken has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent';

/**
 * 흰 판 — 크림 종이(첫 화면 · 온보딩) 위에서 칸이 앉는 자리. 앱 바탕(크림)은 회색 바탕, 이 판은 흰 카드다.
 * 좌우 안쪽 20px(폰) · 32px(넓은 화면), 위 24 · 28px. 아래는 8 · 12px 뿐이다 — 마지막 줄(고급 설정, 56px)이 제 높이로 여백을 든다.
 */
export const FIELD_PANEL = 'rounded-[1.5rem] bg-surface-raised px-5 pb-2 pt-6 sm:px-8 sm:pb-3 sm:pt-7';

/** 칸과 칸 사이 — 28px. 이름표 18 + 칸 48 = 한 칸 66px 이라 줄 사이에 선이 없어도 한 칸씩 읽힌다 */
export const FIELD_STACK = 'flex flex-col gap-7';

/**
 * 폼의 주 단추 — **바닥에 붙는 큰 단추**. 높이 56px · 모서리 16px · 17px 굵게, 폭은 폼을 다 쓴다.
 * 앱의 알약 단추(`BUTTON_PRIMARY`)와 색은 같고(먹색) 몸만 폼의 것이다 — 한 폼에 하나다.
 * 폰에서는 `form-cta`(`globals.css`)가 화면 바닥(독이 서면 독 위)에 붙여 둔다 — 폼이 화면에 있는 동안만.
 */
export const FORM_CTA_SOLID =
  'inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 text-[1.0625rem] font-semibold tracking-[-0.01em] text-on-accent shadow-lift hover:bg-accent-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none';

/** 바닥에 붙는 주 단추 한 개 — 폼의 바로 아래 자식에 둔다(붙는 범위가 부모 전체다) */
export const FORM_CTA = `form-cta ${FORM_CTA_SOLID}`;

/** 폼의 둘째 단추 — 주 단추 옆 회색 면(취소 · 그만두기). 같은 높이 56px */
export const FORM_CTA_SECONDARY =
  'inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-surface-sunken px-5 text-[1.0625rem] font-semibold text-secondary hover:text-foreground active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40';

/** 바닥에 붙는 단추 줄 — 둘이면 1 : 2 로 나눠 주 단추(`FORM_CTA_SOLID`)가 넓다 */
export const FORM_CTA_ROW = 'form-cta grid grid-cols-[1fr_2fr] gap-2';

/**
 * 상자형 칸 — 여러 줄 글(메모 · 소개 · 설문)과 곁 폼(가입 코드 · 닉네임). 밑줄 칸은 한 줄 값의 것이라 여러 줄에는
 * 옅은 회색 면을 깐다. 높이 56px, 좌우 16px · 위아래 16px, 모서리 16px, 17px. 초점은 면 위 2px 강조색 테(안쪽).
 */
export const FIELD_BOX =
  'min-h-14 w-full rounded-2xl bg-surface-sunken px-4 py-4 text-[1.0625rem] leading-6 text-foreground outline-none transition-shadow placeholder:text-[var(--field-placeholder)] focus:bg-surface focus:shadow-[inset_0_0_0_2px_var(--accent)] aria-invalid:shadow-[inset_0_0_0_2px_var(--danger)]';

/**
 * 흰 카드 위의 폼 — 로그인 뒤의 계산기 · 사람 추가 · 수정하기. 앱 카드(`CARD`, 20 · 24px)보다 좌우를 넓게 24px(폰) · 32px,
 * 위 28px 로 연다 — 칸이 큰 글자를 들므로 카드 가장자리에서 한 단 더 물러난다. 넓은 화면에서도 폭은 42rem(첫 화면 폼과 같은
 * 한 손 너비)에서 멈춘다 — 72rem 판에 밑줄이 퍼지면 이름표와 꺾쇠가 화면 양 끝으로 갈린다.
 */
export const FORM_CARD =
  'w-full max-w-[42rem] rounded-[1.75rem] border border-border bg-surface px-6 pb-6 pt-7 shadow-card sm:px-8 sm:pb-8 sm:pt-8';
