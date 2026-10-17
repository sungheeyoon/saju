import { describe, expect, it } from 'vitest';

import {
  doneNote,
  isStatusReason,
  memberLabel,
  samePlan,
  sanctionEntriesOf,
  sanctionKindLabel,
  sanctionReasonLabel,
  statusAction,
  statusPlan,
} from './suspension';

const USER = '3f2a9c1e-0000-4000-8000-0000000000aa';

describe('정지 · 해제의 단추 (G-111 ③, G-111-10)', () => {
  it('이용 중이면 정지, 이용 정지면 해제', () => {
    expect(statusAction({ status: 'active', isOperator: false })).toEqual({ kind: 'suspend' });
    expect(statusAction({ status: 'suspended', isOperator: false })).toEqual({ kind: 'unsuspend' });
  });

  it('운영자 계정은 정지 단추 없이 딱지다', () => {
    expect(statusAction({ status: 'active', isOperator: true })).toEqual({ kind: 'operator' });
  });

  it('탈퇴 대기는 단추 없이 한 줄 — 해제는 런북', () => {
    expect(statusAction({ status: 'deletion_requested', isOperator: false })).toEqual({
      kind: 'none',
      note: '탈퇴 대기 — 해제는 런북',
    });
  });

  it('갈래는 정지 넷 · 해제 셋 — 신고 · 탈퇴 대기 해제는 화면의 갈래가 아니다', () => {
    expect(['policy', 'payment', 'eligibility', 'other'].every((value) => isStatusReason('suspend', value))).toBe(true);
    expect(isStatusReason('suspend', 'report')).toBe(false);
    expect(['appeal', 'mistake', 'other'].every((value) => isStatusReason('unsuspend', value))).toBe(true);
    expect(isStatusReason('unsuspend', 'deletion_withdrawn')).toBe(false);
  });
});

describe('실행 전 확인 — 창을 연 순간의 고정본', () => {
  const input = { kind: 'suspend' as const, userId: USER, reason: 'payment', note: '  결제 부정 정황\n둘째 줄 ' };

  it('정지 — 단추는 실행명, 처분 전 → 후, 갈래와 메모 첫 줄, 결과', () => {
    const plan = statusPlan({ version: 2 }, input, 'req-1');
    expect(plan).toMatchObject({
      title: '이용 정지할까요?',
      confirmLabel: '이용 정지',
      changeLine: '이용 중 → 이용 정지',
      reasonLine: '결제 부정 — 결제 부정 정황',
      resultLine: '대화방이 닫히고 모든 이용이 막힙니다.',
    });
    expect(plan.request).toEqual({
      kind: 'suspend',
      userId: USER,
      reason: 'payment',
      note: '결제 부정 정황\n둘째 줄',
      seenVersion: 2,
      requestId: 'req-1',
    });
    expect(Object.isFrozen(plan.request)).toBe(true);
  });

  it('해제 — 닫힌 대화방은 다시 열리지 않는다', () => {
    const plan = statusPlan({ version: 1 }, { kind: 'unsuspend', userId: USER, reason: 'appeal', note: '소명' }, 'req-2');
    expect(plan).toMatchObject({
      title: '정지를 풀까요?',
      confirmLabel: '정지 해제',
      changeLine: '이용 정지 → 이용 중',
      resultLine: '닫힌 대화방은 다시 열리지 않습니다.',
    });
  });

  it('같은 값이면 앞 고정본을 다시 낸다 — 갈래 · 메모가 바뀌면 새 요청이다', () => {
    const plan = statusPlan({ version: 0 }, input, 'req-1');
    expect(samePlan(plan, { ...input, note: '결제 부정 정황\n둘째 줄' })).toBe(true);
    expect(samePlan(plan, { ...input, reason: 'policy' })).toBe(false);
    expect(samePlan(plan, { ...input, note: '다른 메모' })).toBe(false);
    expect(samePlan(null, input)).toBe(false);
  });

  it('대상은 닉네임 · 계정 id 앞 8자, 재시도면 이미 처리했다고 말한다', () => {
    expect(memberLabel('달빛', USER)).toBe('달빛 · 3f2a9c1e');
    expect(memberLabel(null, USER)).toBe('닉네임 없음 · 3f2a9c1e');
    expect(doneNote('suspend', false)).toBe('이용 정지했습니다.');
    expect(doneNote('unsuspend', true)).toBe('이미 처리했습니다.');
  });
});

describe('처분 이력 — 문의 jsonb 를 줄로', () => {
  const lines = sanctionEntriesOf([
    { id: 'a', source: 'status', at: '2026-10-17T01:00:00Z', kind: 'active', from_status: 'suspended', reason: 'appeal', note: '소명', recorded: true, actor_nickname: '운영' },
    { id: 'b', source: 'status', at: '2026-10-16T01:00:00Z', kind: 'suspended', from_status: 'active', reason: null, note: null, recorded: false, actor_nickname: null },
    { id: 'c', source: 'report', at: '2026-10-15T01:00:00Z', kind: 'warning', reason: 'harassment', report_id: 'r1', warning_ref: 'W-1', counted: true, recorded: true },
    { id: 'd', source: 'status', at: '2026-10-14T01:00:00Z', kind: 'active', from_status: 'deletion_requested', reason: 'deletion_withdrawn', recorded: true },
    { id: 'e', source: 'elsewhere', at: '2026-10-13T01:00:00Z', kind: 'warning' },
    'not a line',
  ]);

  it('모양이 아닌 칸은 버린다', () => {
    expect(lines.map((line) => line.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(sanctionEntriesOf(null)).toEqual([]);
  });

  it('종류와 갈래의 말', () => {
    expect(lines.map(sanctionKindLabel)).toEqual(['정지 해제', '이용 정지', '경고', '탈퇴 대기 해제']);
    expect(lines.map(sanctionReasonLabel)).toEqual(['소명 인정', null, '괴롭힘이나 위협', '탈퇴 대기 해제']);
  });

  it('결과를 바꾼 신고가 건 정지는 상태 이력 줄로 「이용 정지 · 신고 처분」이고 그 신고를 가리킨다', () => {
    // DB 는 그 신고의 지금 결과가 이용 정지 결정이 아니면 이 줄을 남긴다(`20261218090000`)
    const changed = sanctionEntriesOf([
      { id: 'f', source: 'status', at: '2026-10-17T02:00:00Z', kind: 'suspended', from_status: 'active', reason: 'report', report_id: 'r9', recorded: true, actor_nickname: '운영' },
    ]);
    expect(changed.map(sanctionKindLabel)).toEqual(['이용 정지']);
    expect(changed.map(sanctionReasonLabel)).toEqual(['신고 처분']);
    expect(changed[0]).toMatchObject({ reportId: 'r9', recorded: true, note: null });
  });

  it('공통 함수 밖의 줄은 기록되지 않은 줄로 읽힌다', () => {
    expect(lines.map((line) => line.recorded)).toEqual([true, false, true, true]);
    expect(lines[2]).toMatchObject({ reportId: 'r1', warningRef: 'W-1', counted: true, note: null });
  });
});
