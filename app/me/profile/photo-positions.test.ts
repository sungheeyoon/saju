import { describe, expect, it } from 'vitest';

import { positionOf, serverPosition } from './photo-positions';
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
});
