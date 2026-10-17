import { describe, expect, it } from 'vitest';

import { bookRefusalTarget } from './book-refusal';

const ORDER = '0f8c2a3e-1b4d-4c5e-8f6a-7b8c9d0e1f2a';
const HOLD = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

/** 진행 중인 확보 읽기만 답하는 가짜 — 부른 문을 적는다 */
const reading = (answer: { data: { hold_id: string }[] | null; error: { code: string } | null }) => {
  const calls: string[] = [];
  const supabase = {
    rpc: async (fn: string) => {
      calls.push(fn);
      return answer;
    },
  } as unknown as Parameters<typeof bookRefusalTarget>[0];
  return { calls, supabase };
};

describe('확정의 거절 줄이 가리킬 주문 (G-111 R-4)', () => {
  it('그 주문의 진행 중인 확보가 이 확보면 주문 id 를 싣는다', async () => {
    const { supabase } = reading({ data: [{ hold_id: HOLD }], error: null });
    expect(await bookRefusalTarget(supabase, '55000', { orderId: ORDER, holdId: HOLD })).toEqual({ orderId: ORDER });
  });

  it('확보가 닫혔거나 다른 확보면 싣지 않는다 — 화면이 든 주문 id 를 그대로 믿지 않는다', async () => {
    const { supabase } = reading({ data: [{ hold_id: ORDER }], error: null });
    expect(await bookRefusalTarget(supabase, '55000', { orderId: ORDER, holdId: HOLD })).toEqual({});
  });

  it('읽기가 실패하면 싣지 않는다', async () => {
    const { supabase } = reading({ data: null, error: { code: '22P02' } });
    expect(await bookRefusalTarget(supabase, '22023', { orderId: 'x', holdId: HOLD })).toEqual({});
  });

  it('42501 이면 읽지 않는다 — 그 줄은 denied 다', async () => {
    const { calls, supabase } = reading({ data: [{ hold_id: HOLD }], error: null });
    expect(await bookRefusalTarget(supabase, '42501', { orderId: ORDER, holdId: HOLD })).toEqual({});
    expect(calls).toEqual([]);
  });
});
