import type { Element } from '@/src/lib/saju';

import { ELEMENT_ANGLE, SPARE_ANGLES, round2 } from '../../ui/orbit';
import { supplyOf, type DeckCard } from './deck-card';

/*
  **「내 궤도로 다가오는 인연」이 누구를 어디에 세우는가** — 지도(`orbit-map.tsx`)의 판단을 그림에서 떼어 냈다. 그림은
  vitest 가 못 그리지만(ADR 0080) 여기는 닿는다.

  2026-09-27 에 잰 것: 지도는 덱이 받은 사람 전부(오늘 10명)를 바깥 궤도에 세웠다. 채워 주는 기운이 한쪽에 몰리면(예시 10명 중
  木 쪽 다섯) 얼굴이 서로 밀려 제 방향을 잃었고, 폰 띠(124°)에는 열이 13° 간격으로도 안 들어갔다. 그래서 지도에 서는 사람은
  **지금 한 사람과 줄의 다음 다섯**이고(`MAP_LIMIT`), 넘친 사람은 「+n」 하나로 선다. 덱이 늘 여섯을 채우는 모양에서는 거의
  넘치지 않고, 되돌리기로 잠깐 일곱이 될 때만 「+1」 이 선다.
*/

/** 지도 위 한 사람의 자리 — 지나친 인연 보기에서는 넘긴 사람이 `kept` 로 궤도에 남는다 */
export type MapStatus = 'current' | 'waiting' | 'passed' | 'requested' | 'kept';

/** `round` 는 넓은 화면의 온 궤도, `arc` 는 폰의 해돋이 띠(궤도의 위쪽 반만 가로로 편 것) */
export type Shape = 'round' | 'arc';

/** 궤도의 가로 · 세로 반지름 — 상자의 백분율 */
export type Ring = readonly [rx: number, ry: number];

type Point = { x: number; y: number };

type Geometry = {
  /** 상자의 가로 : 세로 — SVG viewBox 도 이 비로 선다 */
  aspect: number;
  center: Point;
  angle: Record<Element, number>;
  /** 보완 오행이 없는 후보가 설 빈 각도 */
  spare: readonly number[];
  /** 바깥 궤도에서 이웃한 두 후보가 떨어져 설 가장 좁은 각도 — 얼굴과 이름이 겹치지 않게 */
  gap: number;
  /** 띠의 두 끝 — 폰 띠는 원이 아니라서 밀려난 사람이 바닥 밑으로 떨어지지 않게 이 안에 가둔다 */
  bounds: readonly [number, number] | null;
  /**
   * 궤도 다섯 — 안쪽의 내 오행(`element`), 다가온 지금 후보(`current`), 누른 사람이 반 걸음 기운 자리(`peek`),
   * 기다리는 인연(`waiting`), 지나친 사람이 풀려 나가는 먼 궤도(`far` — 새로 서는 사람도 여기서 들어온다)
   */
  ring: Record<'element' | 'current' | 'peek' | 'waiting' | 'far', Ring>;
  /** 지나칠 때 궤도 방향으로 더 도는 각도 — 폰 띠는 폭이 좁아 덜 돈다 */
  sweep: number;
};

export const GEOMETRY: Record<Shape, Geometry> = {
  round: {
    aspect: 1,
    center: { x: 50, y: 50 },
    angle: ELEMENT_ANGLE,
    spare: SPARE_ANGLES,
    gap: 22,
    bounds: null,
    ring: { element: [19, 19], current: [36, 36], peek: [40, 40], waiting: [45, 45], far: [66, 66] },
    sweep: 38,
  },
  arc: {
    aspect: 2.15,
    center: { x: 50, y: 100 },
    angle: { 木: -152, 火: -121, 土: -90, 金: -59, 水: -28 },
    spare: [-105, -75, -136, -44],
    gap: 13,
    bounds: [-164, -16],
    ring: { element: [24, 52], current: [42, 80], peek: [43.5, 83], waiting: [46.5, 87], far: [70, 140] },
    sweep: 22,
  },
};

/** 빈 날 · 내 사주 없음의 작은 궤도 — 가운데 원이 상자에 비해 커서, 오행 알이 나에게 얹히지 않게 안쪽 궤도를 넓힌다 */
export const COMPACT_ELEMENT_RING: Ring = [31, 31];

/** 지도에 서는 사람 수 — 지금 한 사람과 줄의 다음 다섯 */
export const MAP_LIMIT = 6;

/** 요청한 사람이 가운데로 빨려 들며 더 도는 각도 */
export const PULL_TWIST = 28;

export function pointOf(center: Point, angle: number, [rx, ry]: Ring): Point {
  const rad = (angle * Math.PI) / 180;
  return { x: round2(center.x + rx * Math.cos(rad)), y: round2(center.y + ry * Math.sin(rad)) };
}

/**
 * **지도에 서는 줄** — 지금 사람이 맨 앞, 기다리는 사람은 받은 차례대로, 앞의 `MAP_LIMIT` 명. 지나친 · 요청한 사람은 줄에
 * 없다(떠나는 한 사람은 지도가 따로 붙잡아 제 길을 다 가게 한다).
 */
export function queueOf(
  cards: readonly DeckCard[],
  statusOf: (card: DeckCard) => MapStatus,
): { shown: readonly DeckCard[]; overflow: number } {
  const current = cards.filter((card) => statusOf(card) === 'current');
  const waiting = cards.filter((card) => {
    const status = statusOf(card);
    return status === 'waiting' || status === 'kept';
  });
  const queue = [...current, ...waiting];
  const shown = queue.slice(0, MAP_LIMIT);
  return { shown, overflow: queue.length - shown.length };
}

/**
 * 바깥 궤도의 자리 — 저마다 **자기가 채워 주는 오행의 각도**를 원하고, 이웃과 `gap` 보다 가까우면 서로 밀어 벌린다.
 *
 * 지금 후보는 제 각도를 유지하며 안쪽으로 들어온다 — 한 사람이 다가올 때 나머지 사람까지 움직이지 않는다. 보완 오행이 없는
 * 후보는 오행 사이의 빈 각도를 원한다. 폰 띠는 두 끝(`bounds`) 안에 가둔다. 밀기는 120 번까지 되풀이한다 — 40 번으로는
 * 폰 띠에 일곱이 몰린 날 이웃 사이가 13° 에 0.14° 못 미쳤다(2026-09-27, `orbit-seats.test.ts`).
 */
export function anglesOf(shape: Shape, cards: readonly DeckCard[]): Record<string, number> {
  const { angle, spare, gap, bounds } = GEOMETRY[shape];
  const spares = [...spare];
  const circular = bounds === null;
  const seats = cards.map((card) => {
    const supply = supplyOf(card);
    const want = supply !== null ? angle[supply] : (spares.shift() ?? angle.土);
    return { id: card.candidateUserId, at: want };
  });
  for (let round = 0; round < 120; round += 1) {
    seats.sort((x, y) => x.at - y.at);
    let moved = false;
    const pairs = seats.length > 1 ? seats.length - (circular ? 0 : 1) : 0;
    for (let i = 0; i < pairs; i += 1) {
      const left = seats[i];
      const right = seats[(i + 1) % seats.length];
      const between = right.at - left.at + (i + 1 === seats.length ? 360 : 0);
      if (between >= gap - 0.01) continue;
      const push = gap - between;
      moved = true;
      left.at -= push / 2;
      right.at += push / 2;
    }
    if (bounds !== null) {
      for (const seat of seats) seat.at = Math.min(bounds[1], Math.max(bounds[0], seat.at));
    }
    if (!moved) break;
  }
  const out: Record<string, number> = {};
  for (const seat of seats) out[seat.id] = round2(seat.at);
  return out;
}

/** 후보 → 채워 줄 오행 자리. 곧은 선 대신 한쪽으로 살짝 휜 곡선 — 중점을 수직으로 민다 */
export function curveOf(from: Point, to: Point, aspect: number): string {
  const a = { x: from.x * aspect, y: from.y };
  const b = { x: to.x * aspect, y: to.y };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const bend = Math.min(10, length * 0.35);
  const c = { x: (a.x + b.x) / 2 - (dy / length) * bend, y: (a.y + b.y) / 2 + (dx / length) * bend };
  return `M ${round2(a.x)} ${round2(a.y)} Q ${round2(c.x)} ${round2(c.y)} ${round2(b.x)} ${round2(b.y)}`;
}

/**
 * 떠난 사람이 간 길 — 각도와 반지름을 함께 바꾸는 나선을 점 열둘로 긋는다. 얼굴이 가는 곡선(가속)을 닮게 반지름은 뒤로
 * 갈수록 빨리 변한다.
 */
export function spiralOf(geometry: Geometry, fromAngle: number, toAngle: number, from: Ring, to: Ring): string {
  const points: string[] = [];
  for (let step = 0; step <= 12; step += 1) {
    const t = step / 12;
    const ease = t * t;
    const at = pointOf(geometry.center, fromAngle + (toAngle - fromAngle) * t, [
      from[0] + (to[0] - from[0]) * ease,
      from[1] + (to[1] - from[1]) * ease,
    ]);
    points.push(`${round2(at.x * geometry.aspect)} ${round2(at.y)}`);
  }
  return `M ${points.join(' L ')}`;
}

/** 방금 떠난 한 사람 — 「지금」이던 사람이 지나침 · 요청으로 바뀐 것 */
export type Departure = { id: string; kind: 'passed' | 'requested' };

/**
 * 두 번의 그림 사이에 **「지금」이던 사람이 떠났는가** — 떠난 순간을 한 번만 그리려고 상태의 바뀜에서 잡는다. 처음 그릴 때는
 * 앞 상태가 비어 있어 떠난 사람이 없다 — 그래서 들어오자마자 옛날에 요청한 사람에게 물결이 서지 않는다.
 */
export function departureOf(before: Readonly<Record<string, MapStatus>>, after: Readonly<Record<string, MapStatus>>): Departure | null {
  for (const [id, now] of Object.entries(after)) {
    if (before[id] !== 'current') continue;
    if (now === 'passed' || now === 'requested') return { id, kind: now };
  }
  return null;
}
