import { describe, expect, it } from 'vitest';

import { oneAtATime, ownerLabel, preparePlan, releaseLabel, samePlan } from './refund-confirm';

const order = { orderId: 'o-1', paid: 12900, credits: 3, refundedCredits: 0, refundedAmount: 0, penalizedCredits: 0 };

describe('환불 준비의 확인창 — 보인 값이 곧 낸 값이다', () => {
  it('단추 이름의 회차 · 금액과 제출하는 값이 같다', () => {
    const plan = preparePlan(order, 2, 'withdrawal', 'req-1');
    expect(plan.confirmLabel).toBe('2장 · 8,600원 환불 준비');
    expect(plan.request).toEqual({ orderId: 'o-1', credits: 2, reason: 'withdrawal', expectedAmount: 8600, requestId: 'req-1' });
    expect(plan.confirmLabel).toContain(`${plan.request.credits}장`);
    expect(plan.confirmLabel).toContain(plan.request.expectedAmount.toLocaleString('ko-KR'));
  });

  it('「안 쓴 몫 환불」은 10% 위약금을 뗀 금액을 보이고 낸다 — DB 가 같은 셈으로 다시 셈한다', () => {
    const plan = preparePlan(order, 2, 'unused', 'req-1');
    expect(plan.confirmLabel).toBe('2장 · 7,740원 환불 준비');
    expect(plan.request.expectedAmount).toBe(7740);
  });

  it('확인창을 연 뒤 칸이 바뀌어도 고정본은 그대로다 — 제출되는 것은 창에 보인 값이다', () => {
    const plan = preparePlan(order, 2, 'withdrawal', 'req-1');
    const later = preparePlan(order, 1, 'unused', 'req-2');
    expect(plan.request.credits).toBe(2);
    expect(later.request.credits).toBe(1);
    expect(Object.isFrozen(plan.request)).toBe(true);
    expect(plan.request.expectedAmount).toBe(8600);
  });

  it('같은 회차 · 사유 · 금액이면 요청 번호를 다시 쓰고, 하나라도 다르면 새로 짓는다', () => {
    const plan = preparePlan(order, 2, 'withdrawal', 'req-1');
    expect(samePlan(plan, 'o-1', 2, 'withdrawal', 8600)).toBe(true);
    expect(samePlan(plan, 'o-1', 1, 'withdrawal', 4300)).toBe(false);
    expect(samePlan(plan, 'o-1', 2, 'unused', 8600)).toBe(false);
    expect(samePlan(plan, 'o-1', 2, 'withdrawal', 8000)).toBe(false);
    expect(samePlan(null, 'o-1', 2, 'withdrawal', 8600)).toBe(false);
  });

  it('나눠 돌려준 주문은 누적 산식의 금액을 보인다', () => {
    const plan = preparePlan({ ...order, refundedCredits: 1, refundedAmount: 4300 }, 1, 'withdrawal', 'req-3');
    expect(plan.confirmLabel).toBe('1장 · 4,300원 환불 준비');
    // 앞의 1장을 위약금을 떼고(4,300 − 430) 돌려줬으면 그 위약금은 다시 빠지지 않는다
    const after = preparePlan({ ...order, refundedCredits: 1, refundedAmount: 3870, penalizedCredits: 1 }, 1, 'unused', 'req-4');
    expect(after.confirmLabel).toBe('1장 · 3,870원 환불 준비');
  });

  it('대상은 닉네임과 계정 앞자리로 가르고, 준비 취소 단추는 돌려놓는 회차를 말한다', () => {
    expect(ownerLabel({ nickname: '하늘', ref: '2658fc70' })).toBe('하늘 · 2658fc70');
    expect(ownerLabel({ nickname: null, ref: '2658fc70' })).toBe('닉네임 없음 · 2658fc70');
    expect(releaseLabel(2)).toBe('준비 취소 — 2장 돌려놓기');
  });
});

describe('중복 클릭', () => {
  it('처리 중에 다시 누른 것은 버리고, 끝나면 다시 받는다', async () => {
    const guard = oneAtATime();
    let calls = 0;
    let finish: () => void = () => {};
    const work = () =>
      new Promise<void>((resolve) => {
        calls += 1;
        finish = resolve;
      });

    expect(guard.run(work)).toBe(true);
    expect(guard.run(work)).toBe(false);
    expect(guard.run(work)).toBe(false);
    expect(calls).toBe(1);

    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(guard.run(work)).toBe(true);
    expect(calls).toBe(2);
  });

  it('실패해도 자물쇠가 풀린다', async () => {
    const guard = oneAtATime();
    expect(guard.run(() => Promise.reject(new Error('x')))).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(guard.run(async () => {})).toBe(true);
  });
});
