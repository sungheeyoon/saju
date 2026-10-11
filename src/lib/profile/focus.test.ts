import { describe, expect, it } from 'vitest';

import {
  FOCUS_CENTER,
  draggedFocus,
  focusOf,
  focusPosition,
  focusesOf,
  leadFocusOf,
  steppedFocus,
} from './focus';

describe('사진의 보일 자리 (G-98)', () => {
  it('0..100 의 정수로 자르고, 수가 아니면 가운데다', () => {
    expect(focusOf(12.6, -4)).toEqual({ x: 13, y: 0 });
    expect(focusOf(140, Number.NaN)).toEqual({ x: 100, y: 50 });
    expect(focusOf(null, undefined)).toEqual(FOCUS_CENTER);
  });

  it('읽는 문의 `[x1, y1, x2, y2, …]` 를 장마다 하나로 — 모자라거나 없으면(옛 DB) 그 장은 가운데', () => {
    expect(focusesOf([20, 80, 0, 100], 2)).toEqual([
      { x: 20, y: 80 },
      { x: 0, y: 100 },
    ]);
    expect(focusesOf([20, 80], 3)).toEqual([{ x: 20, y: 80 }, FOCUS_CENTER, FOCUS_CENTER]);
    expect(focusesOf(undefined, 1)).toEqual([FOCUS_CENTER]);
    expect(focusesOf([], 0)).toEqual([]);
    expect(leadFocusOf([10, 90, 0, 0])).toEqual({ x: 10, y: 90 });
    expect(leadFocusOf(null)).toEqual(FOCUS_CENTER);
  });

  it('CSS 값은 `x% y%` — 모르면 가운데', () => {
    expect(focusPosition({ x: 40, y: 30 })).toBe('40% 30%');
    expect(focusPosition(undefined)).toBe('50% 50%');
  });

  it('화살표는 사진을 미는 쪽이다 — 끌기와 같다', () => {
    expect(steppedFocus(FOCUS_CENTER, 'ArrowRight')).toEqual({ x: 45, y: 50 });
    expect(steppedFocus(FOCUS_CENTER, 'ArrowLeft')).toEqual({ x: 55, y: 50 });
    expect(steppedFocus(FOCUS_CENTER, 'ArrowDown')).toEqual({ x: 50, y: 45 });
    expect(steppedFocus(FOCUS_CENTER, 'ArrowUp')).toEqual({ x: 50, y: 55 });
    expect(steppedFocus({ x: 0, y: 100 }, 'ArrowRight')).toEqual({ x: 0, y: 100 });
    expect(steppedFocus(FOCUS_CENTER, 'Enter')).toBeNull();
  });

  it('끌면 넘친 길이만큼의 비율로 옮고, 안 넘치는 축은 그대로다', () => {
    /* 정사각 틀 100 에 세로 사진 100×200 — 세로로 100 넘친다 */
    const frame = { width: 100, height: 100 };
    const tall = { width: 100, height: 200 };
    /* 사진을 위로 50 밀면 아래쪽이 보인다 — 50% → 100% */
    expect(draggedFocus(FOCUS_CENTER, 30, -50, frame, tall)).toEqual({ x: 50, y: 100 });
    /* 아래로 25 밀면 25% */
    expect(draggedFocus(FOCUS_CENTER, 0, 25, frame, tall)).toEqual({ x: 50, y: 25 });
    /* 그림을 아직 모르면 그대로 */
    expect(draggedFocus({ x: 10, y: 20 }, 40, 40, frame, { width: 0, height: 0 })).toEqual({ x: 10, y: 20 });
  });
});
