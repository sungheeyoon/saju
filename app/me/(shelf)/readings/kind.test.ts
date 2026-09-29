import { describe, expect, it } from 'vitest';

import { shelfKindOf, shelfKindOfReading, withShelfKind } from './kind';

describe('풀이 보관함의 필터 주소 (ADR 0133)', () => {
  it('saju · compat · match 는 그 칸으로 연다', () => {
    expect(shelfKindOf('saju')).toBe('saju');
    expect(shelfKindOf('compat')).toBe('compat');
    expect(shelfKindOf('match')).toBe('match');
  });

  it('없거나 모르는 값은 전체다 — 빈 책장에 떨어지지 않는다', () => {
    for (const value of [null, undefined, '', 'all', 'MATCH', 'private', 'self']) {
      expect(shelfKindOf(value), String(value)).toBe('all');
    }
  });

  it('풀이 한 편은 제 칸 하나에 선다 — 직접 고른 궁합과 인연 궁합이 갈린다', () => {
    expect(shelfKindOfReading('self')).toBe('saju');
    expect(shelfKindOfReading('person')).toBe('saju');
    expect(shelfKindOfReading('private')).toBe('compat');
    expect(shelfKindOfReading('match')).toBe('match');
  });

  it('보관함 안의 주소는 켠 칸을 들고 간다 — 전체는 안 붙인다', () => {
    expect(withShelfKind('/me/readings/self', 'saju')).toBe('/me/readings/self?kind=saju');
    expect(withShelfKind('/me/readings', 'all')).toBe('/me/readings');
  });
});
