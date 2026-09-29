import { describe, expect, it } from 'vitest';

import type { MapModel } from '../me/home/map/model';
import { compatTabMap, fromCompat } from './map-links';

/**
 * **궁합 탭에서 연 직접 궁합은 궁합 탭에서 왔다고 싣는다**(「2026-09-29 u2」) — 결과의 ← 와 탭 불이 궁합 탭을 가리킨다.
 * 같은 화면의 두 칸을 채우는 주소와 사람 상세는 결과가 아니라 그대로다.
 */

describe('fromCompat', () => {
  it('직접 궁합 결과에만 from=compat 을 붙인다', () => {
    expect(fromCompat('/me/compat?a=p1&b=p2')).toBe('/me/compat?a=p1&b=p2&from=compat');
    expect(fromCompat('/compat#a.person=p1&b.person=p2')).toBe('/compat#a.person=p1&b.person=p2');
    expect(fromCompat('/me/people/p1')).toBe('/me/people/p1');
    expect(fromCompat('/me/match/m1')).toBe('/me/match/m1');
  });
});

describe('궁합 탭의 관계 지도', () => {
  const model: MapModel = {
    self: { label: '나', stem: '甲', element: '木', picture: '큰 나무' },
    people: [
      {
        id: 'p1',
        label: '어머니',
        note: null,
        day: null,
        unreadable: null,
        tileHref: '#person-p1',
        detailHref: '/me/people/p1',
        compat: { href: '/me/compat?a=self&b=p1', seen: true, score: 70, metaphor: null, current: true },
      },
      {
        id: 'p2',
        label: '아버지',
        note: null,
        day: null,
        unreadable: null,
        tileHref: '#person-p2',
        detailHref: '/me/people/p2',
        compat: { href: '/compat#a.person=self&b.person=p2', seen: false, score: null, metaphor: null, current: true },
      },
    ],
    links: [{ a: 'p1', b: 'p2', score: 60, href: '/me/compat?a=p1&b=p2', label: '어머니 × 아버지' }],
  };

  it('본 궁합과 두 사람 사이의 칩은 from=compat 을 싣고, 안 본 궁합은 위의 두 칸을 채우는 주소 그대로다', () => {
    const shaped = compatTabMap(model);

    expect(shaped.people.map((person) => person.compat.href)).toEqual([
      '/me/compat?a=self&b=p1&from=compat',
      '/compat#a.person=self&b.person=p2',
    ]);
    expect(shaped.links[0].href).toBe('/me/compat?a=p1&b=p2&from=compat');
  });

  it('사람 타일이 없는 탭이라 자바스크립트 없는 원은 그 사람의 상세로 간다', () => {
    expect(compatTabMap(model).people.map((person) => person.tileHref)).toEqual(['/me/people/p1', '/me/people/p2']);
  });
});
