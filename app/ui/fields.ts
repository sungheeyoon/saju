/**
 * **입력 폼의 판 — 네오 브루탈리즘**(폼 디자인 시안 I, 2026-10-03).
 *
 * 출생 정보 폼(`app/birth-form.tsx`)과 곁 폼(가입 · 프로필 · 설문)이 같은 칸을 쓴다. 칸마다 다시 적으면 한 화면만
 * 2px 테를 잃는 날이 온다.
 *
 * - **테와 그림자**: 먹색 2px 테 · 흐림 없는 어긋난 그림자. 판은 4px, 칸 · 스티커는 4px · 2px 두 단이다.
 * - **누름이 곧 초점이다**: 초점 · 펼침 · 고름은 칸이 그림자 쪽으로 4px(스티커는 2px) 내려앉아 그림자가 사라지고,
 *   면에 그 상태의 색이 든다 — 움직임 · 색 · 두꺼워진 테(2px 링) 셋으로 말해 색만으로 가르지 않는다.
 * - **상태의 색은 오행의 납작한 면 하나씩**(`globals.css` 의 `--field-*`): 토 초점 · 누를 것, 목 고른 것, 화 오류,
 *   수 고급 설정, 금 잠긴 칸.
 * - **수치는 4의 배수**: 칸 높이 56 · 스티커 48 · 좌우 안쪽 16 · 판 안쪽 16/24 · 이름표와 칸 사이 8 · 칸 사이 20.
 * - **모서리**: 판 12px, 칸 · 스티커 · 단추 6px — 어긋난 그림자의 모서리가 둥글게 번지지 않게 작게.
 */

/** 판 한 장 — 흰 면 · 먹색 2px 테 · 4px 어긋난 그림자. 안쪽 여백 폰 16 · 넓은 화면 24 */
export const FIELD_PANEL = 'rounded-xl border-2 border-field-ink bg-field-face p-4 text-foreground shadow-field sm:p-6';

/** 이름표 — 칸 **위**에 굵게. 본문(15px)과 같은 크기라도 굵기 800 이 위계를 든다 */
export const FIELD_LABEL = 'text-[15px] font-extrabold leading-5 tracking-[-0.01em] text-foreground';

/** 이름표 옆 · 아래의 보조 — 「24시간」 · 「(선택)」 */
export const FIELD_HINT = 'text-[13px] font-semibold leading-5 text-secondary';

/**
 * 칸의 틀 — 테 · 면 · 그림자와 **내려앉는 움직임.** 초점이 칸 안 어디에 있든(`focus-within`) 틀이 내려앉는다.
 * 오류(`aria-invalid` 를 든 칸)는 분홍 면, 잠긴 칸은 회색 면 · 점선 테 · 그림자 없음.
 */
export const FIELD_FRAME =
  'rounded-md border-2 border-field-ink bg-field-face shadow-field transition-[translate,box-shadow,background-color] duration-100 ease-out ' +
  'focus-within:translate-1 focus-within:bg-field-focus focus-within:shadow-field-in focus-within:ring-2 focus-within:ring-field-ink ' +
  'has-[[aria-invalid=true]]:bg-field-error ' +
  'has-disabled:translate-0 has-disabled:border-dashed has-disabled:bg-field-off has-disabled:shadow-field-in has-disabled:ring-0';

/** 한 줄 적는 칸 — 높이 56 · 좌우 16 · 17px 굵게. 틀과 칸이 한 요소다 */
export const FIELD_INPUT =
  'h-14 w-full min-w-0 rounded-md border-2 border-field-ink bg-field-face px-4 text-[17px] font-bold text-foreground shadow-field outline-none transition-[translate,box-shadow,background-color] duration-100 ease-out ' +
  'placeholder:font-medium placeholder:text-muted ' +
  'focus:translate-1 focus:bg-field-focus focus:shadow-field-in focus:ring-2 focus:ring-field-ink ' +
  'aria-invalid:bg-field-error disabled:cursor-not-allowed disabled:border-dashed disabled:bg-field-off disabled:shadow-field-in';

/** 여러 줄 적는 칸 — 위아래 12 · 좌우 16 */
export const FIELD_TEXTAREA = FIELD_INPUT.replace('h-14 ', '').replace('text-[17px] font-bold', 'py-3 text-[15px] font-semibold leading-6');

/**
 * 고르는 스티커 — 줄 전체가 누를 자리(48). 안에 숨은 라디오 · 상자를 `absolute inset-0` 로 깔고 이 틀을 `label` 에 단다.
 * 고르면 초록 면으로 2px 내려앉는다. 키보드 초점은 먹색 점선 테가 2px 밖에 선다.
 */
export const FIELD_STICKER =
  'relative flex min-h-12 cursor-pointer select-none items-center gap-2 rounded-md border-2 border-field-ink bg-field-face px-3 py-2 text-[15px] font-bold text-foreground shadow-field-sm transition-[translate,box-shadow,background-color] duration-100 ease-out ' +
  'hover:bg-field-focus has-checked:translate-0.5 has-checked:bg-field-pick has-checked:shadow-field-in ' +
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-dashed has-focus-visible:outline-field-ink ' +
  'has-disabled:cursor-not-allowed has-disabled:border-dashed has-disabled:bg-field-off has-disabled:shadow-field-in';

/**
 * 쟁반 — 판(`FIELD_PANEL`)을 올려 두는 크림 면. 먹색 2px 테만 있고 그림자는 없다 — 판이 그 위에서 떠 보이게.
 * 궁합의 두 칸 · 사이 묻기, 사람 추가 · 수정의 둘레가 쓴다. 안쪽 여백 폰 16 · 넓은 화면 20.
 */
export const FIELD_TRAY = 'rounded-xl border-2 border-field-ink bg-cream p-4 text-foreground sm:p-5';

/** 칸 끝에 붙은 먹색 꼬리 — 단위 글자(년 · 월 · 일 · 시 · 분)가 산다 */
export const FIELD_TAB =
  'grid w-7 shrink-0 place-items-center border-l-2 border-field-ink bg-field-ink text-[13px] font-extrabold text-field-face';
