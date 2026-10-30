import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { NO_FILTERS, filterSummary, filtersOf, isFiltered, isUrgentList, type ReportFilters } from '@ops/report-filters';
import { CHOSEN_MESSAGE_LABEL, EVIDENCE_LABEL, NO_NICKNAME, REVIEW_LABEL, WARNING_LABEL, evidenceTime, reasonLabel, reviewOutcomeLabel, reviewStateLabel } from '@ops/report-labels';
import { WARNING_CATEGORIES } from '@ops/report-review';
import { openByReported } from '@ops/report-same-account';
import type { ReportRow } from '@ops/reports';

import { Panel, SecondaryButton, TextButton } from '@/ui/parts';

import { Body, FailureLine, Fact, Fine, Mono, Note, OpsAbsent, OpsShell, OpsWaiting, PageHead, Pick, SPACE, SearchRow, SectionTitle, Tag, Tags, go, useOpsRead } from './parts';
import { operatorReports } from './read';

const URGENT_LABEL = { harassment: '괴롭힘 · 위협', overdue: '기한 지남' } as const;

/** 신고 — 처음 열면 처리 필요를 급한 순으로(G-111-6). 차례와 기한의 셈은 DB 다. 거른 상태는 화면 안에 둔다 */
export default function ReportsScreen() {
  const [filters, setFilters] = useState<ReportFilters>(NO_FILTERS);
  const [panel, setPanel] = useState(false);
  const [ref, setRef] = useState('');
  const load = useCallback(() => operatorReports(filters), [filters]);
  const state = useOpsRead('reports.list', '/ops/reports', load);


  if (state.kind === 'waiting') return <OpsWaiting />;
  if (state.kind === 'absent') return <OpsAbsent />;
  const listed = state.value;
  const change = (next: Partial<ReportFilters>) => setFilters({ ...filters, page: 1, ...next });
  const openOnPage = listed.ok ? openByReported(listed.value.rows) : new Map<string, number>();
  const open = panel || isFiltered(filters);
  return (
    <OpsShell>
      <PageHead title="신고" />
      {listed.ok && listed.value.openCount !== null && listed.value.overdueCount !== null && <Note>{`처리 필요 ${listed.value.openCount}건 · 기한 지남 ${listed.value.overdueCount}건`}</Note>}
      <Panel style={SPACE.card}>
        <TextButton label={`거르기 · ${filterSummary(filters)}`} onPress={() => setPanel(!open)} />
        {open && (
          <View style={SPACE.card}>
            <SearchRow label={WARNING_LABEL.ref} value={ref} onChange={setRef} onSubmit={() => setFilters(filtersOf({ ref, reason: filters.reason ?? undefined, evidence: filters.evidence }))} button={WARNING_LABEL.search} placeholder="W-7K3F" />
            <Pick
              label="처리 상태"
              value={filters.review}
              onPick={(review) => change({ review })}
              options={[
                { value: 'all', label: '전체' },
                { value: 'open', label: REVIEW_LABEL.open },
                { value: 'done', label: REVIEW_LABEL.done },
              ]}
            />
            <Pick
              label="신고 사유"
              value={filters.reason ?? 'all'}
              onPick={(reason) => change({ reason: reason === 'all' ? null : (reason as ReportFilters['reason']) })}
              options={[{ value: 'all', label: '전체' }, ...WARNING_CATEGORIES.map((one) => ({ value: one.value as string, label: one.label }))]}
            />
            <Pick
              label="대화 근거"
              value={filters.evidence}
              onPick={(evidence) => change({ evidence })}
              options={[
                { value: 'all', label: '전체' },
                { value: 'chat', label: EVIDENCE_LABEL.chat },
                { value: 'none', label: EVIDENCE_LABEL.none },
              ]}
            />
          </View>
        )}
      </Panel>
      {!listed.ok ? (
        <FailureLine onRetry={state.reload}>신고를 읽지 못했습니다.</FailureLine>
      ) : listed.value.rows.length === 0 ? (
        <Note>{isFiltered(filters) ? '조건에 맞는 신고가 없습니다.' : isUrgentList(filters) ? '처리할 신고가 없습니다.' : '접수된 신고가 없습니다.'}</Note>
      ) : (
        <>
          {listed.value.rows.map((row) => (
            <Row key={row.reportId} row={row} openOnPage={openOnPage.get(row.reported.userId) ?? 0} />
          ))}
          <Pages filters={filters} pages={listed.value.pages} onPage={(page) => setFilters({ ...filters, page })} />
        </>
      )}
    </OpsShell>
  );
}

function Row({ row, openOnPage }: { row: ReportRow; openOnPage: number }) {
  return (
    <Panel style={SPACE.card}>
      <Fact label="신고받은 계정">
        <SectionTitle>{row.reported.nickname ?? NO_NICKNAME}</SectionTitle>
        {openOnPage > 1 && <Tags><Tag>{`이 쪽에서 처리 필요 ${openOnPage}건`}</Tag></Tags>}
        <Mono>{row.reported.userId}</Mono>
      </Fact>
      <Body>{reasonLabel(row.reason)}</Body>
      <Fine>{evidenceTime(row.createdAt)}</Fine>
      {row.chosenExcerpt !== null && (
        <Fact label={CHOSEN_MESSAGE_LABEL}>
          <Note>{row.chosenExcerpt}</Note>
        </Fact>
      )}
      <Fact label="신고한 계정">
        <Note>{row.reporter.nickname ?? NO_NICKNAME}</Note>
        <Mono>{row.reporter.userId}</Mono>
      </Fact>
      <Tags>
        {row.isOpen && row.reason === 'harassment' && <Tag tone="danger">{URGENT_LABEL.harassment}</Tag>}
        {row.overdue && <Tag tone="danger">{URGENT_LABEL.overdue}</Tag>}
        <Tag>{`${reviewStateLabel(row.isOpen)}${row.reviewOutcome !== null ? ` · ${reviewOutcomeLabel(row.reviewOutcome)}` : ''}`}</Tag>
        <Tag>{row.snapshotMessages === null ? EVIDENCE_LABEL.none : `${EVIDENCE_LABEL.chat} · 메시지 ${row.snapshotMessages}건`}</Tag>
        {row.warningRef !== null && <Tag>{`${WARNING_LABEL.ref} ${row.warningRef}`}</Tag>}
      </Tags>
      <SecondaryButton label="신고 내용 보기" onPress={() => go(`/ops/reports/${row.reportId}`)} />
    </Panel>
  );
}

function Pages({ filters, pages, onPage }: { filters: ReportFilters; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1 && filters.page === 1) return null;
  return (
    <View style={SPACE.row}>
      {filters.page > 1 && <SecondaryButton label="이전 쪽" onPress={() => onPage(filters.page - 1)} />}
      <Fine>{`${filters.page} / ${Math.max(pages, filters.page)}쪽`}</Fine>
      {filters.page < pages && <SecondaryButton label="다음 쪽" onPress={() => onPage(filters.page + 1)} />}
    </View>
  );
}
