import { describe, expect, it } from 'vitest';

import { menuAlign, positionOf, serverPosition } from './photo-positions';
import type { MyPhoto } from './photos';

describe('사진의 자리', () => {
  const photo = (position: number, version: number): MyPhoto => ({ position, version, focus: { x: 50, y: 50 } });
  const list = [photo(1, 10), photo(2, 20), photo(3, 30)];

  it('판본의 자리는 1부터, 없으면 0', () => {
    expect(positionOf(list, 20)).toBe(2);
    expect(positionOf(list, 99)).toBe(0);
  });

  it('서버가 지운 장은 목록이 새로 오기 전에도 빼고 센다', () => {
    expect(serverPosition(list, new Set([10]), 30)).toBe(2);
    expect(serverPosition(list, new Set([30]), 30)).toBeNull();
    expect(serverPosition(list, new Set(), 99)).toBeNull();
  });

  it('메뉴 판은 대표 칸 안 · 셋째 줄 왼쪽 · 가운데 · 그 밖은 오른쪽에 붙는다', () => {
    expect(menuAlign(1)).toBe('left-3 top-3');
    expect(menuAlign(4)).toBe('left-0 top-full mt-1.5');
    expect(menuAlign(5)).toBe('left-1/2 top-full mt-1.5 -translate-x-1/2');
    expect([2, 3, 6].map(menuAlign)).toEqual(Array(3).fill('right-0 top-full mt-1.5'));
  });
});
