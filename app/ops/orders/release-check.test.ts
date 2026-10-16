import { describe, expect, it } from 'vitest';

import { cancellationCheck } from './portone-cancellations';
import { releaseCheckOf } from './release-check';

const HELD = new Date('2026-10-16T08:00:00Z');
const BEFORE = '2026-10-16T07:59:00Z';
const AFTER = '2026-10-16T08:05:00Z';

const paid = (cancellations?: unknown) => ({
  status: cancellations === undefined ? 'PAID' : 'PARTIAL_CANCELLED',
  ...(cancellations === undefined ? {} : { cancellations }),
});

describe('준비 취소를 해도 되는가 — PortOne 취소 내역', () => {
  it('취소가 없는 결제 완료면 풀어도 된다', () => {
    expect(releaseCheckOf(paid(), HELD)).toEqual({ kind: 'clear' });
  });

  it('확보 뒤의 취소가 성공했으면 막는다 — 풀지 말고 확정한다', () => {
    expect(releaseCheckOf(paid([{ status: 'SUCCEEDED', requestedAt: AFTER, cancelledAt: AFTER }]), HELD)).toEqual({
      kind: 'cancelled',
    });
  });

  it('확보 뒤의 취소가 요청 중이어도 막는다', () => {
    expect(releaseCheckOf(paid([{ status: 'REQUESTED', requestedAt: AFTER }]), HELD)).toEqual({ kind: 'cancelled' });
  });

  it('모르는 상태의 취소도 확보 뒤면 막는다', () => {
    expect(releaseCheckOf(paid([{ status: 'SOMETHING_NEW', requestedAt: AFTER }]), HELD)).toEqual({ kind: 'cancelled' });
  });

  it('확보 전의 취소와 실패한 취소만 있으면 풀어도 된다', () => {
    expect(
      releaseCheckOf(
        paid([
          { status: 'SUCCEEDED', requestedAt: BEFORE, cancelledAt: BEFORE },
          { status: 'FAILED', requestedAt: AFTER },
        ]),
        HELD,
      ),
    ).toEqual({ kind: 'clear' });
  });

  it('시각을 읽을 수 없는 취소 · 상태가 없는 취소 · 목록이 아닌 내역이면 알 수 없다 — 막는다', () => {
    expect(releaseCheckOf(paid([{ status: 'SUCCEEDED' }]), HELD).kind).toBe('unknown');
    expect(releaseCheckOf(paid([{ requestedAt: AFTER }]), HELD).kind).toBe('unknown');
    expect(releaseCheckOf(paid('nope'), HELD).kind).toBe('unknown');
    expect(releaseCheckOf(paid([null]), HELD).kind).toBe('unknown');
  });

  it('취소된 결제인데 내역이 없거나 결제가 없으면 알 수 없다 — 막는다', () => {
    expect(releaseCheckOf({ status: 'CANCELLED' }, HELD).kind).toBe('unknown');
    expect(releaseCheckOf(null, HELD).kind).toBe('unknown');
    expect(releaseCheckOf('text', HELD).kind).toBe('unknown');
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
    expect((await cancellationCheck('rdo_x', HELD, { config: null, fetchImpl })).kind).toBe('unknown');
    expect(asked).toBe(false);
  });

  it('조회가 실패하면(5xx · 닿지 못함) 알 수 없다 — 막는다', async () => {
    expect((await cancellationCheck('rdo_x', HELD, { config, fetchImpl: answer(500, {}) })).kind).toBe('unknown');
    const unreachable = (async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    expect((await cancellationCheck('rdo_x', HELD, { config, fetchImpl: unreachable })).kind).toBe('unknown');
  });

  it('결제가 없으면(404) 알 수 없다 — 막는다', async () => {
    expect((await cancellationCheck('rdo_x', HELD, { config, fetchImpl: answer(404, {}) })).kind).toBe('unknown');
  });

  it('조회한 결제의 취소 내역으로 가른다', async () => {
    expect((await cancellationCheck('rdo_x', HELD, { config, fetchImpl: answer(200, paid()) })).kind).toBe('clear');
    expect(
      (
        await cancellationCheck('rdo_x', HELD, {
          config,
          fetchImpl: answer(200, paid([{ status: 'SUCCEEDED', requestedAt: AFTER, cancelledAt: AFTER }])),
        })
      ).kind,
    ).toBe('cancelled');
  });
});
