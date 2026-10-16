import { describe, expect, it } from 'vitest';

import type { RpcRow } from '@/src/lib/db';

import { orderLineOf, refundForAllUnused } from './read';

const row = (over: Partial<RpcRow<'operator_reading_refund_basis'>> = {}): RpcRow<'operator_reading_refund_basis'> => ({
  order_id: '0f1e2d3c-4b5a-4968-8776-655443322110',
  asked: true,
  status: 'approved',
  provider: 'portone',
  provider_order_id: 'rdo_0f1e2d3c4b5a49688776655443322110',
  provider_payment_id: 'tx-1',
  amount: 59000,
  currency: 'KRW',
  refunded_amount: 0,
  ordered_at: '2026-10-16T05:00:00Z',
  approved_at: '2026-10-16T05:01:00Z',
  credits: 20,
  refunded_credits: 0,
  used: 3,
  reserved: 0,
  unused: 17,
  first_used_at: '2026-10-16T06:00:00Z',
  last_used_at: '2026-10-16T07:00:00Z',
  ...over,
});

describe('주문 화면의 문', () => {
  it('결제된 주문은 묶음 · 유효기간(산 날부터 5년)과 함께 옮긴다', () => {
    const line = orderLineOf(row());
    expect(line.orderNumber).toBe('rdo_0f1e2d3c4b5a49688776655443322110');
    expect(line.bundle).toEqual({ credits: 20, refundedCredits: 0, used: 3, reserved: 0, unused: 17, validUntil: '2031-10-16' });
  });

  it('결제 전 주문은 묶음이 없다 — 비는 칸을 null 로 받는다', () => {
    const pending = row({
      status: 'pending',
      approved_at: null as unknown as string,
      provider_payment_id: null as unknown as string,
      credits: null as unknown as number,
    });
    const line = orderLineOf(pending);
    expect(line.bundle).toBeNull();
    expect(line.paymentId).toBeNull();
    expect(refundForAllUnused(line)).toBe(0);
  });

  it('안 쓴 것을 다 걷는 금액은 환불정책의 예시와 같다 — 20장 묶음에서 3장 썼으면 50,150원', () => {
    expect(refundForAllUnused(orderLineOf(row()))).toBe(50150);
  });

  it('이미 나눠 돌려준 주문은 누적으로 셈한다 — 남은 몫을 다 걷으면 합이 결제액이다', () => {
    const line = orderLineOf(row({ status: 'partially_refunded', refunded_amount: 2950, refunded_credits: 1, unused: 16 }));
    expect(2950 + refundForAllUnused(line)).toBe(Math.floor((59000 * 17) / 20));
  });
});
