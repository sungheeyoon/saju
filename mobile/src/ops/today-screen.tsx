import { won } from '@reading/bundle';
import type { Figures as SpanFigures } from '@ops/today';
import { sinceDay } from '@ops/today-labels';

import { Panel } from '@/ui/parts';

import { FailureLine, Figure, Figures, Fine, Note, OpsAbsent, OpsShell, OpsWaiting, PageHead, SPACE, SectionTitle, useOpsRead } from './parts';
import { operatorTodayFigures } from './read';

/** 오늘 · 이번 주의 숫자 — 무엇을 세는가는 DB 의 `operator_today_figures` 가 정한다(G-110 ①, ADR 0183). 열 때마다 접속기록에 한 줄 */
export default function TodayScreen() {
  const state = useOpsRead('today.figures', '/ops/today', operatorTodayFigures);
  if (state.kind === 'waiting') return <OpsWaiting />;
  if (state.kind === 'absent') return <OpsAbsent />;
  const answered = state.value;
  return (
    <OpsShell>
      <PageHead title="오늘의 숫자" note="서울 시간 기준입니다. 이번 주는 월요일부터 셉니다." />
      {!answered.ok ? (
        <FailureLine onRetry={state.reload}>오늘의 숫자를 읽지 못했습니다.</FailureLine>
      ) : (
        <>
          <Span title="오늘" figures={answered.value.today} />
          <Span title="이번 주" figures={answered.value.week} />
          <Fine>
            풀이는 완성된 것만 셉니다. 매출은 결제가 승인된 금액의 합이고, 나중에 환불돼도 줄지 않습니다 — 돌려준 금액은 환불에 따로 섭니다. 탈퇴한 회원의 기록은 빠집니다.
          </Fine>
        </>
      )}
    </OpsShell>
  );
}

function Span({ title, figures }: { title: string; figures: SpanFigures }) {
  return (
    <Panel style={SPACE.card}>
      <SectionTitle>{title}</SectionTitle>
      <Note>{`${sinceDay(figures.since)}부터`}</Note>
      <Figures>
        <Figure label="가입" value={`${figures.signups}명`} />
        <Figure label="풀이" value={`${figures.readings}건`} />
        <Figure label="주문" value={`${figures.orders}건`} />
        <Figure label="매출" value={won(figures.revenue)} />
        <Figure label="환불" value={`${figures.refunds}건`} note={figures.refunds > 0 ? won(figures.refunded) : undefined} />
      </Figures>
    </Panel>
  );
}
