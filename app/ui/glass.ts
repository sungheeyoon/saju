/**
 * **입력 폼의 유리** — 밤하늘(`FORM_SKY`) 위에 반투명 판이 뜨고, 칸은 판 안의 더 옅은 유리다(폼 디자인 시안 H, 2026-10-03).
 *
 * 모양은 `app/globals.css` 의 「입력 폼의 유리」 절이 들고(`@layer components` — 유틸리티가 덧쓸 수 있다), 여기는 그 이름을
 * 화면에 건넨다. 생년월일시 폼(`app/birth-form.tsx`)이 하늘 · 판 · 칸을 다 쓰고, 곁 폼(가입 · 프로필 · 설문)은 하늘 없이
 * 적는 칸(`GLASS_INPUT`)만 쓴다.
 *
 * 하늘의 빛은 오행의 속(`--wood-mid` …)이다 — 새 색을 짓지 않는다. 유리를 걷어 달라는 기기(`prefers-reduced-transparency`)
 * 에서는 단단한 면으로 서고, 별의 반짝임은 움직임을 줄인 기기에서 멈춘다.
 */

/** 하늘 — 폼 한 벌을 감싸는 판 뒤의 빛 · 별 · 궤도. 한 폼에 하나 */
export const FORM_SKY = 'form-sky';

/** 유리 판 — 칸이 두 열 격자로 선다. 짧은 칸 둘(이름 · 성별)은 한 줄에, 나머지는 한 줄 전체 */
export const GLASS_PANEL = 'glass-panel';

/** 판 안의 칸 한 개 — 이름표 위 · 값 아래. 위 10 · 아래 12 · 좌우 18px */
export const GLASS_FIELD = 'glass-field';

/** 칸의 이름표 — 12px, 넓은 자간(0.16em) */
export const GLASS_LABEL = 'glass-label';

/** 칸의 값 — 17px */
export const GLASS_VALUE = 'glass-value';

/** 숫자 칸 — 26px 가는 숫자, 아래 금 한 줄 */
export const GLASS_DIGIT = 'glass-digit';

/** 숫자 뒤 단위 — 「년」 「월」 「시」 */
export const GLASS_UNIT = 'glass-unit';

/** 빛나는 알약 — 폼의 제출 단추. 먹색 면은 주 단추(`BUTTON_PRIMARY`)와 같고, 물빛이 테와 그림자로 번진다 */
export const GLOW_PILL = 'glow-pill';

/** 거절의 말 — 제출이 막힌 까닭 한 줄 */
export const GLASS_ALERT = 'glass-alert';

/** 곁 폼의 적는 칸 */
export const GLASS_INPUT = 'glass-input';

/** 곁 폼의 이름표 */
export const GLASS_INPUT_LABEL = 'glass-input-label';
