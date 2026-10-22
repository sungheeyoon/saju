'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, useTransition } from 'react';

import { isPenalizedRefund, refundBreakdown, won } from '@/src/lib/reading/bundle';

import { ACTION_UNREACHED_NOTE, actionAnswer } from '../../ui/action-answer';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../../ui/buttons';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { DoneNote } from '../../ui/done-note';
import { FailureLine } from '../../ui/failure-line';
import { FIELD } from '../../ui/fields';
import { accountLabel } from '../account-label';
import { bookRefund, holdRefund, releaseRefund } from './actions';
import { orderStatusLabel, REFUND_REASONS, refundReasonLabel, seoulTime } from './labels';
import type { RefundHold } from './read';
import {
  BOOK_LABEL,
  oneAtATime,
  preparePlan,
  releaseLabel,
  samePlan,
  type Owner,
  type PreparePlan,
} from './refund-confirm';

const ROW = 'flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3';
const LABEL = 'shrink-0 text-xs font-semibold text-muted sm:w-24';
const FACTS = 'grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm';

/**
 * 응답을 못 받은 누름 — 서버에서 섰는지 모른다. 액션이 무른 응답이 오지 않았으므로 화면을 다시 읽어 실제 결과를 세운다(같은
 * 요청 번호 · 취소 번호로 다시 내도 한 번만 적힌다).
 */
const unreached = (message: string): boolean => message === ACTION_UNREACHED_NOTE;

/** 확인창 안의 대상 줄 — 주문 번호 · 회원(닉네임 · 계정 앞자리) */
function Target({ orderNumber, owner }: { orderNumber: string; owner: Owner }) {
  return (
    <>
      <dt className="text-muted">주문</dt>
      <dd className="break-all font-mono text-xs leading-5">{orderNumber}</dd>
      <dt className="text-muted">회원</dt>
      <dd>{accountLabel(owner.nickname, owner.ref)}</dd>
    </>
  );
}

/**
 * **환불 준비** — 걷을 회차 · 사유를 고르고 「환불 준비」를 누르면 확인창이 선다(G-110 ②, ADR 0184). 창을 여는 순간 대상 · 회차 ·
 * 금액 · 사유 · 요청 번호를 고정하고(`preparePlan`), 그 고정본을 그대로 낸다. DB 는 금액을 다시 셈해 다르면 거절하고, 같은 요청
 * 번호로 다시 오면 같은 확보를 돌려준다. 실패하면 고른 값과 요청 번호가 남아 같은 창을 다시 연다.
 */
export function PrepareForm({
  orderId,
  orderNumber,
  owner,
  paid,
  refundedAmount,
  credits,
  refundedCredits,
  penalizedCredits,
  unused,
}: {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly owner: Owner;
  readonly paid: number;
  readonly refundedAmount: number;
  readonly credits: number;
  readonly refundedCredits: number;
  /** 걷은 회차 가운데 환불수수료를 공제한 것 — 누적 공제의 셈(ADR 0192) */
  readonly penalizedCredits: number;
  /** 지금 잠글 수 있는 회차 — 1 이상일 때만 이 폼이 선다 */
  readonly unused: number;
}) {
  const router = useRouter();
  const [chosen, setTake] = useState(unused);
  const take = Math.min(chosen, unused);
  const [reason, setReason] = useState<string>(REFUND_REASONS[0].value);
  const [plan, setPlan] = useState<PreparePlan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const guard = useRef(oneAtATime());
  const ids = useId();

  const order = { orderId, paid, credits, refundedCredits, refundedAmount, penalizedCredits };
  const penalizedNow = isPenalizedRefund(reason);
  const { penalty, owed: amount } = refundBreakdown(
    { paid, credits, refundedCredits, refundedAmount, penalizedCredits },
    take,
    penalizedNow,
  );

  const open = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure(null);
    // 같은 준비를 다시 여는 것(앞의 응답이 끊겼다)이면 요청 번호를 다시 쓴다 — 서버가 같은 확보를 돌려준다
    setPlan(
      samePlan(plan, orderId, take, reason, amount)
        ? plan
        : preparePlan(order, take, reason, crypto.randomUUID()),
    );
    setConfirming(true);
  };

  const confirm = () => {
    if (plan === null) return;
    guard.current.run(
      () =>
        new Promise<void>((done) => {
          startSaving(async () => {
            const answer = await actionAnswer(holdRefund(plan.request));
            if (answer.ok) {
              setConfirming(false);
              setPlan(null);
            } else {
              setFailure(answer.message);
              if (unreached(answer.message)) router.refresh();
            }
            done();
          });
        }),
    );
  };

  return (
    <form onSubmit={open} className="flex flex-col gap-4">
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
          {penalty > 0 && (penalizedNow ? ` − 환불수수료 ${won(penalty)}` : ` − 앞서 공제한 환불수수료 ${won(penalty)}`)}
          {refundedAmount > 0 && ` − 이미 돌려준 ${won(refundedAmount)}`}
        </p>
      </div>

      <p className="text-sm text-secondary">
        준비하면 이 회차가 잠겨 이용자가 쓰지 못합니다. 그다음 PortOne 콘솔에서 취소합니다.
      </p>

      {failure !== null && !confirming && <FailureLine>{failure}</FailureLine>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className={BUTTON_PRIMARY}>
          환불 준비
        </button>
        <DoneNote>{saving ? '준비하는 중…' : ''}</DoneNote>
      </div>

      {plan !== null && (
        <ConfirmDialog
          open={confirming}
          onClose={() => setConfirming(false)}
          title="환불을 준비할까요?"
          confirmLabel={plan.confirmLabel}
          cancelLabel="닫기"
          onConfirm={confirm}
          busy={saving}
          failure={failure}
        >
          <dl className={FACTS}>
            <Target orderNumber={orderNumber} owner={owner} />
            <dt className="text-muted">회차 · 금액</dt>
            <dd className="tabular-nums">
              {plan.request.credits}장 · {won(plan.request.expectedAmount)}
            </dd>
            <dt className="text-muted">사유</dt>
            <dd>{refundReasonLabel(plan.request.reason)}</dd>
          </dl>
          <p>이 회차가 잠겨 이용자가 쓰지 못합니다. 그다음 PortOne 콘솔에서 이 금액을 취소합니다.</p>
        </ConfirmDialog>
      )}
    </form>
  );
}

/**
 * **진행 중인 환불** — 확보된 금액 · 결제 번호 · 취소 후 잔액 · 사유를 보이고(PG 부분취소 화면의 칸), 운영자가 PortOne 콘솔에서
 * 그 금액을 취소한 뒤 취소 번호를 적어 「장부에 확정」을 누른다. 확정 전에는 「준비 취소」로 잠근 회차를 푼다 — 콘솔에서 아직
 * 취소하지 않았을 때만이고, 서버가 PortOne 의 취소 내역을 장부와 견준 뒤에 푼다. 두 동작 다 확인창이 대상 · 금액 · 회차를
 * 다시 보이고, 창을 연 순간의 취소 번호를 낸다. 확보 번호가 금액 · 회차를 고정하므로 서버는 그 확보로만 셈한다. 화면을 닫았다
 * 다시 열어도, 산 사람이 떠났어도 문이 진행 중인 것을 다시 내주므로 이 판이 그대로 선다.
 */
export function HoldPanel({ hold, orderId }: { readonly hold: RefundHold; readonly orderId: string }) {
  const router = useRouter();
  const [refundId, setRefundId] = useState('');
  const [frozenRefundId, setFrozenRefundId] = useState('');
  const [dialog, setDialog] = useState<'book' | 'release' | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const guard = useRef(oneAtATime());
  const ids = useId();

  const run = (call: () => Promise<{ ok: boolean; message?: string; done?: string }>) =>
    guard.current.run(
      () =>
        new Promise<void>((done) => {
          startSaving(async () => {
            const answer = await call();
            if (answer.ok) {
              setDialog(null);
              if (answer.done) setBooked(answer.done);
            } else if (answer.message !== undefined) {
              setFailure(answer.message);
              if (unreached(answer.message)) router.refresh();
            }
            done();
          });
        }),
    );

  const openBook = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure(null);
    setFrozenRefundId(refundId.trim());
    setDialog('book');
  };

  const book = () =>
    run(async () => {
      const answer = await actionAnswer(bookRefund({ orderId, holdId: hold.holdId, refundId: frozenRefundId }));
      return answer.ok
        ? { ok: true, done: `장부에 확정했습니다 — ${orderStatusLabel(answer.value.status)}` }
        : { ok: false, message: answer.message };
    });

  const release = () =>
    run(async () => {
      const answer = await actionAnswer(releaseRefund({ orderId, holdId: hold.holdId }));
      return answer.ok ? { ok: true } : { ok: false, message: answer.message };
    });

  const facts = (
    <dl className={FACTS}>
      <Target orderNumber={hold.orderNumber} owner={hold.owner} />
      <dt className="text-muted">회차 · 금액</dt>
      <dd className="tabular-nums">
        {hold.credits}장 · {won(hold.amount)}
      </dd>
      <dt className="text-muted">사유</dt>
      <dd>{refundReasonLabel(hold.reason)}</dd>
    </dl>
  );

  return (
    <form onSubmit={openBook} className="flex flex-col gap-4" aria-label="진행 중인 환불">
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
          <dt className="text-muted">회원</dt>
          <dd>{accountLabel(hold.owner.nickname, hold.owner.ref)}</dd>
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

      {failure !== null && dialog === null && <FailureLine>{failure}</FailureLine>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving || refundId.trim() === ''} className={BUTTON_PRIMARY}>
          {BOOK_LABEL}
        </button>
        <button
          type="button"
          onClick={() => {
            setFailure(null);
            setDialog('release');
          }}
          disabled={saving}
          className={BUTTON_SECONDARY}
        >
          준비 취소
        </button>
        <DoneNote>{saving ? '처리하는 중…' : (booked ?? '')}</DoneNote>
      </div>

      <ConfirmDialog
        open={dialog === 'book'}
        onClose={() => setDialog(null)}
        title="장부에 확정할까요?"
        confirmLabel={BOOK_LABEL}
        cancelLabel="닫기"
        onConfirm={book}
        busy={saving}
        failure={dialog === 'book' ? failure : null}
      >
        {facts}
        <dl className={FACTS}>
          <dt className="text-muted">PG 취소 번호</dt>
          <dd className="break-all font-mono text-xs leading-5">{frozenRefundId}</dd>
        </dl>
        <p>콘솔에서 이 금액을 취소한 뒤에만 누릅니다. 장부에 환불이 적히고 회차가 걷힙니다.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'release'}
        onClose={() => setDialog(null)}
        title="준비를 취소할까요?"
        confirmLabel={releaseLabel(hold.credits)}
        cancelLabel="닫기"
        onConfirm={release}
        busy={saving}
        failure={dialog === 'release' ? failure : null}
      >
        {facts}
        <p>콘솔에서 아직 취소하지 않았을 때만 누릅니다. 잠근 회차가 이용자에게 돌아갑니다.</p>
      </ConfirmDialog>
    </form>
  );
}
