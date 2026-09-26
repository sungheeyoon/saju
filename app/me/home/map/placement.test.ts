import { describe, expect, it } from 'vitest';

import { placeOnOrbit, threadBetween, threadTo, type Point } from './placement';

const twoPlaces = (value: number) => Number(value.toFixed(2)) === value;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

describe('관계 지도의 실', () => {
  const people = Array.from({ length: 10 }, (_, index) => ({ id: `p${index}` }));
  const { at } = placeOnOrbit(people, []);

  it('나 → 그 사람의 실은 점 일곱이 나에게서 멀어질수록 커지고 두 원에 닿지 않는다', () => {
    for (const point of Object.values(at)) {
      const beads = threadTo(point);
      expect(beads).toHaveLength(7);
      expect(beads.map((bead) => bead.r)).toEqual([...beads.map((bead) => bead.r)].sort((x, y) => x - y));
      expect(distance(beads[0], { x: 50, y: 50 })).toBeGreaterThan(12);
      expect(distance(beads[6], point)).toBeGreaterThan(8);
    }
  });

  it('실의 좌표는 소수 둘째 자리까지다 — 서버와 브라우저가 같은 글자를 낸다', () => {
    const beads = [...threadTo(at.p3), ...threadBetween(at.p0, at.p1)];
    expect(beads.every((bead) => twoPlaces(bead.x) && twoPlaces(bead.y) && twoPlaces(bead.r))).toBe(true);
  });

  it('사람끼리의 실은 궤도의 이웃이어도 두 원에 닿지 않고 점이 둘 이상이다', () => {
    const beads = threadBetween(at.p0, at.p1);
    expect(beads.length).toBeGreaterThanOrEqual(2);
    expect(distance(beads[0], at.p0)).toBeGreaterThan(8);
    expect(distance(beads[beads.length - 1], at.p1)).toBeGreaterThan(8);
  });
});
