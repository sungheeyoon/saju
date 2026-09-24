import type { Point } from './placement';

/*
  **손으로 그은 듯한 선.** 선마다 살짝 휘게 하고 휜 방향을 사람마다 번갈아 둔다 — 여러 선이
  가운데서 뻗어도 자로 그은 바퀴살처럼 보이지 않게.
  같은 선을 조금 다르게 휜 옅은 선 하나를 겹쳐(`echo`) 연필로 두 번 그은 결을 낸다.

  좌표는 지도 상자(정사각)의 0~100 이다.
*/

const round = (value: number) => Math.round(value * 100) / 100;

/** 두 점 사이 2차 베지어 — `bend` 는 길이에 대한 옆 밀기 비율(부호가 방향) */
export function softCurve(a: Point, b: Point, bend: number): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / length;
  const ny = (b.x - a.x) / length;
  const cx = round(mx + nx * length * bend);
  const cy = round(my + ny * length * bend);
  return `M ${round(a.x)} ${round(a.y)} Q ${cx} ${cy} ${round(b.x)} ${round(b.y)}`;
}
