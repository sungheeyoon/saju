import { isPenalizedRefund, refundOwed, won } from '@/src/lib/reading/bundle';

/**
 * **환불 세 동작의 「실행 전 확인」** — 확인창에 보이는 값과 서버에 내는 값을 한 자리에서 짓는다(G-110 ②, ADR 0184).
 *
 * 확인창을 여는 순간 값을 고정해(`PreparePlan`) 그 고정본으로 단추 이름 · 본문을 그리고, 같은 고정본을 그대로 제출한다 — 창이 열린
 * 뒤 칸을 바꿔도 제출되는 것은 창에 보인 값이다. 서버는 그 값이 지금 상태와 다르면 거절한다(금액 재셈 · 요청 번호 · 확보 번호).
 */

/** 확인창이 가리키는 대상 — 동명이인을 가르려고 닉네임에 계정 내부 번호 앞자리를 붙인다 */
export type Owner = { readonly nickname: string | null; readonly ref: string };

/** 환불 준비에 내는 값 — 확인창에 보인 그대로 */
export type PrepareRequest = {
  readonly orderId: string;
  readonly credits: number;
  readonly reason: string;
  /** 확인창에 보인 금액 — DB 가 다시 셈해 다르면 잠그지 않는다 */
  readonly expectedAmount: number;
  /** 확인창을 열 때 지은 요청 번호 — 응답이 끊겨 다시 내면 같은 확보가 돌아온다 */
  readonly requestId: string;
};

export type PreparePlan = {
  readonly request: PrepareRequest;
  /** 확인 단추 — 「2장 · 8,600원 환불 준비」 */
  readonly confirmLabel: string;
};

/**
 * 확인창을 여는 순간의 환불 준비 — 금액은 ADR 0148 산식(`refundOwed`)이고, 사유가 「안 쓴 몫 환불」이면 10% 위약금을 뗀다(ADR 0192).
 * DB 의 `operator_hold_reading_refund` 가 같은 셈으로 다시 셈해 다르면 거절한다. `requestId` 는 부르는 쪽이 넘긴다: 같은 회차 · 사유로
 * 다시 여는 재시도는 앞의 번호를 그대로 쓴다(`samePlan`).
 */
export function preparePlan(
  order: {
    readonly orderId: string;
    readonly paid: number;
    readonly credits: number;
    readonly refundedCredits: number;
    readonly refundedAmount: number;
    readonly penalizedCredits: number;
  },
  take: number,
  reason: string,
  requestId: string,
): PreparePlan {
  const expectedAmount = refundOwed(
    {
      paid: order.paid,
      credits: order.credits,
      refundedCredits: order.refundedCredits,
      refundedAmount: order.refundedAmount,
      penalizedCredits: order.penalizedCredits,
    },
    take,
    isPenalizedRefund(reason),
  );
  return Object.freeze({
    request: Object.freeze({ orderId: order.orderId, credits: take, reason, expectedAmount, requestId }),
    confirmLabel: `${take}장 · ${won(expectedAmount)} 환불 준비`,
  });
}

/** 앞의 고정본과 같은 준비인가 — 같으면 요청 번호를 다시 쓴다(응답이 끊긴 뒤의 재시도) */
export const samePlan = (plan: PreparePlan | null, orderId: string, take: number, reason: string, amount: number): boolean =>
  plan !== null &&
  plan.request.orderId === orderId &&
  plan.request.credits === take &&
  plan.request.reason === reason &&
  plan.request.expectedAmount === amount;

export const BOOK_LABEL = '장부에 확정';

export const releaseLabel = (credits: number): string => `준비 취소 — ${credits}장 돌려놓기`;
