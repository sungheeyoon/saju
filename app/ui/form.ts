/**
 * **입력 칸 한 벌 — 큼직한 채움 칸**(폼 디자인 D, 2026-10-03).
 *
 * 옛 폼은 설정 목록이었다 — 흰 묶음 안 48px 줄마다 왼쪽 이름 · 오른쪽 값 · 꺾쇠, 모든 줄이 같은 높이와 같은 안쪽 여백이라
 * 무엇을 적고 무엇을 고르는지가 모양으로 안 갈렸다. 여기서는 칸 하나가 동작 하나다.
 *
 * - **이름표는 칸 바깥 위**에 굵게(14px · 700). 칸 안은 값만 든다.
 * - **칸은 테두리 없는 채움**(`bg-field`)이고 높이 56px · 모서리 16px. 적는 칸의 안쪽 여백은 좌우 20px, 위아래는 높이가
 *   정한다(글줄 24px → 16px씩). 값은 18px 반굵게, 자리표시는 16px 보통 굵기로 한 단 작다.
 * - **초점은 채움이 걷히고** 흰 면(`bg-field-focus`) + 먹색 2px 테(`ring`)다. 테는 `box-shadow` 라 칸 크기가 안 바뀐다 —
 *   전역 초점 테(`outline`)는 `outline-none` 이 끈다(한 겹, `e2e/saju.spec.ts` 가 잰다).
 * - **틀린 칸은 위험 면 + 위험 테**(`aria-invalid` · `data-missing`). 색만으로 말하지 않는다 — 막힌 까닭은 문장이 든다.
 * - 칸 사이는 세로 24px(`FIELD_STACK`), 이름표와 칸 사이 8px, 한 칸 안에서 나란한 칸 사이 8px.
 *
 * 색은 `globals.css` 의 `--field` · `--field-hover` · `--field-focus` 셋만 새로 들였다. 나머지는 앱의 토큰 그대로다.
 */

/** 칸들의 세로 줄 — 칸과 칸 사이 24px */
export const FIELD_STACK = 'flex flex-col gap-6';

/** 한 칸(이름표 + 칸 + 도움말) */
export const FIELD_BLOCK = 'flex min-w-0 flex-col gap-2';

/** 이름표 줄 — 왼쪽 이름표, 오른쪽에 옅은 도움말이 설 수 있다 */
export const FIELD_LABEL_ROW = 'flex items-baseline justify-between gap-3 px-1';

/** 이름표 — 칸 바깥 위, 굵고 또렷하게 */
export const FIELD_LABEL = 'text-[14px] font-bold leading-5 tracking-[-0.01em] text-foreground';

/** 이름표 옆 · 칸 아래의 옅은 도움말 */
export const FIELD_HINT = 'text-[13px] font-medium leading-5 text-muted';

/** 채움 칸의 공통 면 — 높이 · 모서리 · 채움 · 초점 · 오류 · 비활성 */
const FIELD_SURFACE =
  'h-14 rounded-2xl bg-field text-foreground outline-none transition-[background-color,box-shadow] duration-150 hover:bg-field-hover focus:bg-field-focus focus:ring-2 focus:ring-accent focus:hover:bg-field-focus aria-invalid:bg-danger-wash aria-invalid:text-danger aria-invalid:ring-2 aria-invalid:ring-danger data-missing:bg-danger-wash data-missing:ring-2 data-missing:ring-danger disabled:cursor-not-allowed disabled:opacity-45';

/** 글을 적는 칸 — 왼쪽 정렬, 좌우 20px */
export const FIELD_INPUT = `${FIELD_SURFACE} w-full min-w-0 px-5 text-[18px] font-semibold placeholder:text-[16px] placeholder:font-normal placeholder:text-muted`;

/**
 * 숫자 칸 — 가운데 큰 숫자(20px · 700, 고른 폭 숫자), 단위 글자는 칸 안 오른쪽에 옅게(`FIELD_UNIT`).
 * 숫자가 단위에 밀리지 않게 왼쪽 12px · 오른쪽 32px 로 비대칭이다.
 */
export const FIELD_NUMBER = `${FIELD_SURFACE} w-full min-w-0 pl-3 pr-8 text-center text-[20px] font-bold tabular-nums tracking-[-0.01em] placeholder:text-[14px] placeholder:font-medium placeholder:text-muted`;

/** 숫자 칸 안 오른쪽의 단위(년 · 월 · 일 · 시 · 분) */
export const FIELD_UNIT =
  'pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted';

/**
 * 고르는 칸 — 칸 너비를 꽉 채우는 두세 칸 세그먼트. 바깥은 채움 칸과 같은 56px · 16px, 안쪽 4px 에 고른 것만
 * 흰 알약(48px · 12px) + 작은 그림자가 선다.
 */
export const SEGMENT =
  'grid h-14 auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-field p-1 transition-[box-shadow] data-missing:bg-danger-wash data-missing:ring-2 data-missing:ring-danger';

/** 세그먼트의 한 칸 — 안에 보이지 않는 라디오가 칸 전체를 덮는다 */
export const SEGMENT_OPTION =
  'relative flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2 text-[16px] font-semibold text-secondary transition-[background-color,color,box-shadow] duration-150 hover:text-foreground has-checked:bg-field-pick has-checked:text-foreground has-checked:shadow-soft has-focus-visible:ring-2 has-focus-visible:ring-accent has-disabled:cursor-not-allowed has-disabled:opacity-45';

/** 칸을 덮는 보이지 않는 라디오 */
export const COVER_RADIO = 'absolute inset-0 cursor-pointer appearance-none rounded-xl opacity-0 outline-none disabled:cursor-not-allowed';

/** 누르면 아래로 목록이 펼쳐지는 칸(출생지 · 시간 기준) — 채움 칸과 같은 몸, 펼치면 초점 모양이 선다 */
export const FIELD_PICKER = `${FIELD_SURFACE} flex w-full items-center gap-3 px-5 text-left aria-expanded:bg-field-focus aria-expanded:ring-2 aria-expanded:ring-accent`;

/** 펼친 목록의 판 — 떠 있는 흰 면 */
export const PICKER_PANEL = 'rounded-2xl bg-surface-raised p-1.5 shadow-float ring-1 ring-border';

/** 막힌 까닭 — 위험 면의 한 줄. 앞에 경고 그림을 단다 */
export const FIELD_ERROR =
  'flex items-start gap-2 rounded-2xl bg-danger-wash px-4 py-3 text-[14px] font-semibold leading-5 text-danger';

/** 알림(위험 아님) — 음력을 양력으로 바꾼 줄처럼 칸 아래에 서는 확인 */
export const FIELD_NOTE = 'flex items-start gap-2 rounded-2xl bg-accent-wash px-4 py-3 text-[14px] font-medium leading-5 text-foreground';

/**
 * 폼의 주 단추 — **칸과 같은 높이 · 모서리**(56px · 16px). 알약(`BUTTON_PRIMARY`)은 폼 밖의 단추다.
 * 누르면 조금 줄어들고, 잠기면 흐려진다(단추 세 층의 규율 그대로).
 */
export const FORM_SUBMIT =
  'inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent px-6 text-[17px] font-bold tracking-[-0.01em] text-on-accent shadow-lift hover:bg-accent-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45';

/** 폼의 보조 단추 — 같은 몸에 채움 면 */
export const FORM_SECONDARY =
  'inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-field px-6 text-[16px] font-semibold text-foreground hover:bg-field-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45';

/** 여러 줄 칸(메모 · 소개) — 채움 칸과 같은 면, 위아래 14px · 좌우 20px */
export const FIELD_TEXTAREA =
  'w-full min-w-0 rounded-2xl bg-field px-5 py-3.5 text-[16px] leading-6 text-foreground outline-none transition-[background-color,box-shadow] duration-150 placeholder:text-muted hover:bg-field-hover focus:bg-field-focus focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-45';

/** 찾아 고르는 칸(저장한 사람) — 채움 칸의 몸에 오른쪽 꺾쇠 자리 40px. 왼쪽 여백은 쓰는 자리가 준다(상징이 서면 넓게) */
export const FIELD_COMBO = `${FIELD_SURFACE} w-full min-w-0 pr-10 text-[17px] font-semibold placeholder:text-[16px] placeholder:font-normal placeholder:text-muted`;
