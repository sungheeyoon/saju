import { describe, expect, it } from 'vitest';

import { paymentOutcomeOf, paymentReturnOf, portoneCheckoutOf } from './payment';

const ORDER = '0f1e2d3c-4b5a-4968-8776-655443322110';
const PAYMENT_ID = `rdo_${ORDER.replaceAll('-', '')}`;

describe('결제창 값 (G-21, ADR 0171)', () => {
  it('상점 번호와 채널 키가 둘 다 있어야 결제창 값이 선다', () => {
    expect(portoneCheckoutOf({ PORTONE_STORE_ID: 'store-1', PORTONE_CHANNEL_KEY: 'channel-key-1' })).toEqual({
      storeId: 'store-1',
      channelKey: 'channel-key-1',
    });
    expect(portoneCheckoutOf({ PORTONE_STORE_ID: 'store-1', PORTONE_CHANNEL_KEY: undefined })).toBeNull();
    expect(portoneCheckoutOf({ PORTONE_STORE_ID: ' ', PORTONE_CHANNEL_KEY: 'channel-key-1' })).toBeNull();
  });
});

describe('결제창에서 돌아온 주소 (G-21, ADR 0171)', () => {
  it('우리 주문 번호면 그 주문을 읽는다', () => {
    expect(paymentReturnOf({ paymentId: PAYMENT_ID })).toEqual({ kind: 'order', orderId: ORDER });
  });

  it('실패 코드가 붙으면 결제 번호가 있어도 실패다 — 사용자의 취소도 여기다', () => {
    expect(paymentReturnOf({ paymentId: PAYMENT_ID, code: 'FAILURE_TYPE_PG', message: '취소' })).toEqual({
      kind: 'failed',
    });
  });

  it('결제 번호가 없거나 우리 주문이 아니면 모른다', () => {
    expect(paymentReturnOf({})).toEqual({ kind: 'unknown' });
    expect(paymentReturnOf({ paymentId: 'payment-elsewhere' })).toEqual({ kind: 'unknown' });
  });
});

describe('결제 뒤 화면의 갈래 (G-21, ADR 0171)', () => {
  const back = { kind: 'order', orderId: ORDER } as const;

  it('결제창이 성공을 말해도 승인 전 주문은 기다린다 — 결제가 됐는지는 웹훅이 승인한 주문이 말한다', () => {
    expect(paymentOutcomeOf(back, { status: 'pending' })).toBe('waiting');
  });

  it('승인된 주문은 환불이 섞였어도 결제를 마친 것이다', () => {
    for (const status of ['approved', 'partially_refunded', 'refunded']) {
      expect(paymentOutcomeOf(back, { status })).toBe('paid');
    }
  });

  it('결제창의 실패 · 취소로 닫힌 주문은 실패이고, 없는 주문은 못 찾음이다', () => {
    expect(paymentOutcomeOf({ kind: 'failed' }, { status: 'approved' })).toBe('failed');
    expect(paymentOutcomeOf(back, { status: 'cancelled' })).toBe('failed');
    expect(paymentOutcomeOf(back, null)).toBe('missing');
    expect(paymentOutcomeOf({ kind: 'unknown' }, null)).toBe('missing');
  });
});
