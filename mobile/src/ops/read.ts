import { read, unread, type SkippableRead } from '@db-error';
import { HISTORY_PAGE, nextCursor, type HistoryCursor, type HistoryFilter, type HistoryLine } from '@ops/credit-grant';
import { historyLineOf, ledgerOf, memberOf, sanctionsOf, type Member, type MemberGrantLedger, type MemberSanctions } from '@ops/members';
import { NO_ORDER, orderLineOf, refundHoldOf, type RefundBasis } from '@ops/orders';
import { argsOf, isReportId, type ReportFilters } from '@ops/report-filters';
import { partiesOf, reportDetailOf, reportRowOf, type PartySummary, type ReportDetail, type ReportPage } from '@ops/reports';
import { surveyOf, type OperatorSurvey } from '@ops/survey';
import { todayFiguresOf, type TodayFigures } from '@ops/today';

import { supabase } from '@/auth/client';

import { DENIED, deniedAmong, type Denied } from './denial';

/**
 * 운영자 문을 앱 세션으로 부른다 — 웹의 `app/ops/*\/read.ts` 와 같은 문 · 같은 거절 기록이다. 운영자인지 묻지 않고 청해서 거절당하는
 * 것으로 안다(ADR 0103). 문이 읽을 때마다 DB 가 접속기록에 한 줄을 적는다.
 */
const NOT_SET = { message: 'supabase is not configured', code: 'not-set' };
const client = () => {
  if (supabase === null) throw new Error(NOT_SET.message);
  return supabase;
};

export async function operatorTodayFigures(): Promise<Denied | SkippableRead<TodayFigures>> {
  const { data, error } = await client().rpc('operator_today_figures');
  const denied = await deniedAmong('today.figures', [{ error }]);
  if (denied) return denied;
  if (error) return unread(error, 'operator_today_figures');
  const figures = todayFiguresOf(data ?? []);
  return figures === null ? unread({ message: '오늘 · 이번 주 두 줄이 아니다' }, 'operator_today_figures') : read(figures);
}

export async function operatorSurvey(): Promise<Denied | SkippableRead<OperatorSurvey>> {
  const db = client();
  const [overview, versions, tags, comments, service, serviceCounts, serviceTexts] = await Promise.all([
    db.rpc('operator_survey_overview'),
    db.rpc('operator_survey_by_version'),
    db.rpc('operator_survey_tags'),
    db.rpc('operator_survey_comments'),
    db.rpc('operator_service_survey_overview'),
    db.rpc('operator_service_survey_counts'),
    db.rpc('operator_service_survey_texts'),
  ]);
  const asked = [overview, versions, tags, comments, service, serviceCounts, serviceTexts];
  const denied = await deniedAmong('survey.overview', asked);
  if (denied) return denied;
  const failed = asked.find((answer) => answer.error !== null)?.error;
  if (failed) return unread(failed, 'operator_survey');
  const survey = surveyOf({
    overview: overview.data,
    versions: versions.data,
    tags: tags.data,
    comments: comments.data,
    service: service.data,
    serviceCounts: serviceCounts.data,
    serviceTexts: serviceTexts.data,
  });
  return survey === null ? unread({ message: '집계 한 줄이 없다' }, 'operator_survey') : read(survey);
}

export async function refundBasis(orderId: string): Promise<Denied | SkippableRead<RefundBasis | null>> {
  const db = client();
  const answer = await db.rpc('operator_reading_refund_basis', { p_order_id: orderId });
  const denied = await deniedAmong('credits.refund_basis', [answer]);
  if (denied) return denied;
  if (answer.error) return unread(answer.error, 'operator_reading_refund_basis');
  if (orderId === NO_ORDER) return read(null);
  const rows = answer.data ?? [];
  const asked = rows.find((row) => row.asked);
  const held = await db.rpc('operator_reading_refund_hold', { p_order_id: orderId });
  const deniedHold = await deniedAmong('credits.refund_status', [held]);
  if (deniedHold) return deniedHold;
  if (held.error) return unread(held.error, 'operator_reading_refund_hold');
  const hold = held.data?.[0];
  if (!asked && hold === undefined) return read(null);
  return read({
    asked: asked ? orderLineOf(asked) : null,
    others: rows.filter((row) => !row.asked).map(orderLineOf),
    hold: hold === undefined ? null : refundHoldOf(hold),
  });
}

export type MemberRead = Denied | SkippableRead<Member | null>;

export async function operatorMember(query: string | null): Promise<MemberRead> {
  const found = await client().rpc('operator_member', { p_query: query as string });
  const denied = await deniedAmong('members.find', [found]);
  if (denied) return denied;
  if (found.error) return unread(found.error, 'operator_member');
  const row = found.data?.[0];
  return read(row === undefined ? null : memberOf(row));
}

export async function memberGrantLedger(userId: string): Promise<Denied | SkippableRead<MemberGrantLedger | null>> {
  const { data, error } = await client().rpc('operator_member_grant_ledger', { p_user_id: userId });
  const denied = await deniedAmong('members.credits', [{ error }]);
  if (denied) return denied;
  if (error) return unread(error, 'operator_member_grant_ledger');
  const row = data?.[0];
  return read(row === undefined ? null : ledgerOf(row));
}

export type MemberHistory = { readonly lines: readonly HistoryLine[]; readonly next: HistoryCursor | null };

export async function memberCreditHistory(userId: string, filter: HistoryFilter, before: HistoryCursor | null): Promise<Denied | SkippableRead<MemberHistory>> {
  const { data, error } = await client().rpc('operator_member_credit_history', {
    p_user_id: userId,
    p_filter: filter,
    p_limit: HISTORY_PAGE + 1,
    ...(before === null ? {} : { p_before_at: before.at, p_before_key: before.key }),
  });
  const denied = await deniedAmong('members.credit_history', [{ error }]);
  if (denied) return denied;
  if (error) return unread(error, 'operator_member_credit_history');
  const rows = data ?? [];
  const lines = rows.slice(0, HISTORY_PAGE).map(historyLineOf);
  return read({ lines, next: nextCursor(lines, rows.length > HISTORY_PAGE) });
}

export async function memberSanctions(userId: string): Promise<Denied | SkippableRead<MemberSanctions | null>> {
  const { data, error } = await client().rpc('operator_member_sanctions', { p_user_id: userId });
  const denied = await deniedAmong('members.sanctions', [{ error }]);
  if (denied) return denied;
  if (error) return unread(error, 'operator_member_sanctions');
  const row = data?.[0];
  return read(row === undefined ? null : sanctionsOf(row));
}

export async function operatorReports(filters: ReportFilters): Promise<Denied | SkippableRead<ReportPage>> {
  const answer = await client().rpc('operator_reports', argsOf(filters) as never);
  const denied = await deniedAmong('reports.list', [answer]);
  if (denied) return denied;
  if (answer.error) return unread(answer.error, 'operator_reports');
  const rows = answer.data ?? [];
  return read({
    rows: rows.map(reportRowOf),
    pages: rows[0]?.pages ?? 0,
    openCount: rows[0]?.open_count ?? null,
    overdueCount: rows[0]?.overdue_count ?? null,
  });
}

export async function operatorReport(reportId: string): Promise<Denied | SkippableRead<ReportDetail | null>> {
  if (!isReportId(reportId)) return read(null);
  const db = client();
  const [head, copied] = await Promise.all([
    db.rpc('operator_report', { p_report_id: reportId }),
    db.rpc('operator_report_snapshot', { p_report_id: reportId }),
  ]);
  const denied = await deniedAmong('reports.detail', [head, copied], reportId);
  if (denied) return denied;
  if (head.error) return unread(head.error, 'operator_report');
  if (copied.error) return unread(copied.error, 'operator_report_snapshot');
  const row = head.data?.[0];
  return read(row === undefined ? null : reportDetailOf(row, copied.data ?? []));
}

export async function reportParties(reportId: string): Promise<SkippableRead<readonly PartySummary[]>> {
  const answer = await client().rpc('operator_report_target', { p_report_id: reportId });
  if (answer.error) return unread(answer.error, 'operator_report_target');
  return read(partiesOf(answer.data ?? []));
}

export { DENIED, NO_ORDER };
