import { describe, expect, it } from 'vitest';

import { LOWERCASE_UUID, UUID } from './uuid';

describe('id 의 모양', () => {
  const lower = '0b6f3c1e-8a2d-4c5e-9f10-2b3c4d5e6f70';

  it('주소의 id 는 대소문자를 가리지 않는다', () => {
    expect(UUID.test(lower)).toBe(true);
    expect(UUID.test(lower.toUpperCase())).toBe(true);
  });

  it('서버가 내준 id 를 돌려받는 자리는 소문자만 받는다 — 옛 세션 id 정규식과 같다', () => {
    expect(LOWERCASE_UUID.test(lower)).toBe(true);
    expect(LOWERCASE_UUID.test(lower.toUpperCase())).toBe(false);
    expect(LOWERCASE_UUID.test(`${lower}0`)).toBe(false);
    expect(LOWERCASE_UUID.test(` ${lower}`)).toBe(false);
  });
});
