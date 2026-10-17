import { describe, expect, it } from 'vitest';

import {
  HELD_SUSPENSION,
  actionLabel,
  needsConfirm,
  reviewLogOf,
  reviewPlan,
  samePlan,
  sanctionLabel,
  suspensionBlocked,
  warningOrdinal,
  warningSentence,
  type Party,
  type ReportNow,
  type ReviewInput,
} from './review';

const reported: Party = {
  side: 'reported',
  userId: '3f2a9c1e-0000-4000-8000-0000000000bb',
  nickname: '나',
  status: 'active',
  isOperator: false,
  warnings12m: 1,
  warnedHere: false,
};
const reporter: Party = { ...reported, side: 'reporter', userId: 'aa11bb22-0000-4000-8000-0000000000aa', nickname: '가' };
const parties = [reported, reporter];

const open: ReportNow = {
  reportId: '9c8b7a6d-0000-4000-8000-000000000001',
  reason: 'harassment',
  isOpen: true,
  outcome: null,
  version: 0,
};
const warned: ReportNow = { ...open, isOpen: false, outcome: 'warning', version: 1 };
const suspended: ReportNow = { ...open, isOpen: false, outcome: 'suspension', version: 2 };

const input = (over: Partial<ReviewInput> = {}): ReviewInput => ({
  outcome: 'warning',
  side: 'reported',
  warningCategory: 'harassment',
  note: '반복된 위협\n둘째 줄',
  ...over,
});

describe('처분 단추와 확인창 — 결과를 말하고, 바꾸기와 제재에만 묻는다 (G-111 ②)', () => {
  it('처음 적을 때는 「경고로 처분」 · 「이용 정지」, 바꿀 때는 「경고로 바꾸기」다', () => {
    expect(actionLabel(open, 'warning')).toBe('경고로 처분');
    expect(actionLabel(open, 'suspension')).toBe('이용 정지');
    expect(actionLabel(open, 'no_action')).toBe('조치 없음으로 처리');
    expect(actionLabel(warned, 'warning')).toBe('경고로 바꾸기');
    expect(actionLabel(warned, 'no_action')).toBe('조치 없음으로 바꾸기');
  });

  it('처음 적는 조치 없음 · 추가 확인은 창 없이, 경고 · 정지와 바꾸기 전부는 창을 거친다', () => {
    expect(needsConfirm(open, 'no_action')).toBe(false);
    expect(needsConfirm(open, 'needs_more')).toBe(false);
    expect(needsConfirm(open, 'warning')).toBe(true);
    expect(needsConfirm(open, 'suspension')).toBe(true);
    expect(needsConfirm(warned, 'no_action')).toBe(true);
  });

  it('추가 확인 필요는 아직 처리 필요라 그 위의 결론은 바꾸기가 아니다', () => {
    const held: ReportNow = { ...open, outcome: 'needs_more', version: 1 };
    expect(actionLabel(held, 'warning')).toBe('경고로 처분');
    expect(reviewPlan(held, parties, input(), 'r').changeLine).toBe('추가 확인 필요 → 경고(괴롭힘이나 위협)');
  });
});

describe('고정본 — 창에 보인 값이 곧 내는 값이다', () => {
  it('대상 · 처분 전후 · 근거 첫 줄 · 읽은 버전 · 요청 번호를 함께 얼린다', () => {
    const plan = reviewPlan(open, parties, input(), 'req-1');
    expect(plan.request).toEqual({
      reportId: open.reportId,
      outcome: 'warning',
      note: '반복된 위협\n둘째 줄',
      sanctionedUserId: reported.userId,
      warningCategory: 'harassment',
      seenVersion: 0,
      requestId: 'req-1',
    });
    expect(plan.reportLine).toBe('9c8b7a6d');
    expect(plan.targetLine).toBe('나 · 3f2a9c1e · 신고받은 계정');
    expect(plan.changeLine).toBe('처리 필요 → 경고(괴롭힘이나 위협)');
    expect(plan.reasonLine).toBe('반복된 위협');
    expect(plan.title).toBe('경고로 처분할까요?');
    expect(Object.isFrozen(plan.request)).toBe(true);
  });

  it('조치 없음은 제재 대상과 갈래를 내지 않는다 — 폼에 남은 선택이 따라가지 않는다', () => {
    const plan = reviewPlan(warned, parties, input({ outcome: 'no_action', side: 'reporter' }), 'r');
    expect(plan.request.sanctionedUserId).toBeNull();
    expect(plan.request.warningCategory).toBeNull();
    expect(plan.targetLine).toBeNull();
    expect(plan.title).toBe('처분을 바꿀까요?');
    expect(plan.resultLines).toEqual(['이미 적힌 결과를 바꿉니다.']);
  });

  it('정지 결정을 다른 결과로 바꾸면 정지가 남는다고 창이 말한다', () => {
    const plan = reviewPlan(suspended, parties, input({ outcome: 'warning' }), 'r');
    expect(plan.resultLines).toContain(HELD_SUSPENSION);
    expect(plan.request.seenVersion).toBe(2);
  });

  it('이미 정지된 계정에 정지 결정을 적으면 「대화방이 닫히고」가 아니라 이미 정지라고 말한다', () => {
    const plan = reviewPlan(open, [{ ...reported, status: 'suspended' }], input({ outcome: 'suspension' }), 'r');
    expect(plan.resultLines).toEqual(['계정은 이미 이용 정지 상태입니다.']);
    expect(plan.danger).toBe(true);
  });

  it('같은 처분으로 다시 내면 앞 고정본(요청 번호)을 쓰고, 하나라도 다르면 새 고정본이다', () => {
    const plan = reviewPlan(open, parties, input(), 'req-1');
    expect(samePlan(plan, open, parties, input({ note: '  반복된 위협\n둘째 줄 ' }))).toBe(true);
    expect(samePlan(plan, open, parties, input({ side: 'reporter' }))).toBe(false);
    expect(samePlan(plan, open, parties, input({ warningCategory: 'other' }))).toBe(false);
    expect(samePlan(null, open, parties, input())).toBe(false);
  });
});

describe('「이번이 N회째 경고」 — 현재 신고 기준, 이 신고의 경고는 한 번만 센다 (ADR 0108)', () => {
  it('앞선 경고 수에 이번 것을 더한다', () => {
    expect(warningOrdinal({ warnings12m: 1, warnedHere: false })).toBe(2);
  });

  it('이 신고에 이미 그 대상의 경고가 적혀 있으면 두 번 세지 않는다', () => {
    expect(warningOrdinal({ warnings12m: 2, warnedHere: true })).toBe(2);
  });

  it('3회째부터 이용 정지 결정을 검토하라고 덧붙인다', () => {
    expect(warningSentence({ warnings12m: 1, warnedHere: false })).toBe('현재 신고 기준 이번이 2회째 경고입니다.');
    expect(warningSentence({ warnings12m: 2, warnedHere: false })).toBe(
      '현재 신고 기준 이번이 3회째 경고입니다. 이용 정지 결정을 검토하세요.',
    );
  });
});

describe('정지할 수 없는 대상 · 이력의 말', () => {
  it('운영자 계정 · 탈퇴 대기는 정지 전에 까닭을 보인다', () => {
    expect(suspensionBlocked({ ...reported, isOperator: true })).toBe('운영자 계정은 정지할 수 없습니다.');
    expect(suspensionBlocked({ ...reported, status: 'deletion_requested' })).toBe('탈퇴를 신청한 계정이라 정지할 수 없습니다.');
    expect(suspensionBlocked(reported)).toBeNull();
  });

  it('처분 이력의 모양이 아닌 칸은 버린다', () => {
    expect(
      reviewLogOf([
        { version: 2, outcome: 'no_action', at: '2026-10-17T00:00:00Z', actor_nickname: '운영', carried_over: false },
        { version: 'x' },
        null,
      ]),
    ).toEqual([
      {
        version: 2,
        outcome: 'no_action',
        sanctionedSide: null,
        warningCategory: null,
        note: null,
        actorNickname: '운영',
        at: '2026-10-17T00:00:00Z',
        carriedOver: false,
      },
    ]);
    expect(reviewLogOf(null)).toEqual([]);
  });

  it('공통 함수 밖의 상태 변경은 「실행자 · 사유 없음」으로 읽힌다', () => {
    expect(sanctionLabel({ at: 'x', kind: 'suspended', reason: null, reportId: null })).toBe('이용 정지 · 실행자 · 사유 없음');
    expect(sanctionLabel({ at: 'x', kind: 'suspended', reason: 'report', reportId: 'r' })).toBe('이용 정지 · 신고 처분');
    expect(sanctionLabel({ at: 'x', kind: 'warning', reason: 'harassment', reportId: 'r' })).toBe('경고 · 괴롭힘이나 위협');
    expect(sanctionLabel({ at: 'x', kind: 'active', reason: 'deletion_withdrawn', reportId: null })).toBe('탈퇴 대기 해제');
    expect(sanctionLabel({ at: 'x', kind: 'active', reason: 'appeal', reportId: null })).toBe('정지 해제 · 소명 인정');
  });
});
