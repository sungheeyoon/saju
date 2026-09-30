import { describe, expect, it } from 'vitest';

import {
  CAME_FROM,
  backOf,
  cameFromOf,
  lightOf,
  isOpenResult,
  placeOf,
  resultKindOf,
  withCameFrom,
  type ResultKind,
} from './came-from';

const KINDS: readonly ResultKind[] = ['saju', 'compat', 'match'];
const MATCH_ID = '11111111-2222-4333-8444-555555555555';

/** 같은 사이트의 경로인가 — `/` 로 시작하고 `//`(다른 호스트) · `/\`(브라우저가 `//` 로 읽는다)가 아니다 */
function sameSitePath(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/\\');
}

describe('온 곳 (ADR 0134)', () => {
  it('알려진 값 일곱만 읽고, 배열이면 첫 값이다', () => {
    for (const from of CAME_FROM) expect(cameFromOf(from)).toBe(from);
    expect(cameFromOf(['chat', 'me'])).toBe('chat');
    expect(cameFromOf([])).toBeNull();
  });

  it('모르는 값 · 빈 값 · 주소 모양 · 대소문자 · 앞뒤 공백은 없는 것이다', () => {
    for (const value of [null, undefined, '', 'nope', 'ME', ' me', 'me ', 'https://evil.example', '//evil.example', '/me', 'javascript:alert(1)', '%2F%2Fevil']) {
      expect(cameFromOf(value), String(value)).toBeNull();
    }
  });

  it('결과 화면 셋만 결과다 — 보관함 목록 · 나 · 궁합 고르기는 아니다', () => {
    expect(resultKindOf('/me/readings/self')).toBe('saju');
    expect(resultKindOf('/me/readings/abc')).toBe('saju');
    expect(resultKindOf('/me/compat')).toBe('compat');
    expect(resultKindOf(`/me/match/${MATCH_ID}`)).toBe('match');
    for (const pathname of ['/me/readings', '/me/readings/', '/me', '/compat', '/me/match/', '/me/matching', '/me/chat/x']) {
      expect(resultKindOf(pathname), pathname).toBeNull();
    }
  });

  it('없으면 결과 종류의 탭, 있으면 온 곳의 불이다', () => {
    expect(lightOf('saju', null)).toBe('/me');
    expect(lightOf('compat', null)).toBe('/compat');
    expect(lightOf('match', null)).toBe('/me/matching');
    for (const kind of KINDS) {
      expect(lightOf(kind, 'me')).toBe('/me');
      expect(lightOf(kind, 'shelf')).toBe('/me');
      expect(lightOf(kind, 'compat')).toBe('/compat');
      expect(lightOf(kind, 'matching')).toBe('/me/matching');
      expect(lightOf(kind, 'history')).toBe('/me/matching');
      expect(lightOf(kind, 'chat')).toBe('/me/chat');
      expect(lightOf(kind, 'news')).toBe('/me/requests');
    }
  });
});

describe('← 가 가는 곳 (ADR 0134)', () => {
  it('온 곳마다 가는 곳과 그 이름이 선다', () => {
    expect(backOf('saju', { from: 'me' })).toEqual({ href: '/me', label: '홈' });
    expect(backOf('compat', { from: 'shelf', shelfKind: 'compat' })).toEqual({ href: '/me/readings?kind=compat', label: '풀이 보관함' });
    expect(backOf('saju', { from: 'shelf', shelfKind: 'all' })).toEqual({ href: '/me/readings', label: '풀이 보관함' });
    expect(backOf('saju', { from: 'shelf' })).toEqual({ href: '/me/readings', label: '풀이 보관함' });
    expect(backOf('compat', { from: 'compat' })).toEqual({ href: '/compat', label: '궁합' });
    expect(backOf('match', { from: 'matching' })).toEqual({ href: '/me/matching', label: '인연' });
    expect(backOf('match', { from: 'history' })).toEqual({ href: '/me/matching/history', label: '인연 기록' });
    expect(backOf('saju', { from: 'news' })).toEqual({ href: '/me/requests', label: '소식' });
  });

  it('채팅에서 온 인연 궁합은 그 Match 의 방으로, 다른 결과는 채팅 목록으로 간다', () => {
    expect(backOf('match', { from: 'chat', matchId: MATCH_ID })).toEqual({ href: `/me/chat/${MATCH_ID}`, label: '채팅' });
    expect(backOf('match', { from: 'chat' })).toEqual({ href: '/me/chat', label: '채팅' });
    expect(backOf('compat', { from: 'chat', matchId: MATCH_ID })).toEqual({ href: '/me/chat', label: '채팅' });
  });

  it('없으면 결과 종류의 탭 첫 화면이다', () => {
    expect(backOf('saju', { from: null })).toEqual({ href: '/me', label: '홈' });
    expect(backOf('compat', { from: null })).toEqual({ href: '/compat', label: '궁합' });
    expect(backOf('match', { from: null })).toEqual({ href: '/me/matching', label: '인연' });
  });

  /** **열린 리디렉트가 없다** — 어떤 쿼리를 넣어도 ← 는 같은 사이트의 경로다 */
  it('어떤 쿼리를 넣어도 ← 는 같은 사이트의 경로다', () => {
    const hostile = ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '../..', '%2F%2Fevil'];
    for (const kind of KINDS) {
      for (const from of [...CAME_FROM, ...hostile, null]) {
        for (const shelfKind of [...hostile, 'compat', null]) {
          const place = placeOf({ from, kind: shelfKind });
          const back = backOf(kind, { ...place, matchId: MATCH_ID });
          expect(sameSitePath(back.href), `${kind} from=${from} kind=${shelfKind} → ${back.href}`).toBe(true);
          expect(back.href).not.toContain('evil');
        }
      }
    }
  });

  it('주소의 두 값을 읽는다 — 모르는 칩은 전체다', () => {
    expect(placeOf({ from: 'shelf', kind: 'compat' })).toEqual({ from: 'shelf', shelfKind: 'compat' });
    expect(placeOf({ from: ['shelf'], kind: ['match', 'saju'] })).toEqual({ from: 'shelf', shelfKind: 'match' });
    expect(placeOf({ from: 'x', kind: 'x' })).toEqual({ from: null, shelfKind: 'all' });
    expect(placeOf({})).toEqual({ from: null, shelfKind: 'all' });
  });
});

describe('결과 링크에 온 곳을 싣는다 (ADR 0134)', () => {
  it('쿼리가 없는 주소는 ? 로, 있는 주소는 & 로 잇는다', () => {
    expect(withCameFrom('/me/readings/self', 'me')).toBe('/me/readings/self?from=me');
    expect(withCameFrom('/me/compat?a=p1&b=p2', 'compat')).toBe('/me/compat?a=p1&b=p2&from=compat');
    expect(withCameFrom(`/me/match/${MATCH_ID}`, 'chat')).toBe(`/me/match/${MATCH_ID}?from=chat`);
  });

  it('이미 온 곳을 든 주소에는 덧붙이지 않는다', () => {
    expect(withCameFrom('/me/readings/self?from=me', 'shelf', 'saju')).toBe('/me/readings/self?from=me');
    expect(withCameFrom('/me/compat?a=p1&b=p2&from=compat', 'shelf')).toBe('/me/compat?a=p1&b=p2&from=compat');
    expect(resultKindOf('/me/readings/self?from=me')).toBe('saju');
    expect(resultKindOf('/me/compat?a=p1&b=p2')).toBe('compat');
  });

  it('보관함은 칩을 함께 싣고, 전체 칩은 안 싣는다', () => {
    expect(withCameFrom('/me/readings/self', 'shelf', 'saju')).toBe('/me/readings/self?kind=saju&from=shelf');
    expect(withCameFrom('/me/compat?a=p1&b=p2', 'shelf', 'compat')).toBe('/me/readings/compat?a=p1&b=p2&kind=compat&from=shelf');
    expect(withCameFrom('/me/readings/self', 'shelf')).toBe('/me/readings/self?from=shelf');
    /* 보관함이 아닌 온 곳은 칩을 안 든다 */
    expect(withCameFrom('/me/readings/self', 'me', 'saju')).toBe('/me/readings/self?from=me');
  });

  it('실은 값을 결과 화면이 그대로 읽어 되돌린다', () => {
    for (const from of CAME_FROM) {
      const url = new URL(withCameFrom('/me/compat?a=p1&b=p2', from, 'compat'), 'https://x.example');
      const place = placeOf({ from: url.searchParams.get('from'), kind: url.searchParams.get('kind') });
      expect(place.from).toBe(from);
      expect(place.shelfKind).toBe(from === 'shelf' ? 'compat' : 'all');
    }
  });
});

describe('보관함에서 연 궁합은 틀 안에 선다 (ADR 0134, 2026-09-29)', () => {
  it('보관함이 싣는 궁합 링크는 틀 안 주소로 옮기고, 다른 온 곳 · 사주풀이는 그대로다', () => {
    expect(withCameFrom('/me/compat?a=p1&b=p2', 'shelf')).toBe('/me/readings/compat?a=p1&b=p2&from=shelf');
    expect(withCameFrom(`/me/match/${MATCH_ID}`, 'shelf', 'match')).toBe(`/me/readings/match/${MATCH_ID}?kind=match&from=shelf`);
    expect(withCameFrom('/me/readings/self', 'shelf')).toBe('/me/readings/self?from=shelf');
    for (const from of CAME_FROM.filter((one) => one !== 'shelf')) {
      expect(withCameFrom('/me/compat?a=p1&b=p2', from)).toBe(`/me/compat?a=p1&b=p2&from=${from}`);
      expect(withCameFrom(`/me/match/${MATCH_ID}`, from)).toBe(`/me/match/${MATCH_ID}?from=${from}`);
    }
  });

  it('틀 안 주소도 결과다 — 궁합은 궁합, 인연은 인연, 사주풀이 id 로 읽지 않는다', () => {
    expect(resultKindOf('/me/readings/compat')).toBe('compat');
    expect(resultKindOf('/me/readings/compat?a=p1&b=p2&from=shelf')).toBe('compat');
    expect(resultKindOf(`/me/readings/match/${MATCH_ID}`)).toBe('match');
    expect(resultKindOf('/me/readings/match')).toBeNull();
    expect(resultKindOf('/me/readings/match/')).toBeNull();
  });

  it('틀 안 주소는 온 곳이 없어도 보관함이다 — 불은 나, ← 는 보관함', () => {
    for (const [kind, pathname] of [
      ['compat', '/me/readings/compat'],
      ['match', `/me/readings/match/${MATCH_ID}`],
    ] as const) {
      const place = placeOf({}, pathname);
      expect(place.from).toBe('shelf');
      expect(lightOf(kind, place.from)).toBe('/me');
      expect(backOf(kind, place).href).toBe('/me/readings');
      /* 실은 온 곳이 있으면 그것이 이긴다 */
      expect(placeOf({ from: 'compat' }, pathname).from).toBe('compat');
    }
    /* 틀 밖 주소 · 사주풀이는 지금처럼 결과 종류의 기본이다 */
    expect(placeOf({}, '/me/compat').from).toBeNull();
    expect(placeOf({}, '/me/readings/self').from).toBeNull();
  });

  it('펼친 글의 표지 — 경로와 두 사람이 같으면 같은 글이고, 온 곳 · 칩은 안 본다', () => {
    expect(isOpenResult('/me/readings/compat?a=p1&b=p2&kind=compat&from=shelf', '/me/readings/compat', 'a=p1&b=p2&from=shelf')).toBe(true);
    expect(isOpenResult('/me/readings/compat?a=p1&b=p3&from=shelf', '/me/readings/compat', 'a=p1&b=p2&from=shelf')).toBe(false);
    expect(isOpenResult('/me/readings/self?from=shelf', '/me/readings/self', 'kind=saju&from=shelf')).toBe(true);
    expect(isOpenResult(`/me/readings/match/${MATCH_ID}?from=shelf`, `/me/readings/match/${MATCH_ID}`, '')).toBe(true);
    expect(isOpenResult('/me/readings/self?from=shelf', '/me/readings', '')).toBe(false);
  });
});
