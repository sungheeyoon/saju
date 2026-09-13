import { describe, expect, it } from 'vitest';

import { SHARE_ROOTS, isSharePath, sharePath } from './path';

describe('공유본 주소', () => {
  it('갈래마다 주소가 다르고 토큰이 마지막 칸이다', () => {
    expect(sharePath('self', 'abc123')).toBe('/share/readings/abc123');
    expect(sharePath('person', 'abc123')).toBe('/share/people/abc123');
    expect(sharePath('private', 'abc123')).toBe('/share/compat/abc123');
  });

  /**
   * **이 주소는 안 바꾼다.** 이미 뿌려진 링크가 여기 있고, 받은 사람의 대화창에
   * 남아 있는 주소를 우리가 되돌릴 방법이 없다.
   */
  it('내 사주풀이의 주소는 처음 그대로다', () => {
    expect(SHARE_ROOTS.self).toBe('/share/readings');
  });

  it('헤더는 세 주소를 다 알아본다', () => {
    for (const root of Object.values(SHARE_ROOTS)) {
      expect(isSharePath(root)).toBe(true);
      expect(isSharePath(`${root}/abc123`)).toBe(true);
    }
  });

  /**
   * 앞자리가 같다고 공유 화면이 아니다. 이 판정이 넓으면 **회원 화면의 헤더가
   * 조용히 접힌다** — 길이 사라졌는데 아무 데도 적히지 않는 고장이다.
   */
  it('앞자리만 같은 주소는 공유 화면이 아니다', () => {
    expect(isSharePath('/share/readingsomething')).toBe(false);
    expect(isSharePath('/share/peopleish')).toBe(false);
    expect(isSharePath('/me/readings/self')).toBe(false);
    expect(isSharePath('/me/compat')).toBe(false);
    expect(isSharePath('/')).toBe(false);
  });
});
