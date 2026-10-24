import type { MyPhoto } from './photos';

/** 목록에서 그 판본의 자리(1부터) — 없으면 0 이라 `movedPhotos` 가 그대로 돌려준다 */
export function positionOf(list: readonly MyPhoto[], version: number): number {
  return list.findIndex((photo) => photo.version === version) + 1;
}

/** 서버에서 그 장이 지금 몇 번째인가 — 서버가 지웠다고 답한 장은 목록이 새로 오기 전에도 뺀다 */
export function serverPosition(list: readonly MyPhoto[], gone: ReadonlySet<number>, version: number): number | null {
  const position = positionOf(
    list.filter((photo) => !gone.has(photo.version)),
    version,
  );
  return position === 0 ? null : position;
}

