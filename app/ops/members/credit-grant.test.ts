import { describe, expect, it } from 'vitest';

import {
  afterFailure,
  grantPlan,
  historyAmount,
  historyCause,
  historyCursorOf,
  historyFilterOf,
  isGrantReason,
  memberLabel,
  nextCursor,
  revokeBlocked,
  samePlan,
  type HistoryLine,
} from './credit-grant';

const ledger = { granted: 2, revocable: 5, version: 4 };
const member = 'a1b2c3d4-0000-4000-8000-000000000000';

describe('확인창은 연 순간의 값을 고정해 그대로 낸다', () => {
  it('지급 — 단추는 수를 말하고, 본문은 지급분 전 → 후 · 갈래와 메모 첫 줄 · 현금 환불 대상 아님', () => {
    const plan = grantPlan(
      ledger,
      { kind: 'grant', userId: member, credits: 3, reason: 'outage', note: '  10/16 오류\n둘째 줄  ', reportId: null },
      'req-1',
    );
    expect(plan.confirmLabel).toBe('3장 지급');
    expect(plan.title).toBe('무상 풀이권을 지급할까요?');
    expect(plan.amountLine).toBe('무상 풀이권 3장 (지급분 2장 → 5장)');
    expect(plan.reasonLine).toBe('장애 보상 — 10/16 오류');
    expect(plan.resultLine).toContain('현금 환불 대상이 아닙니다.');
    expect(plan.request).toEqual({
      kind: 'grant',
      userId: member,
      credits: 3,
      reason: 'outage',
      note: '10/16 오류\n둘째 줄',
      reportId: null,
      seenVersion: 4,
      requestId: 'req-1',
    });
    expect(Object.isFrozen(plan.request)).toBe(true);
  });

  it('회수 — 회수할 수 있는 수 전 → 후', () => {
    const plan = grantPlan(
      ledger,
      { kind: 'revoke', userId: member, credits: 2, reason: 'mistake', note: '잘못 줌', reportId: null },
      'req-2',
    );
    expect(plan.confirmLabel).toBe('2장 회수');
    expect(plan.amountLine).toBe('무상 지급분 2장 (회수할 수 있는 5장 → 3장)');
    expect(plan.reasonLine).toBe('잘못 지급 — 잘못 줌');
  });

  it('같은 값으로 다시 열면 앞의 고정본(요청 번호)을 다시 쓰고, 하나라도 다르면 새 요청이다', () => {
    const input = { kind: 'grant' as const, userId: member, credits: 3, reason: 'outage', note: '메모', reportId: null };
    const plan = grantPlan(ledger, input, 'req-1');
    expect(samePlan(plan, { ...input, note: ' 메모 ' })).toBe(true);
    expect(samePlan(plan, { ...input, credits: 4 })).toBe(false);
    expect(samePlan(plan, { ...input, reason: 'operator' })).toBe(false);
    expect(samePlan(plan, { ...input, kind: 'revoke', reason: 'mistake' })).toBe(false);
    expect(samePlan(null, input)).toBe(false);
  });
});

describe('실패 뒤의 고정본', () => {
  const UNREACHED = '처리하지 못했어요. 다시 시도해 주세요.';

  it('응답이 끊겨 결과를 모르면 고정본(요청 번호)을 지킨다 — 같은 값의 재시도가 같은 요청으로 간다', () => {
    expect(afterFailure(UNREACHED, UNREACHED)).toBe('keep');
  });

  it('서버가 분명히 거절하면(버전 충돌 · 회수할 수 있는 수) 버린다 — 다음 누름은 새 버전 · 새 요청 번호로 새 확인을 연다', () => {
    expect(afterFailure('그 사이 이 회원의 무상 풀이권이 바뀌었습니다. 새로 읽고 다시 확인해 주세요.', UNREACHED)).toBe('discard');
    expect(afterFailure('회수할 수 있는 지급분보다 많습니다 — 지금 0장입니다.', UNREACHED)).toBe('discard');
  });

  it('버린 뒤 같은 입력으로 다시 열면 새 읽은 버전이 든 새 고정본이다', () => {
    const input = { kind: 'revoke' as const, userId: member, credits: 1, reason: 'other', note: '메모', reportId: null };
    const stale = grantPlan(ledger, input, 'req-old');
    const kept = afterFailure('충돌', UNREACHED) === 'keep' ? stale : null;
    const next = samePlan(kept, input) ? kept : grantPlan({ ...ledger, version: 5 }, input, 'req-new');
    expect(next?.request.seenVersion).toBe(5);
    expect(next?.request.requestId).toBe('req-new');
  });
});

describe('갈래 · 대상 · 회수 잠금', () => {
  it('지급은 장애 보상 · 운영 지급, 회수는 잘못 · 중복 · 기타만 받는다', () => {
    expect(isGrantReason('grant', 'outage')).toBe(true);
    expect(isGrantReason('grant', 'mistake')).toBe(false);
    expect(isGrantReason('revoke', 'other')).toBe(true);
    expect(isGrantReason('revoke', 'operator')).toBe(false);
  });

  it('대상은 닉네임과 계정 id 앞 8자', () => {
    expect(memberLabel('지영', member)).toBe('지영 · a1b2c3d4');
    expect(memberLabel(null, member)).toBe('닉네임 없음 · a1b2c3d4');
  });

  it('회수할 것이 없으면 까닭 한 줄 — 예약 중이 있으면 풀린 뒤라고 말한다', () => {
    expect(revokeBlocked(1, 3)).toBeNull();
    expect(revokeBlocked(0, 0)).toBe('회수할 무상 지급분이 없습니다.');
    expect(revokeBlocked(0, 2)).toContain('예약 중 2장은 풀린 뒤');
  });
});

describe('이력의 말', () => {
  const line = (over: Partial<HistoryLine>): HistoryLine => ({
    key: 'use:1',
    at: '2026-10-17T00:00:00Z',
    kind: 'use',
    source: 'free',
    delta: null,
    state: null,
    cause: null,
    reason: null,
    note: null,
    orderNumber: null,
    actorNickname: null,
    reportId: null,
    carriedOver: false,
    ...over,
  });

  it('확정 사용만 −1장, 예약은 부호 없이 「예약 중」, 반환은 숫자 없이 「반환 · 차감 없음」', () => {
    expect(historyAmount(line({ delta: -1, state: 'confirmed', cause: 'run' }))).toBe('−1장');
    expect(historyCause(line({ delta: -1, state: 'confirmed', cause: 'run' }))).toBe('풀이 사용');
    expect(historyAmount(line({ state: 'released', cause: 'run' }))).toBe('');
    expect(historyCause(line({ state: 'released', cause: 'run' }))).toBe('반환 · 차감 없음');
    expect(historyAmount(line({ state: 'reserved', cause: 'request' }))).toBe('예약 중');
    expect(historyCause(line({ state: 'reserved', cause: 'request' }))).toBe('인연 요청');
  });

  it('증감 칸에는 「회」가 안 선다 — 풀이권의 증감은 늘 「장」이다', () => {
    const lines: HistoryLine[] = [
      line({ delta: -1, state: 'confirmed', cause: 'run' }),
      line({ state: 'released', cause: 'run' }),
      line({ state: 'reserved', cause: 'request' }),
      line({ kind: 'grant', source: 'grant', delta: 3 }),
      line({ kind: 'revoke', source: 'grant', delta: -2 }),
      line({ kind: 'purchase', source: 'bundle', delta: 5 }),
      line({ kind: 'refund', source: 'bundle', delta: -1, reason: 'unused' }),
    ];
    for (const one of lines) {
      expect(historyAmount(one)).not.toContain('회');
      expect(historyAmount(one)).not.toMatch(/^[+−-]?\d+$/);
    }
    expect(historyAmount(line({ kind: 'refund', source: 'bundle', delta: -1 }))).toBe('−1장');
    expect(historyAmount(line({ kind: 'purchase', source: 'bundle', delta: 5 }))).toBe('+5장');
  });

  it('지급 · 회수 · 구매 · 환불은 장으로, 늘고 준 만큼', () => {
    expect(historyAmount(line({ kind: 'grant', source: 'grant', delta: 3 }))).toBe('+3장');
    expect(historyAmount(line({ kind: 'revoke', source: 'grant', delta: -2 }))).toBe('−2장');
    expect(historyCause(line({ kind: 'revoke', reason: 'duplicate' }))).toBe('중복 지급');
    expect(historyCause(line({ kind: 'grant', reason: 'operator', carriedOver: true }))).toBe('운영 지급 — 기록 이전');
    expect(historyCause(line({ kind: 'refund', reason: 'duplicate' }))).toBe('환불 — 중복 결제');
    expect(historyCause(line({ kind: 'purchase', delta: 5 }))).toBe('구매');
  });

  it('거르기는 주소에서 읽고, 모르는 값은 기본으로', () => {
    expect(historyFilterOf('grants')).toBe('grants');
    expect(historyFilterOf('money')).toBe('all');
    expect(historyFilterOf(undefined)).toBe('all');
  });

  it('커서는 시각 · 열쇠가 다 맞을 때만 읽고, DB 의 시각 글자를 마이크로초까지 그대로 든다', () => {
    const at = '2026-10-17T01:02:03.123456+00:00';
    const key = 'grant:a1b2c3d4-0000-4000-8000-000000000000';
    expect(historyCursorOf(at, key)).toEqual({ at, key });
    expect(historyCursorOf(at, 'use:42')).toEqual({ at, key: 'use:42' });
    expect(historyCursorOf(undefined, key)).toBeNull();
    expect(historyCursorOf(at, undefined)).toBeNull();
    expect(historyCursorOf('어제', key)).toBeNull();
    expect(historyCursorOf(at, 'money:1')).toBeNull();
    expect(historyCursorOf(at, "grant:1' or 1=1")).toBeNull();
  });

  it('다음 쪽의 커서는 더 있을 때 이 쪽의 마지막 줄이다 — 위 끝이 없다', () => {
    // 300 줄째(열 번째 쪽의 끝)에서도 더 있으면 다음 쪽이 선다 — 옛 「더 보기」는 300 에서 멈췄다
    const tenth = Array.from({ length: 30 }, (_, i) => line({ key: `grant:${300 - i}`, at: `2026-01-01T00:${String(i).padStart(2, '0')}:00Z` }));
    expect(nextCursor(tenth, true)).toEqual({ at: '2026-01-01T00:29:00Z', key: 'grant:271' });
    expect(nextCursor(tenth, false)).toBeNull();
    expect(nextCursor([], true)).toBeNull();
  });
});
