import { describe, expect, it } from 'vitest';

import { cancellationCheck } from './portone-cancellations';
import { releaseCheckOf } from './release-check';

const succeeded = (totalAmount: number, requestedAt = '2026-10-16T09:59:00Z') => ({
  status: 'SUCCEEDED',
  totalAmount,
  requestedAt,
  cancelledAt: '2026-10-16T10:01:00Z',
});

describe('준비 취소를 해도 되는가 — 리뷰가 재현한 세 줄', () => {
  it('09:59 취소 요청 → 10:00 확보 → 10:01 성공(장부 0원)은 막는다 — 장부에 없는 취소액이다', () => {
    const body = { status: 'PARTIAL_CANCELLED', cancellations: [succeeded(4300)] };
    expect(releaseCheckOf(body, 0)).toEqual({ kind: 'cancelled' });
  });

  it('09:59 취소 요청 → 10:00 확보 → 아직 REQUESTED 는 막는다 — 시각과 상관없다', () => {
    const body = {
      status: 'PAID',
      cancellations: [{ status: 'REQUESTED', totalAmount: 4300, requestedAt: '2026-10-16T09:59:00Z' }],
    };
    expect(releaseCheckOf(body, 0)).toEqual({ kind: 'cancelled' });
  });

  it('확보 전 PG 취소 4,300원 · 장부 환불 0원은 막는다', () => {
    const body = {
      status: 'PARTIAL_CANCELLED',
      amount: { total: 12900, cancelled: 4300 },
      cancellations: [succeeded(4300, '2026-10-16T09:00:00Z')],
    };
    expect(releaseCheckOf(body, 0)).toEqual({ kind: 'cancelled' });
  });
});

describe('준비 취소를 해도 되는가 — 상태 · 금액 규칙', () => {
  it('취소가 없는 결제 완료이고 장부도 0원이면 풀어도 된다', () => {
    expect(releaseCheckOf({ status: 'PAID' }, 0)).toEqual({ kind: 'clear' });
  });

  it('성공한 취소액이 장부의 환불액과 같으면 풀어도 된다 — amount.cancelled 도 같다', () => {
    const body = {
      status: 'PARTIAL_CANCELLED',
      amount: { total: 12900, cancelled: 8600 },
      cancellations: [succeeded(4300), succeeded(4300)],
    };
    expect(releaseCheckOf(body, 8600)).toEqual({ kind: 'clear' });
  });

  it('실패한 취소만 있으면 풀어도 된다', () => {
    const body = { status: 'PAID', cancellations: [{ status: 'FAILED', totalAmount: 4300 }] };
    expect(releaseCheckOf(body, 0)).toEqual({ kind: 'clear' });
  });

  it('모르는 상태의 취소가 하나라도 있으면 막는다', () => {
    const body = { status: 'PAID', cancellations: [{ status: 'SOMETHING_NEW', totalAmount: 100 }] };
    expect(releaseCheckOf(body, 0)).toEqual({ kind: 'cancelled' });
  });

  it('금액 필드가 서로 다르면 알 수 없다 — 막는다', () => {
    const body = { status: 'PARTIAL_CANCELLED', amount: { cancelled: 8600 }, cancellations: [succeeded(4300)] };
    expect(releaseCheckOf(body, 4300).kind).toBe('unknown');
  });

  it('성공한 취소액이 장부보다 작으면 알 수 없다 — 막는다', () => {
    const body = { status: 'PARTIAL_CANCELLED', cancellations: [succeeded(4300)] };
    expect(releaseCheckOf(body, 8600).kind).toBe('unknown');
  });

  it('금액 · 상태를 읽을 수 없거나 목록이 아니면 알 수 없다 — 막는다', () => {
    expect(releaseCheckOf({ status: 'PARTIAL_CANCELLED', cancellations: [{ status: 'SUCCEEDED' }] }, 0).kind).toBe('unknown');
    expect(releaseCheckOf({ status: 'PAID', cancellations: [{ totalAmount: 4300 }] }, 0).kind).toBe('unknown');
    expect(releaseCheckOf({ status: 'PAID', cancellations: 'nope' }, 0).kind).toBe('unknown');
    expect(releaseCheckOf({ status: 'PAID', cancellations: [null] }, 0).kind).toBe('unknown');
    expect(releaseCheckOf({ status: 'PAID', amount: { cancelled: '0' } }, 0).kind).toBe('unknown');
  });

  it('취소된 결제인데 내역이 없거나 결제가 없으면 알 수 없다 — 막는다', () => {
    expect(releaseCheckOf({ status: 'CANCELLED' }, 12900).kind).toBe('unknown');
    expect(releaseCheckOf(null, 0).kind).toBe('unknown');
    expect(releaseCheckOf('text', 0).kind).toBe('unknown');
  });
});

describe('PortOne 조회 — 열쇠 · 실패 갈래', () => {
  const config = { apiSecret: 'secret', storeId: 'store-1' };
  const answer = (status: number, body: unknown) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('열쇠가 없는 환경이면 묻지 않고 알 수 없다 — 막는다', async () => {
    let asked = false;
    const fetchImpl = (async () => {
      asked = true;
      return new Response('{}');
    }) as unknown as typeof fetch;
    expect((await cancellationCheck('rdo_x', 0, { config: null, fetchImpl })).kind).toBe('unknown');
    expect(asked).toBe(false);
  });

  it('조회가 실패하면(5xx · 닿지 못함) 알 수 없다 — 막는다', async () => {
    expect((await cancellationCheck('rdo_x', 0, { config, fetchImpl: answer(500, {}) })).kind).toBe('unknown');
    const unreachable = (async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    expect((await cancellationCheck('rdo_x', 0, { config, fetchImpl: unreachable })).kind).toBe('unknown');
  });

  it('결제가 없으면(404) 알 수 없다 — 막는다', async () => {
    expect((await cancellationCheck('rdo_x', 0, { config, fetchImpl: answer(404, {}) })).kind).toBe('unknown');
  });

  it('조회한 결제를 장부의 환불액과 견준다', async () => {
    const body = { status: 'PARTIAL_CANCELLED', cancellations: [succeeded(4300)] };
    expect((await cancellationCheck('rdo_x', 4300, { config, fetchImpl: answer(200, body) })).kind).toBe('clear');
    expect((await cancellationCheck('rdo_x', 0, { config, fetchImpl: answer(200, body) })).kind).toBe('cancelled');
  });
});
