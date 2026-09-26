/*
  **궤도 위 자리 계산 — 겹치지 않는 것이 이 파일의 일 전부다.**

  좌표는 지도 상자(정사각)의 백분율이다. 저장한 사람은 모두 **한 궤도**에 앉는다 — 거리는 아무것도 판정하지
  않는다(`model.ts`).

  겹침을 막는 둘:
  1. **열 명이 서도 이웃 간격이 이름표 폭보다 넓다.** 이름표는 72px(넓은 화면 84px)에서 말줄임이 된다.
     폰 궤도 판 폭 320px 에서 반지름 41% 열 명의 이웃 간격은 2·131·sin(18°) ≈ 81px 이다.
  2. 저장한 두 사람의 궁합 선이 있으면 짝을 가장 가까운 빈 자리에 앉힌다 — 선이 지도를 가로지르지 않게.

  **선은 점으로 잇는다(「점점」의 실).** 곧은 먹선은 도면처럼 읽혔다(운영자 피드백, 2026-09-26). 로고의 궤도가
  점선이고 궤도 위 점이 작은 것에서 큰 것으로 이어지듯, 나 → 그 사람의 실은 살짝 휜 곡선 위의 점 일곱이 나에게서
  멀어질수록 커진다. 휘는 방향은 모두 같다(시계 방향) — 제각각 휘면 어지럽고, 같이 휘면 궤도가 도는 결로 읽힌다.
  점은 호의 길이로 고르게 놓는다 — 매개변수로 놓으면 휜 쪽에서 점이 몰린다.
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
export function arcBetween(a: Point, b: Point): { d: string; mid: Point; control: Point } {
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
  return { d: `M ${a.x} ${a.y} Q ${round(control.x)} ${round(control.y)} ${b.x} ${b.y}`, mid, control };
}

/** 실 위의 점 하나 — `r` 도 지도 상자의 백분율이다 */
export type Bead = Point & { r: number };

const CENTER: Point = { x: 50, y: 50 };

/* 원 둘레에서 실을 떼어 놓는 거리 — 가운데 나의 원(반지름 ≈ 10.6)과 사람 원(≈ 7.5)에 틈 하나씩 */
const FROM_SELF = 13.5;
const FROM_PERSON = 10;

/** 나 → 그 사람의 실 — 점 일곱이 나에게서 멀어질수록 커진다(머리말) */
export function threadTo(to: Point): Bead[] {
  const dx = to.x - CENTER.x;
  const dy = to.y - CENTER.y;
  const length = Math.hypot(dx, dy) || 1;
  const bend = length * 0.3;
  const control = { x: (CENTER.x + to.x) / 2 - (dy / length) * bend, y: (CENTER.y + to.y) / 2 + (dx / length) * bend };
  return beadsAlong(CENTER, control, to, { count: 7, trimStart: FROM_SELF, trimEnd: FROM_PERSON + 2.5, r: [0.4, 0.82] });
}

/** 저장한 두 사람 사이의 실 — `arcBetween` 의 곡선 위에 같은 크기의 점을 고른 간격으로. `a` 에서 `b` 로 차례가 선다 */
export function threadBetween(a: Point, b: Point): Bead[] {
  const { control } = arcBetween(a, b);
  const spacing = 3.4;
  const usable = arcLength(a, control, b) - 2 * FROM_PERSON;
  const count = Math.max(2, Math.floor(usable / spacing) + 1);
  return beadsAlong(a, control, b, { count, trimStart: FROM_PERSON, trimEnd: FROM_PERSON, r: [0.55, 0.55] });
}

const quad = (p0: Point, c: Point, p2: Point, t: number): Point => ({
  x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * c.x + t ** 2 * p2.x,
  y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * c.y + t ** 2 * p2.y,
});

const SAMPLES = 48;

/** 곡선을 짧은 토막으로 잘라 잰 길이 — 점 일곱을 놓는 데는 이 정도로 넉넉하다 */
function samplesOf(p0: Point, c: Point, p2: Point): { point: Point; at: number }[] {
  const out = [{ point: p0, at: 0 }];
  for (let i = 1; i <= SAMPLES; i += 1) {
    const point = quad(p0, c, p2, i / SAMPLES);
    const last = out[out.length - 1];
    out.push({ point, at: last.at + Math.hypot(point.x - last.point.x, point.y - last.point.y) });
  }
  return out;
}

const arcLength = (p0: Point, c: Point, p2: Point) => samplesOf(p0, c, p2)[SAMPLES].at;

function beadsAlong(
  p0: Point,
  c: Point,
  p2: Point,
  { count, trimStart, trimEnd, r: [first, last] }: { count: number; trimStart: number; trimEnd: number; r: [number, number] },
): Bead[] {
  const samples = samplesOf(p0, c, p2);
  const total = samples[SAMPLES].at;
  const from = Math.min(trimStart, total / 2);
  const to = Math.max(from, total - trimEnd);
  return Array.from({ length: count }, (_, index) => {
    const share = count === 1 ? 0.5 : index / (count - 1);
    const want = from + (to - from) * share;
    /* 끝의 소수 오차로 못 찾으면 마지막 토막이다 */
    const found = samples.findIndex((sample) => sample.at >= want);
    const at = found === -1 ? SAMPLES : Math.max(1, found);
    const hi = samples[at];
    const lo = samples[at - 1];
    const k = hi.at === lo.at ? 0 : (want - lo.at) / (hi.at - lo.at);
    return {
      x: round(lo.point.x + (hi.point.x - lo.point.x) * k),
      y: round(lo.point.y + (hi.point.y - lo.point.y) * k),
      r: round(first + (last - first) * share),
    };
  });
}
