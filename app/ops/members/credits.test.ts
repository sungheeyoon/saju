import { describe, expect, it } from 'vitest';

import type { RpcRow } from '@/src/lib/db';

import { historyLineOf } from './credits';

/**
 * 풀이권 이력 문의 한 줄 — 생성 타입은 칸을 모두 null 아님으로 적지만 문은 줄의 종류마다 칸을 비운다(`20261218090000`).
 * 기본값은 지급 줄이다.
 */
const row = (over: Partial<Record<keyof RpcRow<'operator_member_credit_history'>, unknown>> = {}) =>
  ({
    line_key: 'grant:00000000-0000-4000-8000-0000000000g1',
    at: '2026-10-17T01:00:00+00:00',
    kind: 'grant',
    source: 'grant',
    delta: 2,
    state: null,
    cause: null,
    reason: 'outage',
    note: '장애 보상',
    order_number: null,
    actor_nickname: '운영',
    report_id: '00000000-0000-4000-8000-0000000000r1',
    carried_over: false,
    ...over,
  }) as unknown as RpcRow<'operator_member_credit_history'>;

describe('풀이권 이력 한 줄 — 문이 비운 칸 (G-111 ①)', () => {
  it('지급 줄은 칸을 그대로 옮긴다 — 열쇠는 line_key 다', () => {
    expect(historyLineOf(row())).toEqual({
      key: 'grant:00000000-0000-4000-8000-0000000000g1',
      at: '2026-10-17T01:00:00+00:00',
      kind: 'grant',
      source: 'grant',
      delta: 2,
      state: null,
      cause: null,
      reason: 'outage',
      note: '장애 보상',
      orderNumber: null,
      actorNickname: '운영',
      reportId: '00000000-0000-4000-8000-0000000000r1',
      carriedOver: false,
    });
  });

  it('예약 · 반환된 사용 줄은 수가 null 이다 — 차감이 아니다', () => {
    for (const state of ['reserved', 'released']) {
      const line = historyLineOf(
        row({ kind: 'use', source: 'free', delta: null, state, cause: 'reading', reason: null, note: null, actor_nickname: null, report_id: null }),
      );
      expect(line).toMatchObject({ delta: null, state, cause: 'reading', reason: null, note: null, actorNickname: null, reportId: null });
    }
  });

  it('수 0 은 0 으로 남는다 — 크레딧 없이 돈만 돌려준 환불 줄', () => {
    // reading_order_refund.credits 는 0 을 받는다(`credits >= 0`) — 문은 -0 이 아니라 0 을 낸다
    expect(historyLineOf(row({ kind: 'refund', source: 'bundle', delta: 0, reason: 'unused' })).delta).toBe(0);
  });

  it('칸이 아예 오지 않아도(undefined) null 로 받는다', () => {
    const line = historyLineOf(
      row({
        delta: undefined,
        state: undefined,
        cause: undefined,
        reason: undefined,
        note: undefined,
        order_number: undefined,
        actor_nickname: undefined,
        report_id: undefined,
      }),
    );
    expect(line).toMatchObject({
      delta: null,
      state: null,
      cause: null,
      reason: null,
      note: null,
      orderNumber: null,
      actorNickname: null,
      reportId: null,
    });
  });

  it('빈 글자는 null 로 바꾸지 않는다 — 비었는가는 DB 가 정한다', () => {
    expect(historyLineOf(row({ note: '', order_number: '', actor_nickname: '' }))).toMatchObject({
      note: '',
      orderNumber: '',
      actorNickname: '',
    });
  });

  it('구매 줄은 주문 번호를 들고 실행자가 없다', () => {
    const line = historyLineOf(
      row({ kind: 'purchase', source: 'bundle', delta: 4, reason: null, note: null, order_number: 'ord_1', actor_nickname: null, report_id: null }),
    );
    expect(line).toMatchObject({ orderNumber: 'ord_1', actorNickname: null, reason: null, delta: 4 });
  });

  it('기록 이전은 true 일 때만 참이다 — null · undefined 는 거짓', () => {
    expect(historyLineOf(row({ carried_over: true })).carriedOver).toBe(true);
    expect(historyLineOf(row({ carried_over: null })).carriedOver).toBe(false);
    expect(historyLineOf(row({ carried_over: undefined })).carriedOver).toBe(false);
  });
});
