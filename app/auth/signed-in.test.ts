import { beforeEach, describe, expect, it, vi } from 'vitest';

const pending: Promise<unknown>[] = [];
vi.mock('next/server', () => ({ after: (task: Promise<unknown>) => pending.push(task) }));

import { signedInUser } from './signed-in';

/**
 * 화면의 로그인 확인은 **쿠키의 서명**이고, 확인된 사람의 화면이 그려질 때 활동을 적는다(ADR 0117 · 0118).
 *
 * 서명 확인 자체는 라이브러리(`getClaims`)의 것이라 여기서 다시 재지 않는다 — 재는 것은 이 자리가 그
 * 답을 어떻게 읽는가다: 답이 없으면 아무도 아니고, 아무도 아닌 요청은 활동을 적지 않는다.
 */
const client = (claims: { sub: string; email?: string } | null) => {
  const rpc = vi.fn(async () => ({ data: true, error: null }));
  const getClaims = vi.fn(async () =>
    claims === null
      ? { data: null, error: new Error('invalid') }
      : { data: { claims, header: {}, signature: new Uint8Array() }, error: null },
  );
  return { rpc, getClaims, supabase: { auth: { getClaims }, rpc } as never };
};

beforeEach(() => {
  pending.length = 0;
});

describe('signedInUser', () => {
  it('서명이 확인되면 그 토큰의 사람이고, 활동을 한 번 적는다', async () => {
    const { supabase, rpc, getClaims } = client({ sub: 'u-1', email: 'a@example.com' });

    await expect(signedInUser(supabase)).resolves.toEqual({ id: 'u-1', email: 'a@example.com' });
    await Promise.all(pending);

    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('touch_activity');
    expect(pending).toHaveLength(1);
  });

  it('서명이 확인되지 않으면 아무도 아니고, 활동을 적지 않는다', async () => {
    const { supabase, rpc } = client(null);

    await expect(signedInUser(supabase)).resolves.toBeNull();

    expect(rpc).not.toHaveBeenCalled();
    expect(pending).toHaveLength(0);
  });
});
