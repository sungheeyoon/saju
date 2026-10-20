import Link from 'next/link';

import { CARD } from '../../ui/surfaces';
import { orderStatusLabel, seoulTime, won } from './labels';
import { refundForAllUnused, type OrderLine, type RefundHold } from './read';
import { ownerLabel } from './refund-confirm';
import { HoldPanel, PrepareForm } from './refund-form';

/**
 * 찾은 주문 — 결제 · 묶음 · 쓰임과 환불의 한 걸음(G-110 ②, ADR 0184). 진행 중인 환불이 있으면 그것을 이어서 확정하는 판이,
 * 없으면 준비하는 폼이 선다 — 같은 주문에 진행 중인 환불은 하나뿐이다.
 */
export function Asked({ line, hold }: { line: OrderLine; hold: RefundHold | null }) {
  const bundle = line.bundle;
  return (
    <section aria-label="찾은 주문" className={`${CARD} flex flex-col gap-5`}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-xl font-bold tracking-[-0.02em]">
            {bundle === null ? '묶음 없음' : `풀이권 ${bundle.credits}장`} · {won(line.amount)}
          </span>
          <span className="rounded-full bg-surface-soft px-2.5 py-1 text-xs font-semibold text-secondary">
            {orderStatusLabel(line.status)}
          </span>
        </p>
        <p className="mt-1 break-all font-mono text-xs text-muted">{line.orderNumber}</p>
        <p className="mt-1 text-xs text-secondary">회원 {ownerLabel(line.owner)}</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">결제</dt>
        <dd className="tabular-nums">{line.approvedAt === null ? '결제 전' : seoulTime(line.approvedAt)}</dd>
        <dt className="text-muted">거래 번호</dt>
        <dd className="break-all font-mono text-xs leading-5">{line.paymentId ?? '없음'}</dd>
        <dt className="text-muted">돌려준 금액</dt>
        <dd className="tabular-nums">{won(line.refundedAmount)}</dd>
        {bundle !== null && (
          <>
            <dt className="text-muted">회차</dt>
            <dd className="tabular-nums">
              산 {bundle.credits} · 쓴 {bundle.used} · 예약 중 {bundle.reserved} · 걷은 {bundle.refundedCredits}
              {hold !== null && ` · 환불 진행 중 ${hold.credits}`} · 안 쓴 <strong>{bundle.unused}</strong>
            </dd>
            <dt className="text-muted">유효기간</dt>
            <dd className="tabular-nums">{bundle.validUntil}까지</dd>
          </>
        )}
      </dl>

      {hold !== null ? (
        <div className="border-t border-border pt-5">
          <HoldPanel hold={hold} orderId={line.orderId} />
        </div>
      ) : bundle === null ? (
        <p className="text-sm text-secondary">결제되지 않은 주문이라 환불할 것이 없습니다.</p>
      ) : bundle.unused === 0 ? (
        <p className="text-sm text-secondary">
          {bundle.reserved > 0
            ? '예약 중인 회차는 풀린 뒤에 걷을 수 있습니다.'
            : '걷을 수 있는 회차가 없습니다.'}
        </p>
      ) : line.status !== 'approved' && line.status !== 'partially_refunded' ? (
        <p className="text-sm text-secondary">환불할 수 없는 상태의 주문입니다.</p>
      ) : (
        <div className="flex flex-col gap-4 border-t border-border pt-5">
          <p className="text-sm text-secondary">
            안 쓴 {bundle.unused}장을 다 걷으면 {won(refundForAllUnused(line, false))}, 청약철회 기간 경과 후(10% 공제)면{' '}
            {won(refundForAllUnused(line, true))}입니다.
            {bundle.reserved > 0 && ` 예약 중 ${bundle.reserved}장은 풀린 뒤에 걷을 수 있습니다.`}
          </p>
          <PrepareForm
            orderId={line.orderId}
            orderNumber={line.orderNumber}
            owner={line.owner}
            paid={line.amount}
            refundedAmount={line.refundedAmount}
            credits={bundle.credits}
            refundedCredits={bundle.refundedCredits}
            penalizedCredits={bundle.penalizedCredits}
            unused={bundle.unused}
          />
        </div>
      )}
    </section>
  );
}

/**
 * 산 사람이 떠나 주문이 지워졌는데 진행 중인 환불이 남은 주문 — 결제는 보관 표에 있고, 확보가 든 값으로 이어서 확정하거나
 * 준비 취소한다(ADR 0184). 계정은 이미 없다.
 */
export function Departed({ orderId, hold }: { orderId: string; hold: RefundHold }) {
  return (
    <section aria-label="떠난 사람의 주문" className={`${CARD} flex flex-col gap-5`}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-xl font-bold tracking-[-0.02em]">{won(hold.paidAmount)}</span>
          <span className="rounded-full bg-surface-soft px-2.5 py-1 text-xs font-semibold text-secondary">
            탈퇴한 계정의 주문
          </span>
        </p>
        <p className="mt-1 break-all font-mono text-xs text-muted">{hold.orderNumber}</p>
        <p className="mt-2 text-sm text-secondary">결제 기록은 보관 중입니다. 진행 중인 환불을 마무리합니다.</p>
      </div>
      <div className="border-t border-border pt-5">
        <HoldPanel hold={hold} orderId={orderId} />
      </div>
    </section>
  );
}

/** 같은 계정의 다른 주문 — 한 줄씩. 그 번호로 다시 찾을 수 있다 */
export function Others({ lines }: { lines: readonly OrderLine[] }) {
  return (
    <section aria-label="같은 계정의 다른 주문" className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-secondary">같은 계정의 다른 주문</h2>
      <ul className="flex flex-col gap-2">
        {lines.map((line) => (
          <li key={line.orderId} className={`${CARD} flex flex-col gap-1`}>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-semibold">
                {line.bundle === null ? '묶음 없음' : `풀이권 ${line.bundle.credits}장`} · {won(line.amount)}
              </span>
              <span className="text-xs text-muted">{orderStatusLabel(line.status)}</span>
              {line.bundle !== null && (
                <span className="text-xs tabular-nums text-muted">안 쓴 {line.bundle.unused}장</span>
              )}
            </p>
            <Link
              href={`/ops/orders?order=${line.orderNumber}`}
              className="self-start break-all font-mono text-xs text-accent underline-offset-4 hover:underline"
            >
              {line.orderNumber}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
