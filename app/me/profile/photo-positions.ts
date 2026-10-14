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

/**
 * 메뉴 판이 서는 쪽 — 칸이 화면 오른쪽 끝에 있으면 판이 밖으로 안 나가게 오른쪽에 붙인다. 대표 칸은 그 칸 안 왼쪽 위다.
 * 칸의 자리는 세 칸 격자(대표가 두 줄 두 칸)로 정해져 있다 — 2 · 3 은 셋째 열, 4 · 5 · 6 은 셋째 줄.
 */
export function menuAlign(position: number): string {
  if (position === 1) return 'left-3 top-3';
  if (position === 4) return 'left-0 top-full mt-1.5';
  if (position === 5) return 'left-1/2 top-full mt-1.5 -translate-x-1/2';
  return 'right-0 top-full mt-1.5';
}
