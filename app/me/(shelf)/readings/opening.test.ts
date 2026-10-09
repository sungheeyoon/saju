import { describe, expect, it } from 'vitest';

import {
  LEGACY_LAST_OPENED_KEY,
  lastOpenedKeyOf,
  lastOpenedOf,
  openBookOf,
  openingHref,
  withOpened,
  type ShelfLists,
} from './opening';

describe('기억을 두는 자리', () => {
  it('계정마다 다르다 — 같은 브라우저에서 계정을 바꿔도 남의 기억을 읽지 않는다', () => {
    const a = lastOpenedKeyOf('11111111-1111-4111-8111-111111111111');
    const b = lastOpenedKeyOf('22222222-2222-4222-8222-222222222222');
    expect(a).not.toBe(b);
    expect(a).toContain('11111111-1111-4111-8111-111111111111');
  });

  it('계정을 가르기 전의 한 키와 겹치지 않는다', () => {
    expect(lastOpenedKeyOf('11111111-1111-4111-8111-111111111111')).not.toBe(LEGACY_LAST_OPENED_KEY);
  });
});

const SELF = '/me/readings/self';
const P1 = '/me/readings/p1';
const P2 = '/me/readings/p2';
const C1 = '/me/compat?a=x&b=y';
const C2 = '/me/compat?a=x&b=z';
const M1 = '/me/match/m1';

function listsOf({ saju = [], compat = [], match = [] }: { saju?: string[]; compat?: string[]; match?: string[] }): ShelfLists {
  return { all: [...match, ...saju, ...compat], saju, compat, match };
}

describe('책장이 넓은 화면에서 펼 한 권 — 기억이 없을 때', () => {
  it('사주풀이 칩은 내 사주풀이가 있으면 더 최근 글이 있어도 그것을 편다', () => {
    expect(openingHref('saju', listsOf({ saju: [P2, SELF, P1] }), {})).toBe(SELF);
  });

  it('사주풀이 칩은 내 사주풀이가 없으면 가장 최근 글을 편다', () => {
    expect(openingHref('saju', listsOf({ saju: [P2, P1] }), {})).toBe(P2);
  });

  it('전체 칩도 내 사주풀이가 먼저다 — 한 사람 풀이가 없으면 책장의 첫 권', () => {
    expect(openingHref('all', listsOf({ saju: [P2, SELF], compat: [C1] }), {})).toBe(SELF);
    expect(openingHref('all', listsOf({ compat: [C1], match: [M1] }), {})).toBe(M1);
  });

  it('궁합풀이 · 인연 궁합 칩은 그 칸의 가장 최근 글을 편다', () => {
    const lists = listsOf({ saju: [SELF], compat: [C2, C1], match: [M1] });
    expect(openingHref('compat', lists, {})).toBe(C2);
    expect(openingHref('match', lists, {})).toBe(M1);
  });

  it('그 칸에 한 권도 없으면 아무것도 펴지 않는다', () => {
    expect(openingHref('compat', listsOf({ saju: [SELF] }), {})).toBeNull();
    expect(openingHref('all', listsOf({}), {})).toBeNull();
  });
});

describe('칩마다 마지막으로 연 풀이', () => {
  const lists = listsOf({ saju: [SELF, P1], compat: [C2, C1], match: [M1] });

  it('기억한 글이 책장에 있으면 그것을 편다 — 내 사주풀이보다 먼저다', () => {
    expect(openingHref('saju', lists, { saju: P1 })).toBe(P1);
    expect(openingHref('compat', lists, { compat: C1 })).toBe(C1);
  });

  it('기억한 글이 책장에서 사라졌으면 그 칸의 기본으로 돌아간다', () => {
    expect(openingHref('compat', lists, { compat: '/me/compat?a=gone&b=y' })).toBe(C2);
  });

  it('다른 칸의 글을 기억했으면 쓰지 않는다', () => {
    expect(openingHref('compat', lists, { compat: P1 })).toBe(C2);
  });

  it('한 권을 열면 전체와 제 칸이 함께 기억한다 — 다른 칸은 그대로다', () => {
    expect(withOpened({ saju: P1 }, lists, C1)).toEqual({ saju: P1, all: C1, compat: C1 });
  });

  it('책장에 없는 주소는 기억하지 않는다', () => {
    expect(withOpened({}, lists, '/me/readings/new')).toEqual({});
  });
});

describe('지금 펼친 글이 어느 권인가', () => {
  const lists = listsOf({ saju: [SELF], compat: [C1, C2], match: [M1] });

  it('보관함 틀 안의 궁합 주소는 두 사람까지 같아야 그 권이다', () => {
    expect(openBookOf(lists, '/me/readings/compat', 'a=x&b=z&kind=compat&from=shelf')).toBe(C2);
  });

  it('인연 궁합 · 한 사람 풀이도 찾는다', () => {
    expect(openBookOf(lists, '/me/readings/match/m1', 'from=shelf')).toBe(M1);
    expect(openBookOf(lists, '/me/readings/self', '')).toBe(SELF);
  });

  it('책장에 없는 글이면 없다', () => {
    expect(openBookOf(lists, '/me/readings/p9', '')).toBeNull();
  });
});

describe('저장해 둔 기억 읽기', () => {
  it('칩 이름의 글자만 읽는다', () => {
    expect(lastOpenedOf(JSON.stringify({ compat: C1, saju: 3, other: P1 }))).toEqual({ compat: C1 });
  });

  it('없거나 깨진 값은 기억이 없는 것이다', () => {
    expect(lastOpenedOf(null)).toEqual({});
    expect(lastOpenedOf('{')).toEqual({});
    expect(lastOpenedOf('"x"')).toEqual({});
  });
});
