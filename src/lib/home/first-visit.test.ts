import { describe, expect, it } from 'vitest';

import { isFirstVisit } from './first-visit';

describe('isFirstVisit — 처음 온 사람의 홈(G-99 안 A)', () => {
  it('풀이 · 만드는 중인 풀이 · 저장한 사람이 다 없으면 처음 온 사람이다', () => {
    expect(isFirstVisit({ readings: [], running: [], people: 0 })).toBe(true);
  });

  it('받은 풀이가 하나라도 있으면(궁합풀이여도) 다시 온 사람이다', () => {
    expect(isFirstVisit({ readings: [{ kind: 'private' }], running: [], people: 0 })).toBe(false);
  });

  it('만드는 중인 풀이가 있으면 다시 온 사람이다 — 받은 사주풀이 칸이 「만드는 중」을 말한다', () => {
    expect(isFirstVisit({ readings: [], running: [{ target: { kind: 'self' } }], people: 0 })).toBe(false);
  });

  it('저장한 사람이 있으면 다시 온 사람이다', () => {
    expect(isFirstVisit({ readings: [], running: [], people: 1 })).toBe(false);
  });
});
