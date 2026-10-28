import { beforeEach, describe, expect, it, vi } from 'vitest';

/** 부른 문을 적고, 문마다 정한 답을 내는 가짜 — 기록하는 두 문은 늘 성공 */
const calls: { fn: string; args: Record<string, unknown> }[] = [];
const answers = new Map<string, { data: unknown; error: { code: string; message: string } | null }>();
/** 세션의 인증 수준 — 운영 액션은 aal2 가 아니면 문을 안 부른다(ADR 0209) */
let aal = 'aal2';
vi.mock('../../auth/server-client', () => ({
  supabaseOnServer: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { aal } }, error: null }) },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return answers.get(fn) ?? { data: null, error: null };
    },
  }),
}));
vi.mock('next/cache', () => ({ refresh: () => {}, revalidatePath: () => {} }));
vi.mock('./portone-cancellations', () => ({ cancellationCheck: vi.fn() }));

const { bookRefund, holdRefund, releaseRefund } = await import('./actions');

const ORDER = '0f8c2a3e-1b4d-4c5e-8f6a-7b8c9d0e1f2a';
const HOLD = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const failing = (code: string) => ({ data: null, error: { code, message: code } });
const notes = () => calls.filter((call) => call.fn.startsWith('note_'));

beforeEach(() => {
  calls.length = 0;
  answers.clear();
  aal = 'aal2';
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

/**
 * **운영자 화면에서 거절된 쓰기는 누가 불렀든 접속기록에 한 줄 선다** (G-111 R-4, ADR 0191).
 *
 * 문을 부르기 전에 거른 것은 운영자인지 아직 모른다 — 두 기록 문을 다 부르고, 둘은 서로의 반대만 적는다(운영자만 `refused`,
 * 운영자가 아닌 사람만 `denied`). 이 시험은 앱이 둘 다 부르는지를, `99_operator_write_refusals` 「두 문을 함께」가 둘 중 하나만
 * 적는지를 잰다.
 */
describe('환불 누름의 거절 기록', () => {
  it('2단계 인증 전의 세션(aal1)이면 세 누름 다 문을 안 부르고 denied 한 줄만 적는다', async () => {
    aal = 'aal1';
    const answers = [
      await holdRefund({ orderId: ORDER, credits: 1, reason: 'other', expectedAmount: 0, requestId: HOLD }),
      await bookRefund({ orderId: ORDER, holdId: HOLD, refundId: 'pg-1' }),
      await releaseRefund({ orderId: ORDER, holdId: HOLD }),
    ];
    expect(answers.every((answer) => !answer.ok)).toBe(true);
    expect(calls.map((call) => call.args.p_action)).toEqual([
      'credits.refund_hold',
      'credits.refund_book',
      'credits.refund_release',
    ]);
    expect(calls.every((call) => call.fn === 'note_operator_denial')).toBe(true);
  });

  it('확보 — 모양으로 거른 것은 두 기록 문을 다 부른다(운영자가 아니어도 denied 로 선다)', async () => {
    const answer = await holdRefund({ orderId: ORDER, credits: 0, reason: 'other', expectedAmount: 0, requestId: HOLD });
    expect(answer.ok).toBe(false);
    expect(notes()).toEqual([
      { fn: 'note_operator_refusal', args: { p_action: 'credits.refund_hold', p_code: '22023', p_order_id: ORDER } },
      { fn: 'note_operator_denial', args: { p_action: 'credits.refund_hold' } },
    ]);
  });

  it('확정 — 취소 번호가 비었는데 주문 읽기가 42501 이면 그 읽기도 denied 로 남긴다', async () => {
    answers.set('operator_reading_refund_hold', failing('42501'));
    const answer = await bookRefund({ orderId: ORDER, holdId: HOLD, refundId: '  ' });
    expect(answer.ok).toBe(false);
    expect(notes()).toEqual([
      { fn: 'note_operator_denial', args: { p_action: 'credits.refund_status' } },
      { fn: 'note_operator_refusal', args: { p_action: 'credits.refund_book', p_code: '22023' } },
      { fn: 'note_operator_denial', args: { p_action: 'credits.refund_book' } },
    ]);
  });

  it('준비 취소 — 확보 읽기가 42501 밖의 코드로 실패하면 refused 로 남긴다', async () => {
    answers.set('operator_reading_refund_hold', failing('57014'));
    const answer = await releaseRefund({ orderId: ORDER, holdId: HOLD });
    expect(answer.ok).toBe(false);
    expect(notes()).toEqual([
      { fn: 'note_operator_refusal', args: { p_action: 'credits.refund_release', p_code: '57014', p_order_id: ORDER } },
      { fn: 'note_operator_denial', args: { p_action: 'credits.refund_release' } },
    ]);
  });

  it('준비 취소 — 확보 읽기가 42501 이면 그 읽기의 denied 하나', async () => {
    answers.set('operator_reading_refund_hold', failing('42501'));
    await releaseRefund({ orderId: ORDER, holdId: HOLD });
    expect(notes()).toEqual([{ fn: 'note_operator_denial', args: { p_action: 'credits.refund_status' } }]);
  });
});
