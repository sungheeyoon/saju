/**
 * 사진의 **보일 자리** — 가로 · 세로 몇 % 자리를 칸에 보이나(G-98, `20261203090000`).
 *
 * 바이트는 다시 굽지 않는다. 칸이 사진을 덮어 담을 때(`object-cover`) 넘치는 쪽의 어디를 보일지만 정한다 — CSS
 * `object-position` 의 두 값 그대로다. 그래서 칸의 비율(프로필 대표 칸 · 인연 카드 · 둥근 얼굴)이 달라도 같은 두 수가
 * 같은 쪽을 보인다. 확대는 없다(위치만).
 *
 * 모든 사진 자리가 이 한 벌을 쓴다 — 주소를 짓는 자리처럼 따로 적으면 칸마다 다른 쪽을 보인다.
 */
export type PhotoFocus = { readonly x: number; readonly y: number };

/** 정하지 않은 장 · 있던 장 — 가운데. DB 의 기본값(50 · 50)과 같은 수 */
export const FOCUS_CENTER: PhotoFocus = { x: 50, y: 50 };

/** 화살표 한 번에 움직이는 % */
export const FOCUS_STEP = 5;

const clamp = (value: number): number => Math.min(100, Math.max(0, Math.round(value)));

/** 0..100 의 정수로 — 칸 밖 · 수 아닌 값은 가운데의 그 축 */
export function focusOf(x: unknown, y: unknown): PhotoFocus {
  return {
    x: typeof x === 'number' && Number.isFinite(x) ? clamp(x) : FOCUS_CENTER.x,
    y: typeof y === 'number' && Number.isFinite(y) ? clamp(y) : FOCUS_CENTER.y,
  };
}

/**
 * 읽는 문이 내는 모양 `[x1, y1, x2, y2, …]`(자리 순서) → 장마다 하나. 없거나(옛 DB) 모자라면 그 장은 가운데다 —
 * `count` 장을 늘 채워 돌려준다.
 */
export function focusesOf(flat: readonly number[] | null | undefined, count: number): PhotoFocus[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) =>
    flat !== null && flat !== undefined && flat.length >= index * 2 + 2
      ? focusOf(flat[index * 2], flat[index * 2 + 1])
      : FOCUS_CENTER,
  );
}

/** 대표 사진(1번)의 자리 — 아바타처럼 한 장만 그리는 자리 */
export const leadFocusOf = (flat: readonly number[] | null | undefined): PhotoFocus => focusesOf(flat, 1)[0];

/** CSS `object-position` · `background-position` 의 값 */
export const focusPosition = (focus: PhotoFocus | null | undefined): string => {
  const { x, y } = focus ?? FOCUS_CENTER;
  return `${x}% ${y}%`;
};

export const sameFocus = (a: PhotoFocus, b: PhotoFocus): boolean => a.x === b.x && a.y === b.y;

/** 화살표 키 하나 — 그 쪽으로 `FOCUS_STEP` 만큼. 화살표가 아니면 `null` */
export function steppedFocus(focus: PhotoFocus, key: string): PhotoFocus | null {
  /*
    화살표는 **사진을 미는 쪽**이다 — 끌기와 같다. → 는 사진을 오른쪽으로 밀어 왼쪽 부분을 보인다(x 가 준다).
  */
  switch (key) {
    case 'ArrowLeft':
      return focusOf(focus.x + FOCUS_STEP, focus.y);
    case 'ArrowRight':
      return focusOf(focus.x - FOCUS_STEP, focus.y);
    case 'ArrowUp':
      return focusOf(focus.x, focus.y + FOCUS_STEP);
    case 'ArrowDown':
      return focusOf(focus.x, focus.y - FOCUS_STEP);
    default:
      return null;
  }
}

/**
 * 끌어 옮긴 뒤의 자리 — 사진을 `dx` · `dy` 픽셀 밀었을 때.
 *
 * 덮어 담은 사진은 칸보다 `overflow` 만큼 넘친다(축마다). `object-position` 의 p% 는 넘친 길이의 p% 를 왼쪽(위)으로 보낸
 * 자리다 — 그래서 사진을 오른쪽으로 `dx` 밀면 p 가 `dx / overflow × 100` 만큼 준다. 넘치지 않는 축은 어느 값이어도
 * 같은 모양이라 그대로 둔다.
 */
export function draggedFocus(
  start: PhotoFocus,
  dx: number,
  dy: number,
  frame: { width: number; height: number },
  image: { width: number; height: number },
): PhotoFocus {
  if (image.width <= 0 || image.height <= 0 || frame.width <= 0 || frame.height <= 0) return start;
  const scale = Math.max(frame.width / image.width, frame.height / image.height);
  const overflowX = image.width * scale - frame.width;
  const overflowY = image.height * scale - frame.height;
  return focusOf(
    overflowX > 0.5 ? start.x - (dx / overflowX) * 100 : start.x,
    overflowY > 0.5 ? start.y - (dy / overflowY) * 100 : start.y,
  );
}
