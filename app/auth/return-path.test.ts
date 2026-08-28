import { describe, expect, it } from 'vitest';

import { safeReturnPath } from './return-path';

describe('로그인 뒤 돌아갈 경로', () => {
  it('앱 안 경로는 그대로 둔다', () => {
    expect(safeReturnPath('/compat')).toBe('/compat');
    expect(safeReturnPath('/me/people?from=settings')).toBe('/me/people?from=settings');
  });

  it('외부 주소와 프로토콜 상대 주소는 내 사주로 보낸다', () => {
    expect(safeReturnPath('https://example.com')).toBe('/me');
    expect(safeReturnPath('//example.com')).toBe('/me');
    expect(safeReturnPath(undefined)).toBe('/me');
  });
});
