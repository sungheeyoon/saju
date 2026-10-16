'use client';

import { useId, useState, useTransition } from 'react';

import { refundOwed } from '@/src/lib/reading/bundle';

import { actionAnswer } from '../../ui/action-answer';
import { BUTTON_PRIMARY } from '../../ui/buttons';
import { DoneNote } from '../../ui/done-note';
import { FailureLine } from '../../ui/failure-line';
import { FIELD } from '../../ui/fields';
import { bookRefund } from './actions';
import { orderStatusLabel, REFUND_REASONS, won } from './labels';

type Props = {
  readonly orderId: string;
  readonly paid: number;
  readonly refundedAmount: number;
  readonly credits: number;
  readonly refundedCredits: number;
  /** 지금 걷을 수 있는 회차 — 1 이상일 때만 이 폼이 선다 */
  readonly unused: number;
};

/**
 * **환불을 장부에 적는 폼** — 걷을 회차를 고르면 금액이 셈해져 서고, PortOne 콘솔에서 그 금액을 취소한 뒤 취소 번호를 적어
 * 「장부에 적기」를 누른다(G-110 ②, ADR 0184). PG 취소는 이 화면이 부르지 않는다.
 *
 * 금액은 화면이 ADR 0148 의 산식(`refundOwed`)으로 셈하고, 누르면 그 금액을 함께 보낸다 — DB 가 같은 산식으로 다시 셈해 다르면
 * 거절한다. 적고 나면 액션의 응답이 이 화면을 다시 그려 싣는다(`refresh`) — 걷을 수 있는 회차가 줄면 고른 회차도 그 안으로 줄인다.
 */
export function RefundForm({ orderId, paid, refundedAmount, credits, refundedCredits, unused }: Props) {
  const [chosen, setTake] = useState(unused);
  const take = Math.min(chosen, unused);
  const [reason, setReason] = useState<string>(REFUND_REASONS[0].value);
  const [refundId, setRefundId] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const ids = useId();

  const amount = refundOwed({ paid, credits, refundedCredits, refundedAmount }, take);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure(null);
    setBooked(null);
    startSaving(async () => {
      const answer = await actionAnswer(bookRefund({ orderId, credits: take, amount, reason, refundId }));
      if (answer.ok) {
        setBooked(`장부에 적었습니다 — ${orderStatusLabel(answer.status)}`);
        setRefundId('');
      } else setFailure(answer.message);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <label htmlFor={`${ids}-take`} className="shrink-0 text-xs font-semibold text-muted sm:w-24">
          걷을 회차
        </label>
        <select
          id={`${ids}-take`}
          value={take}
          onChange={(event) => setTake(Number(event.target.value))}
          className={`${FIELD} w-full sm:w-40`}
        >
          {Array.from({ length: unused }, (_, i) => unused - i).map((n) => (
            <option key={n} value={n}>
              {n}장
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <label htmlFor={`${ids}-reason`} className="shrink-0 text-xs font-semibold text-muted sm:w-24">
          사유
        </label>
        <select
          id={`${ids}-reason`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={`${FIELD} w-full sm:w-56`}
        >
          {REFUND_REASONS.map((one) => (
            <option key={one.value} value={one.value}>
              {one.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-tile bg-surface-soft p-4">
        <p className="text-xs text-muted">돌려줄 금액</p>
        <p className="mt-1 text-2xl font-bold tabular-nums tracking-[-0.02em]">{won(amount)}</p>
        <p className="mt-1 text-xs tabular-nums text-secondary">
          {won(paid)} × {refundedCredits + take} ÷ {credits}
          {refundedAmount > 0 && ` − 이미 돌려준 ${won(refundedAmount)}`}
        </p>
      </div>

      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-secondary">
        <li>PortOne 콘솔에서 이 주문을 {won(amount)} 취소합니다.</li>
        <li>취소 번호를 적고 장부에 적습니다.</li>
      </ol>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <label htmlFor={`${ids}-refund-id`} className="shrink-0 text-xs font-semibold text-muted sm:w-24">
          PG 취소 번호
        </label>
        <input
          id={`${ids}-refund-id`}
          value={refundId}
          onChange={(event) => setRefundId(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
          className={`${FIELD} w-full font-mono`}
        />
      </div>

      {failure !== null && <FailureLine>{failure}</FailureLine>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving || refundId.trim() === ''} className={BUTTON_PRIMARY}>
          장부에 적기
        </button>
        <DoneNote>{saving ? '적는 중…' : (booked ?? '')}</DoneNote>
      </div>
    </form>
  );
}
