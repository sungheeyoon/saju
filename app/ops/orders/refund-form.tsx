'use client';

import { useId, useState, useTransition } from 'react';

import { refundOwed } from '@/src/lib/reading/bundle';

import { actionAnswer } from '../../ui/action-answer';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../../ui/buttons';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { DoneNote } from '../../ui/done-note';
import { FailureLine } from '../../ui/failure-line';
import { FIELD } from '../../ui/fields';
import { bookRefund, holdRefund, releaseRefund } from './actions';
import { orderStatusLabel, REFUND_REASONS, refundReasonLabel, seoulTime, won } from './labels';
import type { RefundHold } from './read';

const ROW = 'flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3';
const LABEL = 'shrink-0 text-xs font-semibold text-muted sm:w-24';

/**
 * **환불 준비** — 걷을 회차 · 사유를 고르고 「환불 준비」를 누르면 DB 가 그 회차를 잠그고 금액을 확정한다(G-110 ②, ADR 0184).
 * 여기 보이는 금액은 미리 셈한 것이고(`refundOwed`, ADR 0148), 확정 금액은 DB 가 정해 진행 중인 환불(`HoldPanel`)에 선다.
 */
export function PrepareForm({
  orderId,
  paid,
  refundedAmount,
  credits,
  refundedCredits,
  unused,
}: {
  readonly orderId: string;
  readonly paid: number;
  readonly refundedAmount: number;
  readonly credits: number;
  readonly refundedCredits: number;
  /** 지금 잠글 수 있는 회차 — 1 이상일 때만 이 폼이 선다 */
  readonly unused: number;
}) {
  const [chosen, setTake] = useState(unused);
  const take = Math.min(chosen, unused);
  const [reason, setReason] = useState<string>(REFUND_REASONS[0].value);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const ids = useId();

  const amount = refundOwed({ paid, credits, refundedCredits, refundedAmount }, take);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure(null);
    startSaving(async () => {
      const answer = await actionAnswer(holdRefund({ orderId, credits: take, reason }));
      if (!answer.ok) setFailure(answer.message);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className={ROW}>
        <label htmlFor={`${ids}-take`} className={LABEL}>
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

      <div className={ROW}>
        <label htmlFor={`${ids}-reason`} className={LABEL}>
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

      <p className="text-sm text-secondary">
        준비하면 이 회차가 잠겨 이용자가 쓰지 못합니다. 그다음 PortOne 콘솔에서 취소합니다.
      </p>

      {failure !== null && <FailureLine>{failure}</FailureLine>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className={BUTTON_PRIMARY}>
          환불 준비
        </button>
        <DoneNote>{saving ? '준비하는 중…' : ''}</DoneNote>
      </div>
    </form>
  );
}

/**
 * **진행 중인 환불** — 확보된 금액 · 결제 번호 · 취소 후 잔액 · 사유를 보이고(PG 부분취소 화면의 칸), 운영자가 PortOne 콘솔에서
 * 그 금액을 취소한 뒤 취소 번호를 적어 「장부에 확정」을 누른다. 확정 전에는 「준비 취소」로 잠근 회차를 푼다 — 콘솔에서 아직
 * 취소하지 않았을 때만이고, 서버가 PortOne 의 취소 내역을 본 뒤에 푼다. 화면을 닫았다 다시 열어도, 산 사람이 떠났어도 문이
 * 진행 중인 것을 다시 내주므로 이 판이 그대로 선다.
 */
export function HoldPanel({ hold, orderId }: { readonly hold: RefundHold; readonly orderId: string }) {
  const [refundId, setRefundId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const ids = useId();

  const book = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure(null);
    startSaving(async () => {
      const answer = await actionAnswer(bookRefund({ holdId: hold.holdId, refundId }));
      if (answer.ok) setBooked(`장부에 확정했습니다 — ${orderStatusLabel(answer.value.status)}`);
      else setFailure(answer.message);
    });
  };

  const release = () => {
    setFailure(null);
    startSaving(async () => {
      const answer = await actionAnswer(releaseRefund({ orderId, holdId: hold.holdId }));
      setConfirming(false);
      if (!answer.ok) setFailure(answer.message);
    });
  };

  return (
    <form onSubmit={book} className="flex flex-col gap-4" aria-label="진행 중인 환불">
      <div className="rounded-tile border border-border-strong bg-surface-soft p-4">
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-foreground px-2.5 py-1 font-bold text-background">환불 진행 중</span>
          <span className="tabular-nums text-muted">{seoulTime(hold.heldAt)} 준비</span>
        </p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">취소할 금액</dt>
          <dd className="text-xl font-bold tabular-nums tracking-[-0.02em]">{won(hold.amount)}</dd>
          <dt className="text-muted">결제 금액</dt>
          <dd className="tabular-nums">{won(hold.paidAmount)}</dd>
          <dt className="text-muted">취소 후 잔액</dt>
          <dd className="tabular-nums">{won(hold.remainingAmount)}</dd>
          <dt className="text-muted">걷는 회차</dt>
          <dd className="tabular-nums">{hold.credits}장</dd>
          <dt className="text-muted">사유</dt>
          <dd>{refundReasonLabel(hold.reason)}</dd>
          <dt className="text-muted">결제 번호</dt>
          <dd className="break-all font-mono text-xs leading-5">{hold.orderNumber}</dd>
          <dt className="text-muted">거래 번호</dt>
          <dd className="break-all font-mono text-xs leading-5">{hold.paymentId ?? '없음'}</dd>
        </dl>
      </div>

      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-secondary">
        <li>PortOne 콘솔에서 이 결제를 {won(hold.amount)} 취소합니다.</li>
        <li>취소 번호를 적고 장부에 확정합니다.</li>
      </ol>

      <div className={ROW}>
        <label htmlFor={`${ids}-refund-id`} className={LABEL}>
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
          장부에 확정
        </button>
        <button type="button" onClick={() => setConfirming(true)} disabled={saving} className={BUTTON_SECONDARY}>
          준비 취소
        </button>
        <DoneNote>{saving ? '처리하는 중…' : (booked ?? '')}</DoneNote>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="준비를 취소할까요?"
        confirmLabel="준비 취소"
        cancelLabel="닫기"
        onConfirm={release}
        busy={saving}
      >
        <p>콘솔에서 아직 취소하지 않았을 때만 누릅니다.</p>
      </ConfirmDialog>
    </form>
  );
}
