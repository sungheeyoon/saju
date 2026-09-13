import { describe, expect, it } from 'vitest';

import { SHARE_ROOT, isSharePath, sharePath } from './path';

describe('공유본 주소', () => {
  it('토큰이 주소의 마지막 칸이다', () => {
    expect(sharePath('abc123')).toBe('/share/readings/abc123');
  });

  it('헤더는 공유 화면을 알아본다', () => {
    expect(isSharePath(sharePath('abc123'))).toBe(true);
    expect(isSharePath(SHARE_ROOT)).toBe(true);
  });

  /**
   * 앞자리가 같다고 공유 화면이 아니다. 이 판정이 넓으면 **회원 화면의 헤더가
   * 조용히 접힌다** — 길이 사라졌는데 아무 데도 적히지 않는 고장이다.
   */
  it('앞자리만 같은 주소는 공유 화면이 아니다', () => {
    expect(isSharePath('/share/readingsomething')).toBe(false);
    expect(isSharePath('/me/readings/self')).toBe(false);
    expect(isSharePath('/')).toBe(false);
  });
});
