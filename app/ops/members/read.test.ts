import { describe, expect, it } from 'vitest';

import type { RpcRow } from '@/src/lib/db';

import { QUERY_MAX, memberOf, queryOf } from './read';

describe('회원 찾기의 찾는 말 (G-110 ③)', () => {
  it('앞뒤 빈칸을 걷는다', () => {
    expect(queryOf('  달빛 ')).toBe('달빛');
  });

  it('없거나 비었으면 null — 문은 운영자인가만 묻는다', () => {
    expect(queryOf(undefined)).toBeNull();
    expect(queryOf('   ')).toBeNull();
  });

  it('같은 이름이 여럿이면 첫 값만', () => {
    expect(queryOf(['달빛', '별빛'])).toBe('달빛');
  });

  it('DB 가 안 받는 길이는 묻지 않는다', () => {
    expect(queryOf('가'.repeat(QUERY_MAX))).toHaveLength(QUERY_MAX);
    expect(queryOf('가'.repeat(QUERY_MAX + 1))).toBeNull();
  });
});

describe('회원 한 명 — 생성 타입이 null 아님으로 적는 칸', () => {
  it('닉네임이 비면 null 로 받는다', () => {
    const row = {
      user_id: '00000000-0000-4000-8000-0000000000aa',
      nickname: null,
      status: 'active',
      bought_credits: 4,
      refunded_credits: 1,
      used_bought: 1,
      reserved_bought: 0,
      used_all: 3,
      order_numbers: null,
      available: 6,
      free_credits: 5,
      free_used: 2,
      free_left: 2,
      granted_credits: 2,
      granted_used: 0,
      granted_left: 2,
      bundle_left: 2,
      reserved_all: 1,
      held_credits: 0,
      outside_used: 1,
    } as unknown as RpcRow<'operator_member'>;
    expect(memberOf(row)).toEqual({
      userId: '00000000-0000-4000-8000-0000000000aa',
      nickname: null,
      status: 'active',
      credits: {
        available: 6,
        free: { received: 5, used: 2, left: 2 },
        granted: { received: 2, used: 0, left: 2 },
        bought: { received: 4, used: 1, left: 2, refunded: 1 },
        reserved: 1,
        held: 0,
        usedAll: 3,
        outsideUsed: 1,
      },
      orderNumbers: [],
    });
  });
});
