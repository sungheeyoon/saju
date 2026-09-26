/*
  관계 지도의 자리 계산. 나 둘레의 오행 알 궤도는 없다(`relation-map.tsx` 머리말).

  매칭의 「내 궤도로 다가오는 인연」(`app/me/matching/orbit-map.tsx`)과 같은 문법을 홈으로 옮긴다.
  - **각도는 그 사람의 일간 오행이다.** 오행 다섯의 방향은 매칭과 같은 각도(木 → 火 → 土 → 金 → 水, 정수리부터
    시계 방향)에 서고, 저장한 사람은 바깥 궤도에서 **제 일간 오행의 방향**에 앉는다. 이웃이 너무 가까우면 서로 밀어 벌린다.
  - **거리는 판정하지 않는다.** 모두 같은 궤도다. 누른 사람도 자리를 떠나지 않고 제자리에서
    커진다.
  좌표는 정사각 상자의 백분율이고 소수 둘째 자리로 자른다(서버와 브라우저가 같은 글자를 쓰게).
*/
import type { Element } from '@/src/lib/saju';

export type Point = { x: number; y: number };

/** 매칭 지도의 `round` 각도와 같다 */
export const ELEMENT_ANGLE: Record<Element, number> = { 木: -90, 火: -18, 土: 54, 金: 126, 水: 198 };
/** 명식을 못 읽은 사람이 설 오행 사이의 빈 각도 */
const SPARE = [-54, 162, 90, 18];

/** 반지름 — 상자 폭의 % */
export const RING = { waiting: 42 } as const;
/** 지름 — 상자 폭의 %(`cqw`) */
/* 누른 사람은 제자리에서 커진다 — 궤도 밖으로 덜 나가게 14 */
export const SIZE = { me: 22, person: 11.5, current: 14 } as const;

export const round2 = (value: number) => Math.round(value * 100) / 100;

export function pointAt(angle: number, radius: number): Point {
  const rad = (angle * Math.PI) / 180;
  return { x: round2(50 + radius * Math.cos(rad)), y: round2(50 + radius * Math.sin(rad)) };
}

const wrap = (angle: number) => ((((angle + 180) % 360) + 360) % 360) - 180;

/**
 * 바깥 궤도의 각도 — 저마다 제 일간 오행의 각도를 원하고, 이웃과 `gap` 보다 가까우면 둘이 반씩 물러난다.
 * 이름표(말줄임 80px)가 폰 궤도(반지름 ≈ 135px)에서 안 겹치는 각이 30° 다. 사람이 많아 30° 가 안 나오면 고르게 나눈다.
 */
export function seatAngles(people: readonly { id: string; element: Element | null }[]): Record<string, number> {
  const gap = Math.min(30, 360 / Math.max(1, people.length));
  let spare = 0;
  const seats = people.map((person) => ({
    id: person.id,
    at: person.element !== null ? ELEMENT_ANGLE[person.element] : SPARE[spare++ % SPARE.length],
  }));
  for (let round = 0; round < 400 && seats.length > 1; round += 1) {
    for (const seat of seats) seat.at = wrap(seat.at);
    seats.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
    let moved = false;
    for (let i = 0; i < seats.length; i += 1) {
      const left = seats[i];
      const right = seats[(i + 1) % seats.length];
      const between = right.at - left.at + (i + 1 === seats.length ? 360 : 0);
      if (between >= gap - 0.05) continue;
      const push = (gap - between) / 2 + 0.01;
      left.at -= push;
      right.at += push;
      moved = true;
    }
    if (!moved) break;
  }
  const out: Record<string, number> = {};
  for (const seat of seats) out[seat.id] = round2(wrap(seat.at));
  return out;
}

/** 휜 곡선의 세 점 — 끝을 원 둘레만큼 잘라 낸다. `bend` 가 양수면 가는 쪽의 왼쪽(시계 방향)으로 휜다 */
export function bendOf(from: Point, to: Point, trimFrom: number, trimTo: number, bend: number): { a: Point; c: Point; b: Point } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const a = { x: from.x + ux * trimFrom, y: from.y + uy * trimFrom };
  const b = { x: to.x - ux * trimTo, y: to.y - uy * trimTo };
  const c = { x: (a.x + b.x) / 2 - uy * bend, y: (a.y + b.y) / 2 + ux * bend };
  return { a, c, b };
}

export function curve(from: Point, to: Point, trimFrom: number, trimTo: number, bend: number): string {
  const { a, c, b } = bendOf(from, to, trimFrom, trimTo, bend);
  return `M ${round2(a.x)} ${round2(a.y)} Q ${round2(c.x)} ${round2(c.y)} ${round2(b.x)} ${round2(b.y)}`;
}

/** 곡선 위의 여섯 점(끝 둘 포함) — 작은 것이 이 점들을 차례로 지나 선을 따라 건너간다(`--x0`…`--y5`) */
export function stepsAlong(from: Point, to: Point, trimFrom: number, trimTo: number, bend: number): Point[] {
  const { a, c, b } = bendOf(from, to, trimFrom, trimTo, bend);
  return [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => ({
    x: round2((1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x),
    y: round2((1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y),
  }));
}

/** 그림마다 숨의 박자를 흩는다 — 황금비로 돌려 이웃끼리 같은 때 움직이지 않게. 음수 초(이미 그만큼 지난 것처럼) */
export const phaseOf = (index: number): number => -round2((((index + 1) * 0.618034) % 1) * 12);

/** 저장한 두 사람 사이 — 가운데(나)에서 먼 쪽으로 휜다. 나를 가로지르지 않게 */
export function curveAway(from: Point, to: Point, trimFrom: number, trimTo: number): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  /* 왼쪽 법선(-dy, dx)이 가운데에서 먼 쪽이면 양수로 휜다 */
  const outward = -dy * (mx - 50) + dx * (my - 50) >= 0 ? 1 : -1;
  /* 살짝만 — 나를 비켜 갈 만큼. 크게 휘면 어지러웠다(운영자 2026-09-26) */
  return curve(from, to, trimFrom, trimTo, outward * Math.max(2, length * 0.1));
}
