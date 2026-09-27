import { describe, expect, it } from 'vitest';

import { openingHref } from './opening';

describe('풀이 탭이 넓은 화면에서 펼 한 권', () => {
  it('내 사주풀이가 있으면 더 최근 글이 있어도 그것을 편다', () => {
    expect(openingHref([{ href: '/me/readings/p2' }, { href: '/me/readings/self' }, { href: '/me/readings/p1' }])).toBe(
      '/me/readings/self',
    );
  });

  it('내 사주풀이가 없으면 가장 최근 글을 편다', () => {
    expect(openingHref([{ href: '/me/readings/p2' }, { href: '/me/readings/p1' }])).toBe('/me/readings/p2');
  });

  it('한 권도 없으면 아무것도 펴지 않는다', () => {
    expect(openingHref([])).toBeNull();
  });
});
