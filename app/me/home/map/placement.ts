/*
  **궤도 위 자리 계산 — 겹치지 않는 것이 이 파일의 일 전부다.** (홈 시안 orbit 의 계산을 그대로 옮겼다)

  좌표는 지도 상자(정사각)의 백분율이다.

  겹침을 막는 셋:
  1. **한 궤도에 몇이 서도 이웃 간격이 이름표 폭보다 넓다.** 이름표는 72px(넓은 화면 84px)에서 말줄임이 된다.
     폰 궤도 판 폭 320px 에서 바깥 궤도(반지름 44%) 열 명의 이웃 간격은 2·141·sin(18°) ≈ 87px,
     안쪽 궤도(29%)는 여섯 명까지 2·93·sin(30°) ≈ 93px 이다. 안쪽이 여섯을 넘으면 반지름을 키운다.
  2. **두 궤도는 엇갈린다.** 바깥 궤도의 시작각을 72 곳 중에서 골라, 안쪽 사람과 가장 좁은 각이 가장
     넓어지게 한다 — 바깥 사람의 이름표가 안쪽 사람 위에 얹히지 않게. 반 칸 공식은 5 · 5 에서 18° 까지 붙었다.
  3. 저장한 두 사람의 궁합 선이 있으면, 바깥 사람을 짝에 가장 가까운 빈 자리에 앉힌다 — 선이 지도를
     가로지르지 않게.
*/

export type Ring = 'inner' | 'outer';
export type Point = { x: number; y: number };

export const RADIUS = { inner: 29, outer: 44 } as const;
const INNER_ROOM = 6;

export type Placed = { radius: Record<Ring, number>; at: Record<string, Point> };

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

export function placeOnOrbit(
  people: readonly { id: string; ring: Ring }[],
  links: readonly { a: string; b: string }[],
): Placed {
  const inner = people.filter((person) => person.ring === 'inner');
  const outer = people.filter((person) => person.ring === 'outer');
  const innerRadius = Math.min(35, RADIUS.inner + Math.max(0, inner.length - INNER_ROOM) * 2);
  const radius = { inner: innerRadius, outer: Math.max(RADIUS.outer, innerRadius + 12) };

  /* 안쪽은 오른쪽 위(-60°)에서 시작한다 — 정수리의 자리는 바깥 궤도의 이름표가 쓴다 */
  const innerStart = -Math.PI / 3;
  const at: Record<string, Point> = {};
  const angleOf: Record<string, number> = {};
  slots(inner.length, radius.inner, innerStart).forEach((slot, index) => {
    at[inner[index].id] = slot;
    angleOf[inner[index].id] = slot.angle;
  });

  /* 바깥 궤도의 시작각을 찾는다 — 머리말 2 */
  const innerAngles = Object.values(angleOf);
  const outerStart =
    outer.length === 0 || innerAngles.length === 0
      ? -Math.PI / 2
      : Array.from({ length: 72 }, (_, index) => -Math.PI / 2 + (index * 2 * Math.PI) / (72 * outer.length)).reduce(
          (best, start) => {
            const spread = (from: number) =>
              Math.min(...slots(outer.length, 1, from).flatMap((slot) => innerAngles.map((angle) => gap(slot.angle, angle))));
            return spread(start) > spread(best) + 1e-9 ? start : best;
          },
          -Math.PI / 2,
        );
  const free = slots(outer.length, radius.outer, outerStart);
  const partnerOf = (id: string) =>
    links.flatMap((link) => (link.a === id ? [link.b] : link.b === id ? [link.a] : [])).find((other) => other in angleOf);

  /* 짝이 있는 사람부터 앉힌다 — 짝 없는 사람은 남은 자리를 차례로 */
  const ordered = [...outer].sort((a, b) => Number(partnerOf(b.id) !== undefined) - Number(partnerOf(a.id) !== undefined));
  for (const person of ordered) {
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

  return { radius, at };
}

/**
 * 두 사람 사이 선 — **두 점을 잇는 선의 옆으로** 휜다. 점수 알약은 휜 선의 한가운데에 선다.
 * 가운데 쪽으로 밀면 두 사람이 가까울 때(안쪽 · 바깥 궤도의 짝) 알약이 한 사람 위에 얹혔다.
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
