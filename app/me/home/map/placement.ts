/*
  **궤도 위 자리 계산 — 겹치지 않는 것이 이 파일의 일 전부다.**

  좌표는 지도 상자(정사각)의 백분율이다. 저장한 사람은 모두 **한 궤도**에 앉는다 — 거리는 아무것도 판정하지
  않는다(`model.ts`).

  겹침을 막는 둘:
  1. **열 명이 서도 이웃 간격이 이름표 폭보다 넓다.** 이름표는 72px(넓은 화면 84px)에서 말줄임이 된다.
     폰 궤도 판 폭 320px 에서 반지름 41% 열 명의 이웃 간격은 2·131·sin(18°) ≈ 81px 이다.
  2. 저장한 두 사람의 궁합 선이 있으면 짝을 가장 가까운 빈 자리에 앉힌다 — 선이 지도를 가로지르지 않게.
*/

export type Point = { x: number; y: number };

const RADIUS = 41;

export type Placed = { radius: number; at: Record<string, Point> };

function slots(count: number, radius: number, start: number): (Point & { angle: number })[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = start + (index * 2 * Math.PI) / count;
    /* 소수 둘째 자리까지 — 서버와 브라우저가 긴 소수를 다르게 적으면 하이드레이션이 어긋난다 */
    return { angle, x: round(50 + radius * Math.cos(angle)), y: round(50 + radius * Math.sin(angle)) };
  });
}

const round = (value: number) => Math.round(value * 100) / 100;

const gap = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
};

export function placeOnOrbit(people: readonly { id: string }[], links: readonly { a: string; b: string }[]): Placed {
  /* 정수리에서 시작한다 */
  const free = slots(people.length, RADIUS, -Math.PI / 2);
  const at: Record<string, Point> = {};
  const angleOf: Record<string, number> = {};
  const partnerOf = (id: string) =>
    links.flatMap((link) => (link.a === id ? [link.b] : link.b === id ? [link.a] : [])).find((other) => other in angleOf);

  /* 받은 차례로 앉되, 이미 앉은 짝이 있으면 그 곁의 빈 자리로 — 머리말 2 */
  for (const person of people) {
    const partner = partnerOf(person.id);
    let pick = 0;
    if (partner !== undefined) {
      const target = angleOf[partner];
      pick = free.reduce((best, slot, index) => (gap(slot.angle, target) < gap(free[best].angle, target) ? index : best), 0);
    }
    const [slot] = free.splice(pick, 1);
    at[person.id] = slot;
    angleOf[person.id] = slot.angle;
  }

  return { radius: RADIUS, at };
}

/**
 * 두 사람 사이 선 — **두 점을 잇는 선의 옆으로** 휜다. 점수 알약은 휜 선의 한가운데에 선다.
 * 가운데 쪽으로 밀면 두 사람이 가까울 때(궤도의 이웃) 알약이 한 사람 위에 얹혔다.
 */
export function arcBetween(a: Point, b: Point): { d: string; mid: Point } {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  let nx = -(b.y - a.y) / length;
  let ny = (b.x - a.x) / length;
  /* 두 방향 중 가운데(나)에서 먼 쪽 */
  if (nx * (mx - 50) + ny * (my - 50) < 0) {
    nx = -nx;
    ny = -ny;
  }
  const push = Math.max(9, length * 0.45);
  const control = { x: mx + nx * push, y: my + ny * push };
  /* 2차 베지어의 t=0.5 는 (a + 2c + b) / 4 */
  const mid = { x: round((a.x + 2 * control.x + b.x) / 4), y: round((a.y + 2 * control.y + b.y) / 4) };
  return { d: `M ${a.x} ${a.y} Q ${round(control.x)} ${round(control.y)} ${b.x} ${b.y}`, mid };
}
