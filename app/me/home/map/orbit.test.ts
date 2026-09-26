import { describe, expect, it } from 'vitest';

import { ELEMENT_ANGLE } from '../../../ui/orbit';
import { curve, curveAway, phaseOf, pointAt, RADIUS, seatAngles, stepsAlong } from './orbit';

const twoPlaces = (value: number) => Number(value.toFixed(2)) === value;
/** 원 위의 두 각 사이 — 짧은 쪽 */
const apart = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

describe('관계 지도의 자리', () => {
  it('혼자 선 사람은 제 일간 오행의 방향에 앉는다', () => {
    expect(seatAngles([{ id: 'p1', element: '火' }])).toEqual({ p1: ELEMENT_ANGLE.火 });
  });

  it('같은 오행의 이웃은 30° 이상 벌어지고, 가운데는 제 오행의 방향이다', () => {
    const seats = seatAngles([
      { id: 'p1', element: '木' },
      { id: 'p2', element: '木' },
    ]);
    expect(apart(seats.p1, seats.p2)).toBeGreaterThanOrEqual(29.9);
    expect(apart((seats.p1 + seats.p2) / 2, ELEMENT_ANGLE.木)).toBeLessThan(0.5);
  });

  it('사람이 많아 30° 가 안 나오면 고르게 나누고, 누구도 겹치지 않는다', () => {
    const people = Array.from({ length: 16 }, (_, index) => ({ id: `p${index}`, element: index % 3 === 0 ? null : ('水' as const) }));
    const angles = Object.values(seatAngles(people)).sort((a, b) => a - b);
    expect(angles).toHaveLength(16);
    for (let i = 0; i < angles.length; i += 1) {
      expect(apart(angles[i], angles[(i + 1) % angles.length])).toBeGreaterThanOrEqual(360 / 16 - 0.1);
    }
  });

  it('같은 사람들이면 차례를 바꿔도 같은 자리다 — 서버와 브라우저가 같은 그림을 낸다', () => {
    const people = [
      { id: 'a', element: '土' as const },
      { id: 'b', element: '土' as const },
      { id: 'c', element: null },
    ];
    expect(seatAngles([...people].reverse())).toEqual(seatAngles(people));
  });

  it('좌표 · 곡선 · 건너가는 점은 소수 둘째 자리까지다', () => {
    const from = pointAt(ELEMENT_ANGLE.金, RADIUS);
    const to = pointAt(ELEMENT_ANGLE.水, RADIUS);
    const numbers = [
      from.x,
      from.y,
      ...stepsAlong(from, { x: 50, y: 50 }, 8, 12, 3).flatMap((step) => [step.x, step.y]),
      ...`${curve(from, { x: 50, y: 50 }, 8, 12, 3)} ${curveAway(from, to, 8, 7)}`.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [NaN],
      phaseOf(3),
    ];
    expect(numbers.every(twoPlaces)).toBe(true);
  });
});
