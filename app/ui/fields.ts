/**
 * **입력 칸 한 벌 — 밑줄 에디토리얼**(폼 디자인 A, 2026-10-03).
 *
 * 칸은 상자가 아니라 **밑줄 한 줄**이다. 이름표는 칸 위의 작은 글자, 값은 그 아래 크게 선다. 묶음은 판의 테두리가
 * 아니라 여백으로 나뉜다. 그래서 칸마다 같은 좌우 · 위아래 여백의 회색 상자가 서던 자리에서, 좌우 여백은 0 이고
 * (값이 이름표와 같은 왼쪽 선에 선다) 위아래는 이름표 → 값 4px · 값 → 밑줄 6px · 칸 → 다음 칸 28~32px 로 따로 간다.
 *
 * - 밑줄: 1px `--field-rule`. 초점 · 펼침은 먹색 2px(`shadow-rule-active`) — 그림자라 두꺼워져도 칸이 안 밀린다
 * - 이름표: 12px · 굵게 · 자간 0.08em · 흐린 글자. 칸 안에 초점이 들면 먹색이 된다(`group` 을 단 칸 묶음 안에서)
 * - 오류: 밑줄과 글자가 위험 색 2px
 * - 비활성: 40% 로 흐려진다
 *
 * 생년월일 폼(`app/birth-form.tsx`)과 곁 폼(가입 · 프로필 · 설문 · 메모)이 같은 상수를 부른다.
 */

/** 칸 위 이름표 — 칸 묶음(`group`) 안에 초점이 들면 먹색이 된다 */
export const FIELD_LABEL =
  'block text-[12px] font-semibold leading-4 tracking-[0.08em] text-muted transition-colors group-focus-within:text-foreground';

/** 한 줄 글자 칸 — 48px · 좌우 여백 0 · 값 17px */
const LINE =
  'block h-12 w-full min-w-0 rounded-none bg-transparent px-0 pb-1 pt-1.5 font-medium text-foreground shadow-rule outline-none placeholder:font-normal placeholder:text-muted focus:shadow-rule-active aria-invalid:text-danger aria-invalid:shadow-rule-danger disabled:cursor-not-allowed disabled:opacity-40';

export const FIELD_LINE = `${LINE} text-[17px]`;

/** 큰 값의 한 줄 칸 — 생년월일 폼의 이름처럼 값이 주인공인 칸. 19px */
export const FIELD_LINE_LARGE = `${LINE} text-[19px]`;

/**
 * 여러 줄 칸 — **줄 친 종이.** 밑줄 하나만 두면 몇 줄짜리 칸인지가 안 보여 빈 자리로 읽혔다. 28px 마다 옅은 줄
 * (`--border`)을 긋고 글자의 줄 간격도 28px 로 맞춰 글자가 줄 위에 앉는다(`bg-local` — 넘쳐 스크롤해도 줄이 따라온다).
 * 맨 아랫줄은 다른 칸과 같은 밑줄이고, 초점에 먹색 2px 이 된다. 크기는 손으로 안 바꾼다(줄이 어긋난다).
 */
export const FIELD_AREA =
  'block w-full min-w-0 resize-none rounded-none bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_27px,var(--border)_27px,var(--border)_28px)] bg-local px-0 py-0 text-[16px] leading-7 text-foreground shadow-rule outline-none placeholder:text-muted focus:shadow-rule-active disabled:opacity-40';

/** 제출을 못 한 까닭 — 단추 곁 한 줄. 아이콘(경고)과 글자가 함께 말한다(색만으로 가르지 않는다) */
export const FORM_ALERT = 'flex items-center gap-1.5 text-[14px] font-medium leading-5 text-danger';

/** 칸 아래 도움말 한 줄 */
export const FIELD_NOTE = 'text-[13px] leading-5 text-muted';

/**
 * 폼의 제출 단추 — 앱의 주 단추(`BUTTON_PRIMARY`)와 같은 먹색이지만 **한 단 높고(56px) 모서리가 덜 둥글다.**
 * 밑줄뿐인 폼에서 단추만 알약으로 서면 지면 위에 떠 보였다 — 칸들의 곧은 선과 같은 말투로 맞춘다.
 */
export const FORM_SUBMIT =
  'inline-flex min-h-14 items-center justify-center gap-2.5 rounded-2xl bg-accent px-7 text-[16px] font-semibold tracking-[-0.01em] text-on-accent shadow-lift hover:bg-accent-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55';

/**
 * 조용한 탭 하나 — 고르는 칸이 펼친 항목 · 「저장한 사람 / 직접 입력」 · 사이 고르기.
 * 고른 것은 먹색 굵은 글자에 2px 밑줄, 안 고른 것은 흐린 글자다 — 색만으로 가르지 않는다(굵기와 밑줄).
 */
export const QUIET_TAB =
  'inline-flex min-h-11 cursor-pointer items-center gap-1 px-2 text-[15px] text-secondary decoration-2 underline-offset-[7px] hover:text-foreground';
export const QUIET_TAB_ON = 'font-semibold text-foreground underline decoration-foreground';
