import { describe, expect, it } from 'vitest';

import { accountLabel } from './account-label';

describe('운영자 화면이 가리키는 계정', () => {
  it('닉네임 · 계정 id 앞 8자이고, 닉네임이 없으면 「닉네임 없음」', () => {
    const user = '3f2a9c1e-7b4d-4e2a-9c1e-7b4d4e2a9c1e';
    expect(accountLabel('달빛', user)).toBe('달빛 · 3f2a9c1e');
    expect(accountLabel(null, user)).toBe('닉네임 없음 · 3f2a9c1e');
  });

  it('주문 문이 내린 앞 8자를 받아도 같은 글자다', () => {
    expect(accountLabel('하늘', '2658fc70')).toBe('하늘 · 2658fc70');
  });
});
