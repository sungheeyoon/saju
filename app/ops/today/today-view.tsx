import { won } from '@/src/lib/reading/bundle';
import { CARD } from '../../ui/surfaces';
import { sinceDay } from '@/src/lib/ops/today-labels';
import type { Figures, TodayFigures } from './read';

/** 오늘 · 이번 주의 숫자를 그리기만 한다 — 읽기와 거절은 `page.tsx` 와 문(`read.ts`)의 일이다 */
export function TodayView({ figures }: { figures: TodayFigures }) {
  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-6 py-9 sm:py-12">
      <header className="border-b border-border pb-6">
        <p className="eyebrow">운영</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">오늘의 숫자</h1>
        <p className="mt-1 text-sm text-secondary">서울 시간 기준입니다. 이번 주는 월요일부터 셉니다.</p>
      </header>

      <Span title="오늘" figures={figures.today} />
      <Span title="이번 주" figures={figures.week} />

      <p className="text-xs leading-5 text-muted">
        풀이는 완성된 것만 셉니다. 매출은 결제가 승인된 금액의 합이고, 나중에 환불돼도 줄지 않습니다 — 돌려준
        금액은 환불에 따로 섭니다. 탈퇴한 회원의 기록은 빠집니다.
      </p>
    </main>
  );
}

function Span({ title, figures }: { title: string; figures: Figures }) {
  return (
    <section className={`${CARD} flex flex-col gap-4`}>
      <h2 className="flex flex-wrap items-baseline gap-x-2 text-base font-bold">
        {title}
        <span className="text-xs font-semibold text-muted">{sinceDay(figures.since)}부터</span>
      </h2>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Figure label="가입" value={`${figures.signups}명`} />
        <Figure label="풀이" value={`${figures.readings}건`} />
        <Figure label="주문" value={`${figures.orders}건`} />
        <Figure label="매출" value={won(figures.revenue)} />
        <Figure
          label="환불"
          value={`${figures.refunds}건`}
          note={figures.refunds > 0 ? won(figures.refunded) : undefined}
        />
      </dl>
    </section>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums tracking-[-0.03em]">{value}</dd>
      {note !== undefined && <dd className="text-xs font-semibold tabular-nums text-secondary">{note}</dd>}
    </div>
  );
}
