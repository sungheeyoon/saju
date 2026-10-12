import { describe, expect, it } from 'vitest';

import { paidOrderOf } from './orders';

const ROW = {
  provider_order_id: 'rdo_0f1e2d3c4b5a49688776655443322110',
  bundle_credits: 3,
  amount: 12900,
  refunded_amount: 4300,
  status: 'partially_refunded',
  paid_at: '2026-10-12T05:03:00+00:00',
  remaining: 2,
};

describe('결제 내역 한 줄 (G-21, ADR 0174)', () => {
  it('주문 번호 · 상품 · 금액 · 상태 · 남은 회차를 화면의 말로 옮긴다', () => {
    expect(paidOrderOf(ROW)).toMatchObject({
      orderNumber: 'rdo_0f1e2d3c4b5a49688776655443322110',
      product: '풀이권 3장',
      amount: 12900,
      refundedAmount: 4300,
      status: '부분 환불',
      remaining: 2,
    });
  });

  it('유효기간은 결제한 서울 날짜부터 5년 뒤 같은 날까지다', () => {
    expect(paidOrderOf(ROW).validUntil).toBe('2031년 10월 12일');
    expect(paidOrderOf({ ...ROW, paid_at: '2026-10-12T15:30:00+00:00' }).validUntil).toBe('2031년 10월 13일');
  });

  it('결제 시각은 한국 시간이다', () => {
    expect(paidOrderOf(ROW).paidAt).toContain('2026. 10. 12.');
    expect(paidOrderOf(ROW).paidAt).toContain('2:03');
  });

  it('승인 · 전액 환불도 제 이름으로 읽힌다', () => {
    expect(paidOrderOf({ ...ROW, status: 'approved', refunded_amount: 0 }).status).toBe('결제 완료');
    expect(paidOrderOf({ ...ROW, status: 'refunded', refunded_amount: 12900, remaining: 0 }).status).toBe('전액 환불');
  });
});
