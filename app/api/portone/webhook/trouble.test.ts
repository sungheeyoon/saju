import { afterEach, describe, expect, it, vi } from 'vitest';

import { TROUBLE_TIMEOUT_MS, tellTrouble, troubleArgs, type SendTrouble, type TroubleArgs } from './trouble';

/**
 * **결제 이상 알림은 Production 에서만, DB 가 받는 모양으로, 실패는 삼킨다** (G-110 ④).
 *
 * 가짜는 부르는 손 하나다. DB 쪽 — 누가 부를 수 있나 · 모양이 틀리면 던지나 · 결제마다 하루 한 줄 — 은
 * `95_payment_trouble_alerts` 가 잰다.
 */

const PAYMENT_ID = 'rdo_0f1e2d3c4b5a49688776655443322110';
const MISMATCH = { kind: 'amount-mismatch', paymentId: PAYMENT_ID } as const;

const sendOf = (answer: () => Promise<{ error: { code?: string } | null }>) => {
  const sent: { args: TroubleArgs; signal: AbortSignal }[] = [];
  const send: SendTrouble = (args, signal) => {
    sent.push({ args, signal });
    return answer();
  };
  return { send, sent };
};

afterEach(() => vi.restoreAllMocks());

describe('troubleArgs', () => {
  it('갈래 · 결제 번호 · 까닭을 그대로 옮긴다', () => {
    expect(troubleArgs(MISMATCH, 'approve refused - amount differs (paid 100)')).toEqual({
      p_kind: 'amount-mismatch',
      p_payment_id: PAYMENT_ID,
      p_reason: 'approve refused - amount differs (paid 100)',
    });
  });

  it('짧은 토큰이 아닌 결제 번호는 싣지 않는다', () => {
    const args = troubleArgs({ kind: 'paid-without-bundle', paymentId: 'order from elsewhere; drop' }, 'not a reading order');
    expect(args.p_payment_id).toBeNull();
  });

  it('까닭의 ASCII 밖 글자는 ? 로 메우고 200자에서 자른다 — 비면 갈래 이름이다', () => {
    const noKey = troubleArgs(MISMATCH, 'approve: 서버에 결제 승인 열쇠가 없습니다 (SUPABASE_SECRET_KEY)');
    expect(noKey.p_reason).toBe('approve: ? ? ? ? ? (SUPABASE_SECRET_KEY)');
    expect(troubleArgs(MISMATCH, 'x'.repeat(300)).p_reason).toHaveLength(200);
    expect(troubleArgs(MISMATCH, null).p_reason).toBe('amount-mismatch');
    expect(troubleArgs(MISMATCH, '열쇠').p_reason).toBe('?');
  });
});

describe('tellTrouble', () => {
  it(`Production 에서 ${TROUBLE_TIMEOUT_MS}ms 시간 제한을 걸고 보낸다`, async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const { send, sent } = sendOf(async () => ({ error: null }));
    await tellTrouble(MISMATCH, 'approve refused - amount differs (paid 100)', send, 'production');
    expect(sent.map((one) => one.args)).toEqual([
      { p_kind: 'amount-mismatch', p_payment_id: PAYMENT_ID, p_reason: 'approve refused - amount differs (paid 100)' },
    ]);
    expect(timeout).toHaveBeenCalledWith(TROUBLE_TIMEOUT_MS);
  });

  it('Preview · 로컬에서는 안 보낸다 — 샌드박스 결제가 알림함에 서지 않게', async () => {
    const { send, sent } = sendOf(async () => ({ error: null }));
    await tellTrouble(MISMATCH, 'x', send, 'preview');
    await tellTrouble(MISMATCH, 'x', send, undefined);
    expect(sent).toEqual([]);
  });

  it('문이 거절하거나 던져도 삼키고 로그에 한 줄 남긴다 — 결제 알림의 답을 바꾸지 않는다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const refused = sendOf(async () => ({ error: { code: '22023' } }));
    await expect(tellTrouble(MISMATCH, 'x', refused.send, 'production')).resolves.toBeUndefined();
    const thrown = sendOf(async () => Promise.reject(new TypeError('fetch failed')));
    await expect(tellTrouble(MISMATCH, 'x', thrown.send, 'production')).resolves.toBeUndefined();
    const noKey: SendTrouble = () => {
      throw new Error('서버에 결제 이상 알림 열쇠가 없습니다');
    };
    await expect(tellTrouble(MISMATCH, 'x', noKey, 'production')).resolves.toBeUndefined();
    expect(logged.mock.calls).toEqual([
      ['portone webhook: report_payment_trouble', '22023'],
      ['portone webhook: report_payment_trouble', 'TypeError'],
      ['portone webhook: report_payment_trouble', 'Error'],
    ]);
  });
});
