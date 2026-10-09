import { describe, expect, it } from 'vitest';

import { dockStandsOn, isNavigationActive } from './site-header';

const TABS = ['/me', '/compat', '/me/matching', '/me/chat'] as const;

/** 그 화면에서 켜지는 탭 — 넷 중 **하나뿐**이어야 한다. 둘이 켜지면 사용자는 어디 있는지 모른다 */
function activeTabs(pathname: string, from: string | null = null): string[] {
  return TABS.filter((href) => isNavigationActive(pathname, href, from));
}

describe('회원 내비게이션 활성 상태 (ADR 0126 · 0134 · 0144)', () => {
  it('홈은 /me 와 저장한 사람 · 풀이 보관함 · 로그인한 사람의 사주 계산(/saju)에서 켜진다', () => {
    for (const pathname of ['/me', '/me/people', '/me/people/example', '/me/readings', '/saju']) {
      expect(activeTabs(pathname), pathname).toEqual(['/me']);
    }
    /* `/` 는 로그인 전 첫 화면이다 — 회원은 거기 머물지 않으므로 어느 탭도 안 켠다 */
    expect(activeTabs('/')).toEqual([]);
    /* 이름이 비슷해도 다른 길이다 */
    expect(isNavigationActive('/me/peoplex', '/me')).toBe(false);
    expect(isNavigationActive('/me/readingsx', '/me')).toBe(false);
  });

  /**
   * **보관함 목록은 홈 탭이다**(2026-09-29 운영자, ADR 0133 을 뒤집음). 궁합 탭의 「모두 보기」가 `from=compat` 을 달고
   * 와도 목록은 결과 화면이 아니라 온 곳을 안 읽는다.
   */
  it('풀이 보관함 목록은 어느 칸 · 어느 온 곳이든 나를 켠다', () => {
    for (const from of [null, 'compat', 'matching', 'chat', 'shelf']) {
      expect(activeTabs('/me/readings', from), String(from)).toEqual(['/me']);
    }
  });

  it('궁합은 두 사람을 고르는 자리, 인연은 오늘의 인연과 그 아래(인연 기록)에서 켜진다', () => {
    expect(activeTabs('/compat')).toEqual(['/compat']);
    expect(activeTabs('/me/matching')).toEqual(['/me/matching']);
    expect(activeTabs('/me/matching/history')).toEqual(['/me/matching']);
  });

  /**
   * **결과 화면 셋은 온 곳의 탭을 켠다**(ADR 0134). 표의 줄 = 결과 × 온 곳. 소식에서 연 글은 탭이 아니라 종이 켜진다.
   */
  const RESULTS = [
    ['/me/readings/self', 'saju'],
    ['/me/readings/example', 'saju'],
    ['/me/compat', 'compat'],
    ['/me/match/example', 'match'],
  ] as const;
  const LIGHTS: Record<string, string[]> = {
    me: ['/me'],
    shelf: ['/me'],
    compat: ['/compat'],
    matching: ['/me/matching'],
    history: ['/me/matching'],
    chat: ['/me/chat'],
    news: [],
  };
  it.each(RESULTS)('%s 는 온 곳의 탭을 켠다', (pathname) => {
    for (const [from, tabs] of Object.entries(LIGHTS)) {
      expect(activeTabs(pathname, from), `${pathname} from=${from}`).toEqual(tabs);
    }
    expect(isNavigationActive(pathname, '/me/requests', 'news')).toBe(true);
    expect(isNavigationActive(pathname, '/me/requests', 'me')).toBe(false);
  });

  it('온 곳이 없거나 모르는 값이면 결과 종류의 탭이다 — 사주는 홈, 궁합은 궁합, 인연은 인연', () => {
    const DEFAULT: Record<(typeof RESULTS)[number][1], string> = { saju: '/me', compat: '/compat', match: '/me/matching' };
    for (const [pathname, kind] of RESULTS) {
      for (const from of [null, '', 'nope', 'https://evil.example', '//evil', 'ME', 'me ']) {
        expect(activeTabs(pathname, from), `${pathname} from=${from}`).toEqual([DEFAULT[kind]]);
      }
    }
  });

  it('결과 화면이 아닌 곳은 온 곳을 안 읽는다', () => {
    expect(activeTabs('/me', 'chat')).toEqual(['/me']);
    expect(activeTabs('/compat', 'matching')).toEqual(['/compat']);
    expect(activeTabs('/me/chat/example', 'me')).toEqual(['/me/chat']);
  });

  it('대화방은 채팅, 소식은 종에서 켜진다', () => {
    expect(activeTabs('/me/chat')).toEqual(['/me/chat']);
    expect(activeTabs('/me/chat/example')).toEqual(['/me/chat']);
    expect(activeTabs('/me/requests')).toEqual([]);
    expect(isNavigationActive('/me/requests', '/me/requests')).toBe(true);
  });

  it('톱니 안의 화면은 어느 탭도 켜지 않는다', () => {
    for (const pathname of ['/me/profile', '/me/settings', '/me/survey']) {
      expect(activeTabs(pathname), pathname).toEqual([]);
      expect(isNavigationActive(pathname, '/me/requests')).toBe(false);
    }
  });
});

describe('폰의 하단 독이 서는 화면 (화면 점검 2026-10-10 C5)', () => {
  it('대화방 하나에서만 안 서고, 대화방 목록과 그 밖의 화면에서는 선다', () => {
    for (const pathname of ['/me/chat/abc', '/me/chat/94da8469-8925-4426-890e-d3a2fdfaec77', '/me/chat/abc/']) {
      expect(dockStandsOn(pathname), pathname).toBe(false);
    }
    for (const pathname of ['/me/chat', '/me/chat/', '/me', '/me/matching', '/me/match/abc', '/compat', '/me/chatx/abc']) {
      expect(dockStandsOn(pathname), pathname).toBe(true);
    }
  });
});
