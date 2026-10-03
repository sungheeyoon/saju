/**
 * **입력 폼의 한 벌** — iOS 의 inset grouped 목록을 제대로 옮긴다(폼 디자인 G).
 *
 * 앞의 폼은 설정 목록을 흉내 냈지만 값이 근거 없이 섰다 — 줄 48px · 이름표 15px · 선은 1px 10% · 숫자 칸마다 같은 둥근
 * 회색 상자 · 고르는 줄마다 아래 꺾쇠. 여기 값은 모두 **까닭이 있는 수**다.
 *
 * - **줄 44px** = 글자 한 줄 22px(17px 본문) + 위아래 11px. 숫자 캡슐이 서는 줄은 캡슐 36px + 위아래 4px 로 같은 44px 이다.
 * - **왼쪽 들임 16px.** 이름표가 시작하는 자리가 곧 줄 사이 선이 시작하는 자리다 — 선이 칸 끝(오른쪽)까지 닿고 왼쪽만 비운다.
 *   펼친 보기는 한 단 더 들여(32px) 어느 줄의 보기인지 선의 시작점이 말한다.
 * - **선은 0.5px 헤어라인**(`border-t-[0.5px]`) — 2배 화면에서 한 물리 픽셀이다. 옅으면 안 보여 한 단 짙은 색을 쓴다.
 * - **묶음 모서리 10px · 단추 12px.** 판(28px) 안에 16px 들여 서므로 28 − 16 = 12 에 가깝게 — 같은 중심의 모서리다.
 * - **묶음 사이 32px · 묶음과 꼬리말 사이 8px**(앱의 간격 단 4 · 8 · 12 · 16 · 24 · 32 · 48 가운데 iOS 의 35pt · 7pt 에 가장 가까운 단).
 * - **이름표 17px 보통 굵기 · 값 17px 회색 · 꼬리말 13px 회색.** 글자 크기 셋만 쓴다(Dynamic Type 의 body · subheadline · footnote).
 * - **편집 중은 물빛(`--form-tint`)**: 펼친 줄의 값 · 고른 보기의 체크 · 적고 있는 숫자 칸. 먹색은 「누르라」(제출 단추)에만 남는다.
 *
 * 그림자와 테두리를 칸에 두르지 않는다 — 칸은 바탕(`--form-canvas`)보다 한 단 밝은 면만으로 선다.
 */

/** 폼이 서는 판 — 회원 화면의 카드 자리. 바탕이 칸보다 한 단 깊어야 흰 칸 묶음이 묶음으로 읽힌다 */
export const FORM_SHEET = 'rounded-[1.75rem] border border-border bg-form-canvas px-4 py-5 shadow-card sm:p-6';

/** 칸 묶음 — 모서리 10px, 밝은 면 한 장. 안의 줄이 선을 긋는다 */
export const FORM_GROUP = 'overflow-hidden rounded-[10px] bg-form-cell';

/** 줄 사이 헤어라인 — 이름표 시작점(16px)에서 칸 끝까지. 묶음의 첫 줄은 긋지 않는다 */
const SEPARATOR =
  'before:pointer-events-none before:absolute before:left-4 before:right-0 before:top-0 before:border-t-[0.5px] before:border-form-separator first:before:hidden';

/**
 * 줄 하나 — 44px, 왼쪽 이름표 · 오른쪽 값. 누르면(손) 회색이 잠깐 서고, 키보드 초점은 물빛 면이 선다 — 묶음이
 * `overflow-hidden` 이라 바깥 테두리(전역 `outline`)는 잘린다.
 */
const ROW_SHELL = `relative flex min-h-11 w-full items-center gap-3 px-4 text-left outline-none ${SEPARATOR} focus-visible:bg-form-tint-wash`;
export const FORM_ROW = `${ROW_SHELL} py-[11px]`;

/** 숫자 캡슐이 서는 줄 — 캡슐 36 + 위아래 4 = 44. 좁으면 캡슐이 이름표 아래로 꺾인다 */
export const FORM_ROW_CAPSULE = `${ROW_SHELL} flex-wrap gap-y-1 py-1`;

/** 펼친 보기 줄 — 한 단 더 들여(32px) 선도 그 자리에서 시작한다. 펼친 묶음의 첫 보기에도 선이 선다 */
export const FORM_OPTION_ROW =
  'relative flex min-h-11 cursor-pointer items-center gap-3 py-[11px] pl-8 pr-4 before:pointer-events-none before:absolute before:left-8 before:right-0 before:top-0 before:border-t-[0.5px] before:border-form-separator active:bg-form-pressed has-[:focus-visible]:bg-form-tint-wash';

/**
 * 글자를 적는 줄(이름) — 적는 동안 줄 전체에 물빛 면이 선다. 숫자 캡슐은 그 칸만 물들므로 줄에는 안 단다(두 겹이 된다).
 */
export const FORM_ROW_TEXT = `${ROW_SHELL} py-[11px] has-[:focus]:bg-form-tint-wash`;

/** 이름표 — 본문 17/22 */
export const FORM_LABEL = 'shrink-0 text-[17px] leading-[22px] text-foreground';

/** 값 — 같은 크기의 회색. 펼쳐 고치는 동안은 `FORM_VALUE_ACTIVE` */
export const FORM_VALUE = 'min-w-0 flex-1 truncate text-right text-[17px] leading-[22px] text-secondary';
export const FORM_VALUE_ACTIVE = 'min-w-0 flex-1 truncate text-right text-[17px] leading-[22px] text-form-tint';

/** 이름표 아래 작은 줄 — 「24시간」 · 보기의 풀이 */
export const FORM_SUBTITLE = 'block text-[13px] leading-[18px] text-secondary';

/** 묶음 위 머리말 — 13px 회색, 줄의 이름표와 같은 16px 에서 시작 */
export const FORM_HEADER = 'block px-4 pb-2 text-[13px] leading-[18px] text-secondary';

/** 묶음 아래 꼬리말 — 머리말과 같은 단, 위로 8px */
export const FORM_FOOTER = 'px-4 pt-2 text-[13px] leading-[18px]';

/**
 * 숫자 캡슐 — 년 · 월 · 일, 시 · 분을 **한 알약**에 담는다(iOS 의 compact 날짜 고르개). 칸마다 따로 선 회색 상자 다섯이
 * 아니라 「1990년 5월 15일」이 한 덩이로 읽힌다. 높이 36px, 모서리 8px, 안쪽 2px.
 */
export const FORM_CAPSULE = 'inline-flex h-9 items-center rounded-[8px] bg-form-fill p-0.5';

/**
 * 캡슐 안 숫자 한 칸 — 테두리 없이 글자만 선다. 적는 동안은 그 칸만 밝은 면으로 떠오르고(세그먼트의 고른 칸과 같은 말)
 * 글자가 물빛이다. 모서리 6px = 캡슐 8 − 안쪽 2.
 *
 * **폭은 글자만큼이다**(`field-sizing: content`) — 「5」월에 「12」의 자리를 비워 두면 캡슐 안에 구멍이 선다. 그 속성을
 * 모르는 브라우저에서는 부르는 쪽이 준 고정 폭이 선다(`supports-[field-sizing:content]:w-auto`).
 *
 * 범위 밖이면 `aria-invalid` 로 위험색 — 클래스를 덧붙이지 않고 변종 셀렉터로 무게를 한 겹 올린다.
 */
export const FORM_DIGIT =
  'field-sizing-content h-8 rounded-[6px] bg-transparent px-1 text-center text-[17px] tabular-nums text-foreground caret-form-tint outline-none placeholder:text-[15px] placeholder:text-[color-mix(in_srgb,var(--text-muted)_70%,transparent)] focus:bg-form-cell focus:text-form-tint focus:shadow-[0_1px_3px_color-mix(in_srgb,var(--foreground)_14%,transparent)] disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:bg-danger-wash aria-invalid:text-danger';

/** 캡슐 안 단위 글자 — 「년」 「월」 「시」. 숫자보다 한 단 작고 회색이다 */
export const FORM_UNIT = 'pr-1.5 text-[15px] text-secondary';

/**
 * 따로 선 적는 칸(가입 · 프로필 · 설문) — 머리말이 위에 서는 한 줄짜리 묶음. 높이 44px, 왼쪽 16px, 17px 글자.
 * 초점은 테두리 대신 물빛 고리 하나(칸은 테가 없는 면이라 고리가 곧 칸의 가장자리다).
 */
export const FORM_FIELD =
  'min-h-11 rounded-[10px] bg-form-cell px-4 text-[17px] leading-[22px] text-foreground caret-form-tint outline-none placeholder:text-muted focus:ring-2 focus:ring-form-tint';

/** 칸 곁의 작은 단추(「중복 확인」) — 칸과 같은 높이 · 모서리의 밝은 면에 물빛 글자. 테가 없다(iOS 의 글자 단추) */
export const FORM_INLINE_BUTTON =
  'inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] bg-form-cell px-4 text-[15px] font-semibold text-form-tint outline-none hover:bg-form-pressed focus-visible:ring-2 focus-visible:ring-form-tint active:opacity-70 disabled:pointer-events-none disabled:text-muted';

/**
 * 고르는 줄의 묶음(설문 · 가입 확인) — 줄마다 헤어라인, 고른 줄은 오른쪽 체크 대신 왼쪽 동그라미가 물빛으로 찬다.
 * 브라우저의 라디오 · 확인 상자를 그대로 쓴다(낭독기 · 키보드가 이미 안다). 묶음은 `FORM_GROUP`.
 */
export const FORM_CHOICE_ROW = `relative flex min-h-11 cursor-pointer items-center gap-3 px-4 py-[11px] text-[17px] leading-[22px] ${SEPARATOR} active:bg-form-pressed has-[:focus-visible]:bg-form-tint-wash`;

/** 고르는 줄의 동그라미 · 상자 — 22px, 물빛 */
export const FORM_CHOICE_MARK = 'size-[22px] shrink-0 accent-[var(--form-tint)] outline-none';

/**
 * 제출 — iOS 의 큰 채움 단추. 높이 50px, 모서리 12px, 17px 굵게. 눌리면 줄지 않고 흐려진다(iOS 의 누름). 먹색은 앱의 주 단추와
 * 같은 색이라 「무엇을 누르면 끝나는가」는 그대로다 — 모양만 폼의 모서리를 따른다.
 */
export const FORM_SUBMIT =
  'inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[12px] bg-accent px-6 text-[17px] font-semibold text-on-accent hover:bg-accent-strong active:opacity-70 disabled:pointer-events-none disabled:opacity-40';

/**
 * 두 갈래 고르개(세그먼트) — 트랙 안쪽 2px, 고른 쪽은 밝은 칸이 떠 선다(모서리 10 − 2 = 8). 높이는 누를 자리 44px 를
 * 지킨다 — iOS 의 32pt 보다 크지만 손가락 아래에서 앱의 다른 단추와 같다.
 */
export const FORM_SEGMENTS = 'grid h-11 grid-cols-2 gap-0.5 rounded-[10px] bg-form-fill p-0.5';
export const FORM_SEGMENT =
  'rounded-[8px] px-3 text-[15px] font-medium text-secondary outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-form-tint disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:bg-form-cell aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-[0_3px_8px_color-mix(in_srgb,var(--foreground)_12%,transparent),0_3px_1px_color-mix(in_srgb,var(--foreground)_4%,transparent)]';
