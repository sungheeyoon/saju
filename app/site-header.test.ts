import { describe, expect, it } from 'vitest';

import { isNavigationActive } from './site-header';

const TABS = ['/me', '/compat', '/me/matching', '/me/chat'] as const;

/** 그 화면에서 켜지는 탭 — 넷 중 **하나뿐**이어야 한다. 둘이 켜지면 사용자는 어디 있는지 모른다 */
function activeTabs(pathname: string): string[] {
  return TABS.filter((href) => isNavigationActive(pathname, href));
}

describe('회원 내비게이션 활성 상태 (ADR 0126)', () => {
  it('나는 /me 와 저장한 사람 · 한 사람 풀이 · 로그인한 사람의 사주 계산에서 켜진다', () => {
    for (const pathname of ['/me', '/me/people', '/me/people/example', '/me/readings/self', '/me/readings/example', '/']) {
      expect(activeTabs(pathname), pathname).toEqual(['/me']);
    }
    /* 이름이 비슷해도 다른 길이다 */
    expect(isNavigationActive('/me/peoplex', '/me')).toBe(false);
    expect(isNavigationActive('/me/readingsx', '/me')).toBe(false);
  });

  /**
   * **풀이 보관함은 탭 소속이 없는 전체 기록이다**(ADR 0133). 궁합 탭 · 인연 탭의 「모두 보기」가 필터를 달고 오는데,
   * 거기서 나 탭이 켜지면 사용자는 궁합을 보다가 나로 옮겨 온 줄 안다. 제목이 위치를 말한다.
   */
  it('풀이 보관함 목록은 어느 탭도 안 켠다 — 그 안에서 연 한 사람 풀이는 나다', () => {
    expect(activeTabs('/me/readings')).toEqual([]);
    expect(activeTabs('/me/readings/self')).toEqual(['/me']);
  });

  /**
   * **글이 어디서 열렸나가 아니라 무엇인가로 켠다.** 책장에서 연 궁합도 궁합 탭, 책장에서 연 인연 궁합도 인연 탭이다.
   */
  it('궁합은 두 사람을 고르는 자리와 그 결과에서 켜진다', () => {
    expect(activeTabs('/compat')).toEqual(['/compat']);
    expect(activeTabs('/me/compat')).toEqual(['/compat']);
  });

  it('인연은 오늘의 인연과 동의로 열린 궁합에서 켜진다', () => {
    expect(activeTabs('/me/matching')).toEqual(['/me/matching']);
    expect(activeTabs('/me/match/example')).toEqual(['/me/matching']);
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
