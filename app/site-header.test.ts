import { describe, expect, it } from 'vitest';

import { isNavigationActive } from './site-header';

describe('회원 내비게이션 활성 상태', () => {
  it('회원 홈은 정확히 /me 에서만 활성화된다', () => {
    expect(isNavigationActive('/me', '/me')).toBe(true);
    expect(isNavigationActive('/me/people', '/me')).toBe(false);
    expect(isNavigationActive('/me/compat', '/me')).toBe(false);
  });

  it('하위 상세 화면은 가장 가까운 메뉴가 활성화된다', () => {
    expect(isNavigationActive('/me/match/example', '/me')).toBe(false);
    expect(isNavigationActive('/me/match/example', '/me/requests')).toBe(true);
    expect(isNavigationActive('/me/people/example', '/me/people')).toBe(true);
  });

  it('직접 입력과 저장한 사람 궁합은 같은 궁합 메뉴로 묶인다', () => {
    expect(isNavigationActive('/compat', '/compat')).toBe(true);
    expect(isNavigationActive('/me/compat', '/compat')).toBe(true);
  });
});
