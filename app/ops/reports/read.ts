import { rpcArgs } from '@/src/lib/db';
import { partiesOf, reportDetailOf, reportRowOf, type PartySummary, type ReportDetail, type ReportPage } from '@/src/lib/ops/reports';

import { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';
import { deniedAmong, type Denied } from '../denial';
import { argsOf, isReportId, type ReportFilters } from '@/src/lib/ops/report-filters';

/**
 * 신고와 그 근거 스냅샷이 **브라우저로 내려오는 문** (G-24 1차판, ADR 0103).
 *
 * `/ops/survey` 의 문(`../survey/read.ts`)과 같은 규율이다. **운영자인지 여기서 안 묻는다** — 묻는
 * 자리는 DB 의 `is_operator()` 하나고, 이 문은 자료를 청해서 **거절당하는 것으로 안다**(`42501`).
 *
 * 읽기만 한다 — 처분은 `actions.ts` 가 처분 문(`operator_review_report`)으로 적는다(G-111 ②, ADR 0188). **문이 읽을 때마다
 * DB 가 접속기록에 한 줄을 적는다**(G-23 ⑩) — 성공은 문 안에서, 거절은 아래 `deniedAmong` 이.
 *
 * 생성 타입은 반환 칸을 전부 `null` 이 아닌 것으로 적는다(`returns table` 의 한계). 닉네임 · 덧붙인
 * 말 · 검토 시각 · 스냅샷 칸은 실제로 비므로 여기서 한 번 `null` 로 받아 옮긴다.
 */

export { DENIED } from '../denial';
export {
  reportRowOf,
  type Account,
  type AccountNow,
  type PartySummary,
  type ReportDetail,
  type ReportRow,
  type Review,
  type Snapshot,
  type WarningRecord,
} from '@/src/lib/ops/reports';

/**
 * 한 쪽을 청한다. 목록 화면의 본체라 못 읽으면 빈 목록이 아니라 실패다 — 그 실패를 오류 경계로
 * 던지지 않고 값으로 내는 것은 운영자 화면이 제 문장(「신고를 읽지 못했습니다 …」)을 세우기 때문이다.
 */
export async function operatorReports(
  filters: ReportFilters,
): Promise<Denied | SkippableRead<ReportPage>> {
  const supabase = await supabaseOnServer();
  const answer = await supabase.rpc('operator_reports', rpcArgs<'operator_reports'>(argsOf(filters)));

  const denied = await deniedAmong(supabase, 'reports.list', [answer]);
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

/**
 * 신고 한 건과 그 스냅샷 — **둘을 함께 청하고, 하나라도 거절당하면 거절이다.**
 *
 * 없는 신고(떠난 사람의 것으로 옮겨진 신고 포함)는 `null` 이고 화면은 404 를 세운다. id 가 uuid
 * 모양이 아니면 DB 에 묻지 않고 같은 `null` 이다 — 이유는 `isReportId` 에 있다.
 */
export async function operatorReport(
  reportId: string,
): Promise<Denied | SkippableRead<ReportDetail | null>> {
  if (!isReportId(reportId)) return read(null);

  const supabase = await supabaseOnServer();
  const [head, copied] = await Promise.all([
    supabase.rpc('operator_report', { p_report_id: reportId }),
    supabase.rpc('operator_report_snapshot', { p_report_id: reportId }),
  ]);

  const denied = await deniedAmong(supabase, 'reports.detail', [head, copied], reportId);
  if (denied) return denied;
  if (head.error) return unread(head.error, 'operator_report');
  if (copied.error) return unread(copied.error, 'operator_report_snapshot');

  const row = head.data?.[0];
  if (row === undefined) return read(null);

  return read(reportDetailOf(row, copied.data ?? []));
}

/**
 * 신고 상세의 **대상 회원 요약** — 두 계정의 지금 상태 · 운영자 계정인가 · 현재 신고 기준 최근 12개월 경고 수 · 처분 이력 최근 셋.
 * 처분 폼의 「이번이 N회째」와 정지 거절의 까닭이 이것을 읽는다. 상세의 부속이라 못 읽으면 그 칸만 비운다(`SkippableRead`).
 * 거절(`42501`)은 상세 문이 이미 404 로 받으므로 여기서는 못 읽은 것으로만 낸다.
 */
export async function reportParties(reportId: string): Promise<SkippableRead<readonly PartySummary[]>> {
  const supabase = await supabaseOnServer();
  const answer = await supabase.rpc('operator_report_target', { p_report_id: reportId });
  if (answer.error) return unread(answer.error, 'operator_report_target');
  return read(
    partiesOf(answer.data ?? []),
  );
}
