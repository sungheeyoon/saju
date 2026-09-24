import { describe, expect, it } from 'vitest';

import { isNavigationActive } from './site-header';

describe('회원 내비게이션 활성 상태', () => {
  it('홈은 /me 와 거기서 뻗는 사람 · 사주 · 궁합의 길에서 켜진다', () => {
    expect(isNavigationActive('/me', '/me')).toBe(true);
    expect(isNavigationActive('/me/people', '/me')).toBe(true);
    expect(isNavigationActive('/me/people/example', '/me')).toBe(true);
    expect(isNavigationActive('/compat', '/me')).toBe(true);
    expect(isNavigationActive('/me/compat', '/me')).toBe(true);
    expect(isNavigationActive('/', '/me')).toBe(true);
    /* 이름이 비슷해도 다른 길이다 */
    expect(isNavigationActive('/me/matching', '/me')).toBe(false);
    expect(isNavigationActive('/me/peoplex', '/me')).toBe(false);
  });

  /**
   * **탭 안에서 움직이면 메뉴는 안 움직인다.** 내 사주의 사주풀이 탭은 주소가
   * `/me/readings` 아래지만 그 탭을 누른 사람은 홈에 있다.
   */
  it('내 사주의 사주풀이 탭은 홈에 귀속된다', () => {
    expect(isNavigationActive('/me/readings/self', '/me')).toBe(true);
    expect(isNavigationActive('/me/readings/self', '/me/readings')).toBe(false);
    /* 목록과 저장한 사람의 풀이는 그대로 「풀이」다 */
    expect(isNavigationActive('/me/readings', '/me/readings')).toBe(true);
    expect(isNavigationActive('/me/readings', '/me')).toBe(false);
    expect(isNavigationActive('/me/readings/example', '/me/readings')).toBe(true);
  });

  it('함께 보는 궁합은 풀이, 대화방은 채팅, 소식은 종에서 켜진다', () => {
    expect(isNavigationActive('/me/match/example', '/me')).toBe(false);
    expect(isNavigationActive('/me/match/example', '/me/readings')).toBe(true);
    expect(isNavigationActive('/me/match/example', '/me/matching')).toBe(false);
    expect(isNavigationActive('/me/chat/example', '/me/chat')).toBe(true);
    expect(isNavigationActive('/me/chat', '/me/chat')).toBe(true);
    expect(isNavigationActive('/me/requests', '/me/requests')).toBe(true);
    expect(isNavigationActive('/me/requests', '/me')).toBe(false);
  });

  it('톱니 안의 화면은 어느 탭도 켜지 않는다', () => {
    for (const pathname of ['/me/profile', '/me/settings', '/me/survey']) {
      for (const href of ['/me', '/me/matching', '/me/readings', '/me/chat', '/me/requests']) {
        expect(isNavigationActive(pathname, href)).toBe(false);
      }
    }
  });
});
