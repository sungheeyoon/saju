import { describe, expect, it } from 'vitest';

import { noteWriteRefusal, refusalCode } from './denial';

/** 부른 문과 인자만 받아 적는 가짜 — 답은 늘 성공 */
const recorder = () => {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const supabase = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data: null, error: null };
    },
  } as unknown as Parameters<typeof noteWriteRefusal>[0];
  return { calls, supabase };
};

const MEMBER = '0f8c2a3e-1b4d-4c5e-8f6a-7b8c9d0e1f2a';

describe('거절된 쓰기의 접속기록 (G-111 R-4)', () => {
  it('운영자가 아니면(42501) 지금처럼 denied 의 문으로 간다', async () => {
    const { calls, supabase } = recorder();
    await noteWriteRefusal(supabase, 'reports.review', '42501', { reportId: MEMBER });
    expect(calls).toEqual([{ fn: 'note_operator_denial', args: { p_action: 'reports.review', p_report_id: MEMBER } }]);
  });

  it('버전 충돌 · 상태 거절 · 모양은 refused 의 문으로 — 코드와 id 만', async () => {
    const { calls, supabase } = recorder();
    await noteWriteRefusal(supabase, 'members.suspend', '55000', { userId: MEMBER });
    expect(calls[0]).toEqual({
      fn: 'note_operator_refusal',
      args: { p_action: 'members.suspend', p_code: '55000', p_user_id: MEMBER },
    });
  });

  it('42501 밖의 코드는 denied 의 문도 부른다 — 누가 불렀는지 모르니 반대만 적는 두 문이 한 줄을 세운다', async () => {
    const { calls, supabase } = recorder();
    await noteWriteRefusal(supabase, 'reports.review', '22023', { reportId: MEMBER });
    expect(calls.map((call) => call.fn)).toEqual(['note_operator_refusal', 'note_operator_denial']);
    expect(calls[1].args).toEqual({ p_action: 'reports.review', p_report_id: MEMBER });
  });

  it('모양이 틀린 id 는 싣지 않는다 — 거절을 적는 부름이 다시 거절되지 않게', async () => {
    const { calls, supabase } = recorder();
    await noteWriteRefusal(supabase, 'credits.grant', '22023', { userId: 'not-a-uuid' });
    expect(calls[0].args).toEqual({ p_action: 'credits.grant', p_code: '22023' });
  });

  it('SQLSTATE 가 아닌 코드는 other', () => {
    expect(refusalCode('23514')).toBe('23514');
    expect(refusalCode('P0002')).toBe('P0002');
    expect(refusalCode('PGRST202')).toBe('other');
    expect(refusalCode(undefined)).toBe('other');
  });
});
