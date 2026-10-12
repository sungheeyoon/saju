import Link from 'next/link';

import { BUTTON_TERTIARY } from '../../../ui/buttons';
import { CARD, COLUMN, TYPE_META, TYPE_NAME, TYPE_TITLE } from '../../../ui/surfaces';
import { won } from '../won';
import type { PaidOrder } from './orders';

function OrderCard({ order }: { order: PaidOrder }) {
  const rows: (readonly [string, string])[] = [
    ['주문 번호', order.orderNumber],
    ['결제 금액', won(order.amount)],
    ...(order.refundedAmount > 0 ? [['환불 금액', won(order.refundedAmount)] as const] : []),
    ['결제 시각', order.paidAt],
    ['유효기간', `${order.validUntil}까지`],
    ['남은 회차', `${order.remaining}회`],
  ];
  return (
    <li className={`${CARD} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className={TYPE_NAME}>{order.product}</h2>
        <span className="rounded-full bg-cream px-2 py-0.5 text-fine font-semibold text-cream-ink">{order.status}</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body leading-6">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-secondary">{label}</dt>
            <dd className="min-w-0 break-all text-foreground tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

/**
 * 결제 내역의 몸 — 산 묶음 카드들과 환불 신청 절(ADR 0174). 읽기는 `page.tsx` 가 하고 여기는 받은 값을 그리기만 한다.
 */
export function HistoryView({ orders, refundLine }: { orders: readonly PaidOrder[]; refundLine: string }) {
  return (
    <main className={`app-shell flex w-full ${COLUMN} flex-1 flex-col gap-6 py-8 sm:py-12`}>
      <header className="flex flex-col gap-1">
        <h1 className={TYPE_TITLE}>결제 내역</h1>
      </header>

      {orders.length === 0 ? (
        <p className={TYPE_META}>결제 내역이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderCard key={order.orderNumber} order={order} />
          ))}
        </ul>
      )}

      <section aria-labelledby="refund-how" className={`${CARD} flex flex-col gap-2`}>
        <h2 id="refund-how" className={TYPE_NAME}>
          환불 신청
        </h2>
        <p className="text-body leading-7 text-secondary">{refundLine}</p>
        <p className="text-body leading-7 text-secondary">주문 번호를 함께 알려 주세요.</p>
        <p>
          <Link href="/refund" className={BUTTON_TERTIARY}>
            환불정책 보기
          </Link>
        </p>
      </section>
    </main>
  );
}
