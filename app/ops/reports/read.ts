import { rpcArgs, type RpcRow } from '@/src/lib/db';

import { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';
import { argsOf, isReportId, type ReportFilters } from './filters';
import { sideOf } from './labels';
import { chosenOnce, type SnapshotMessage } from './snapshot';

export type { SnapshotMessage };

/**
 * 신고와 그 근거 스냅샷이 **브라우저로 내려오는 문** (G-24 1차판, ADR 0103).
 *
 * `/ops/survey` 의 문(`../survey/read.ts`)과 같은 규율이다. **운영자인지 여기서 안 묻는다** — 묻는
 * 자리는 DB 의 `is_operator()` 하나고, 이 문은 자료를 청해서 **거절당하는 것으로 안다**(`42501`).
 *
 * 읽기만 한다. 이 폴더에는 `actions.ts` 가 없다 — 검토 완료 · 제재는 1차판에 없고, 검토 완료는
 * runbook 의 SQL 한 줄이다.
 *
 * 생성 타입은 반환 칸을 전부 `null` 이 아닌 것으로 적는다(`returns table` 의 한계). 닉네임 · 덧붙인
 * 말 · 검토 시각 · 스냅샷 칸은 실제로 비므로 여기서 한 번 `null` 로 받아 옮긴다.
 */

/** 운영자가 아니라고 DB 가 답했다 — `42501` */
export const DENIED = 'denied';

type Asked = { readonly error: { readonly code?: string } | null };

const denied = (answers: readonly Asked[]): boolean =>
  answers.some((answer) => answer.error?.code === '42501');

export type Account = {
  readonly userId: string;
  readonly nickname: string | null;
};

export type ReportRow = {
  readonly reportId: string;
  readonly createdAt: string;
  readonly reason: string;
  readonly reporter: Account;
  readonly reported: Account;
  readonly reviewedAt: string | null;
  /** 저장된 메시지 수 — 대화 근거가 없으면 `null`(0 이 아니다) */
  readonly snapshotMessages: number | null;
};

export type ReportPage = {
  readonly rows: readonly ReportRow[];
  /** 거른 결과 전체의 쪽 수 — 한 쪽의 크기는 DB 만 안다 */
  readonly pages: number;
};

const rowOf = (row: RpcRow<'operator_reports'>): ReportRow => ({
  reportId: row.report_id,
  createdAt: row.created_at,
  reason: row.reason,
  reporter: { userId: row.reporter_user_id, nickname: row.reporter_nickname ?? null },
  reported: { userId: row.reported_user_id, nickname: row.reported_nickname ?? null },
  reviewedAt: row.reviewed_at ?? null,
  snapshotMessages: row.snapshot_messages ?? null,
});

/**
 * 한 쪽을 청한다. 목록 화면의 본체라 못 읽으면 빈 목록이 아니라 실패다 — 그 실패를 오류 경계로
 * 던지지 않고 값으로 내는 것은 운영자 화면이 제 문장(「신고를 읽지 못했습니다 …」)을 세우기 때문이다.
 */
export async function operatorReports(
  filters: ReportFilters,
): Promise<typeof DENIED | SkippableRead<ReportPage>> {
  const supabase = await supabaseOnServer();
  const answer = await supabase.rpc('operator_reports', rpcArgs<'operator_reports'>(argsOf(filters)));

  if (denied([answer])) return DENIED;
  if (answer.error) return unread(answer.error, 'operator_reports');

  const rows = answer.data ?? [];
  return read({ rows: rows.map(rowOf), pages: rows[0]?.pages ?? 0 });
}

export type AccountNow = Account & { readonly status: string | null };

export type Snapshot = {
  readonly capturedAt: string;
  readonly contextBefore: number;
  readonly contextAfter: number;
  readonly messages: readonly SnapshotMessage[];
};

export type ReportDetail = {
  readonly reportId: string;
  readonly createdAt: string;
  readonly reason: string;
  readonly detail: string | null;
  readonly reporter: AccountNow;
  readonly reported: AccountNow;
  readonly reviewedAt: string | null;
  /** 대화 신고가 아니면 `null` — 「대화 근거 없음」 */
  readonly snapshot: Snapshot | null;
};

/**
 * 신고 한 건과 그 스냅샷 — **둘을 함께 청하고, 하나라도 거절당하면 거절이다.**
 *
 * 없는 신고(떠난 사람의 것으로 옮겨진 신고 포함)는 `null` 이고 화면은 404 를 세운다. id 가 uuid
 * 모양이 아니면 DB 에 묻지 않고 같은 `null` 이다 — 이유는 `isReportId` 에 있다.
 */
export async function operatorReport(
  reportId: string,
): Promise<typeof DENIED | SkippableRead<ReportDetail | null>> {
  if (!isReportId(reportId)) return read(null);

  const supabase = await supabaseOnServer();
  const [head, copied] = await Promise.all([
    supabase.rpc('operator_report', { p_report_id: reportId }),
    supabase.rpc('operator_report_snapshot', { p_report_id: reportId }),
  ]);

  if (denied([head, copied])) return DENIED;
  if (head.error) return unread(head.error, 'operator_report');
  if (copied.error) return unread(copied.error, 'operator_report_snapshot');

  const row = head.data?.[0];
  if (row === undefined) return read(null);

  const capturedAt = row.captured_at ?? null;
  return read({
    reportId: row.report_id,
    createdAt: row.created_at,
    reason: row.reason,
    detail: row.detail ?? null,
    reporter: {
      userId: row.reporter_user_id,
      nickname: row.reporter_nickname ?? null,
      status: row.reporter_status ?? null,
    },
    reported: {
      userId: row.reported_user_id,
      nickname: row.reported_nickname ?? null,
      status: row.reported_status ?? null,
    },
    reviewedAt: row.reviewed_at ?? null,
    snapshot:
      capturedAt === null
        ? null
        : {
            capturedAt,
            contextBefore: row.context_before,
            contextAfter: row.context_after,
            messages: chosenOnce(
              (copied.data ?? []).map((message) => ({
                seq: message.seq,
                sentAt: message.sent_at,
                side: sideOf(message.side ?? null),
                body: message.body,
                chosen: message.chosen === true,
              })),
            ),
          },
  });
}
