import { describe, expect, it } from 'vitest';

import type { Element } from '@/src/lib/saju';

import { ELEMENT_ANGLE, RING, bendOf, curveAway, phaseOf, pointAt, seatAngles } from './orbit';

/*
  관계 지도의 자리 계산(`orbit.ts`)은 그리기가 아니라 판단이다 — 누가 어느 방향에 앉는가, 이웃이 겹치지 않는가,
  두 사람 사이의 선이 나를 가로지르지 않는가. 화면은 e2e 만 누르지만, 이 셋은 사람 수와 오행의 조합마다
  달라서 e2e 의 한 계정(저장한 사람 하나)으로는 한 번도 안 밟힌다. 그래서 여기서 잰다.
*/

const people = (elements: readonly (Element | null)[]) =>
  elements.map((element, index) => ({ id: `p${String(index).padStart(2, '0')}`, element }));

/** 둘레를 돌며 이웃 사이의 각 — 마지막과 첫째 사이도 든다 */
function gapsOf(angles: Record<string, number>): number[] {
  const sorted = Object.values(angles).toSorted((a, b) => a - b);
  return sorted.map((at, index) => (index + 1 < sorted.length ? sorted[index + 1] : sorted[0] + 360) - at);
}

describe('바깥 궤도의 자리', () => {
  it('혼자면 제 일간 오행의 방향에 그대로 앉는다', () => {
    for (const element of ['木', '火', '土', '金', '水'] as const) {
      const seat = seatAngles(people([element])).p00;
      /* 水 는 198° 를 원하고 자리는 [-180, 180) 로 접힌다 — 같은 방향이다 */
      expect(((seat - ELEMENT_ANGLE[element]) % 360 + 360) % 360).toBeCloseTo(0, 5);
    }
  });

  it('오행이 다 다르면 다섯이 모두 제 방향에 앉는다 — 72° 떨어져 밀 까닭이 없다', () => {
    const angles = seatAngles(people(['木', '火', '土', '金', '水']));
    expect(angles).toEqual({ p00: -90, p01: -18, p02: 54, p03: 126, p04: -162 });
  });

  it('같은 오행 둘은 그 방향을 가운데 두고 30° 벌어진다', () => {
    const angles = seatAngles(people(['火', '火']));
    const [a, b] = Object.values(angles).toSorted((x, y) => x - y);
    expect(b - a).toBeGreaterThanOrEqual(30 - 0.05);
    expect(b - a).toBeLessThan(31);
    expect((a + b) / 2).toBeCloseTo(ELEMENT_ANGLE.火, 1);
  });

  /* 저장한 사람은 열까지다(`person_limit()`) — 열이 한 오행에 몰려도 이름표가 안 겹치는 30° 가 선다 */
  it.each([2, 5, 8, 10])('%i 명이 한 오행에 몰려도 이웃끼리 30° 떨어진다', (count) => {
    const angles = seatAngles(people(Array.from({ length: count }, () => '木' as const)));
    expect(Object.keys(angles)).toHaveLength(count);
    for (const between of gapsOf(angles)) expect(between).toBeGreaterThanOrEqual(30 - 0.1);
  });

  it('자리는 [-180, 180) 안에 선다 — 좌표로 옮길 때 같은 방향이 두 이름을 갖지 않는다', () => {
    const angles = seatAngles(people(['水', '水', '水', '金', null, null, '木']));
    for (const at of Object.values(angles)) {
      expect(at).toBeGreaterThanOrEqual(-180);
      expect(at).toBeLessThan(180);
    }
  });

  it('명식을 못 읽은 사람은 오행 사이의 빈 각도에 선다 — 어느 오행의 방향도 가로채지 않는다', () => {
    const angles = seatAngles(people([null, null]));
    expect(angles).toEqual({ p00: -54, p01: 162 });
    for (const at of Object.values(angles)) expect(Object.values(ELEMENT_ANGLE)).not.toContain(at);
  });

  /* 서버가 그린 자리와 브라우저가 다시 그린 자리가 같아야 한다 — 받은 차례가 달라도 같은 답이다 */
  it('사람을 받은 차례가 달라도 자리는 같다', () => {
    const crowd = people(['木', '木', '木', '火', '土', '土', null]);
    const forward = seatAngles(crowd);
    const backward = seatAngles(crowd.toReversed());
    expect(backward).toEqual(forward);
  });
});

describe('선', () => {
  it('궤도의 점은 상자의 백분율이고, 정수리는 가운데 위에 선다', () => {
    expect(pointAt(-90, RING.waiting)).toEqual({ x: 50, y: 8 });
    expect(pointAt(0, RING.waiting)).toEqual({ x: 92, y: 50 });
  });

  it('선의 끝은 원 둘레에서 잘린다 — 얼굴 위로 선이 올라오지 않는다', () => {
    const from = { x: 50, y: 50 };
    const to = { x: 90, y: 50 };
    const { a, b } = bendOf(from, to, 12, 6, 0);
    expect(Math.hypot(a.x - from.x, a.y - from.y)).toBeCloseTo(12, 5);
    expect(Math.hypot(b.x - to.x, b.y - to.y)).toBeCloseTo(6, 5);
  });

  it('저장한 두 사람 사이의 선은 가운데(나)에서 먼 쪽으로 휜다', () => {
    const control = (d: string) => {
      const [, cx, cy] = /Q ([-\d.]+) ([-\d.]+)/.exec(d)!;
      return { x: Number(cx), y: Number(cy) };
    };
    /* 오른쪽 위와 오른쪽 아래 — 어느 차례로 긋든 굽이는 오른쪽(바깥)이다 */
    for (const [from, to] of [
      [pointAt(-30, RING.waiting), pointAt(30, RING.waiting)],
      [pointAt(30, RING.waiting), pointAt(-30, RING.waiting)],
      [pointAt(150, RING.waiting), pointAt(-150, RING.waiting)],
    ]) {
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      const c = control(curveAway(from, to, 7, 7));
      expect(Math.hypot(c.x - 50, c.y - 50)).toBeGreaterThan(Math.hypot(mid.x - 50, mid.y - 50));
    }
  });

  it('숨의 박자는 이웃끼리 겹치지 않고 12초 안에서 이미 지난 만큼이다', () => {
    const phases = Array.from({ length: 10 }, (_, index) => phaseOf(index));
    expect(new Set(phases).size).toBe(phases.length);
    for (const phase of phases) {
      expect(phase).toBeLessThanOrEqual(0);
      expect(phase).toBeGreaterThan(-12);
    }
  });
});
