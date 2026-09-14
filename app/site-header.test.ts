import { describe, expect, it } from 'vitest';

import { isNavigationActive } from './site-header';

describe('회원 내비게이션 활성 상태', () => {
  it('회원 홈은 정확히 /me 에서만 활성화된다', () => {
    expect(isNavigationActive('/me', '/me')).toBe(true);
    expect(isNavigationActive('/me/people', '/me')).toBe(false);
    expect(isNavigationActive('/me/compat', '/me')).toBe(false);
  });

  /**
   * **탭 안에서 움직이면 메뉴는 안 움직인다.** 내 사주의 사주풀이 탭은 주소가
   * `/me/readings` 아래지만 그 탭을 누른 사람은 내 사주에 있다.
   */
  it('내 사주의 사주풀이 탭은 내 사주에 귀속된다', () => {
    expect(isNavigationActive('/me/readings/self', '/me')).toBe(true);
    expect(isNavigationActive('/me/readings/self', '/me/readings')).toBe(false);
    /* 목록과 저장한 사람의 풀이는 그대로 「풀이」다 */
    expect(isNavigationActive('/me/readings', '/me/readings')).toBe(true);
    expect(isNavigationActive('/me/readings', '/me')).toBe(false);
    expect(isNavigationActive('/me/readings/example', '/me/readings')).toBe(true);
  });

  it('하위 상세 화면은 가장 가까운 메뉴가 활성화된다', () => {
    expect(isNavigationActive('/me/match/example', '/me')).toBe(false);
    expect(isNavigationActive('/me/match/example', '/me/readings')).toBe(true);
    expect(isNavigationActive('/me/match/example', '/me/requests')).toBe(false);
    expect(isNavigationActive('/me/people/example', '/me/people')).toBe(true);
  });

  it('사주와 두 궁합 화면은 같은 사주·궁합 메뉴로 묶인다', () => {
    expect(isNavigationActive('/', '/')).toBe(true);
    expect(isNavigationActive('/compat', '/')).toBe(true);
    expect(isNavigationActive('/me/compat', '/')).toBe(true);
  });
});
