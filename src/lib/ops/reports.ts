import type { RpcRow } from '../db';
import { sideOf, type Side } from './report-labels';
import { reviewLogOf, sanctionLinesOf, type Party, type ReviewLogLine, type SanctionLine } from './report-review';
import { chosenOnce, type SnapshotMessage } from './report-snapshot';

/** 신고 · 근거 스냅샷 · 대상 요약을 화면의 값으로 옮긴다 — 웹과 앱이 함께 쓴다 (G-24, ADR 0103 · 0188). 비는 칸은 여기서 한 번 `null` 로 받는다 */
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
  /** 처리 필요인가 — 정의는 DB 의 `report_is_open` 하나다(ADR 0107) */
  readonly isOpen: boolean;
  /** 검토 결과 — 검토 문(`review_report`)이 적는다(ADR 0105 · 0107). 없으면 `null` */
  readonly reviewOutcome: string | null;
  /** 저장된 메시지 수 — 대화 근거가 없으면 `null`(0 이 아니다) */
  readonly snapshotMessages: number | null;
  /** 안내번호 — 경고로 적힌 적이 있으면 있다(이의 제기를 인정한 뒤에도 남는다, ADR 0108) */
  readonly warningRef: string | null;
  /**
   * 신고한 사람이 고른 메시지의 첫 줄 — 신고 당시의 사본에서 DB 가 60자까지 잘라 낸다(화면 점검 C17). 대화 근거가 없거나
   * 고른 메시지가 없으면 `null`. 이 칸이 생기기 전의 DB 는 칸 자체가 없다 — 그때도 `null` 이다
   */
  readonly chosenExcerpt: string | null;
  /** 처리 필요이고 접수 뒤 3영업일을 넘겼다 — 셈은 DB 의 `report_is_overdue` 하나다 */
  readonly overdue: boolean;
};

export type ReportPage = {
  readonly rows: readonly ReportRow[];
  /** 거른 결과 전체의 쪽 수 — 한 쪽의 크기는 DB 만 안다 */
  readonly pages: number;
  /** 머리의 두 수 — 거르기와 무관한 처리 필요 · 그중 기한 지남. 줄이 없으면 모른다(`null`) */
  readonly openCount: number | null;
  readonly overdueCount: number | null;
};

/** 목록 문의 한 줄을 화면의 값으로 옮긴다 — 비는 칸은 여기서 한 번 `null` 로 받는다(위 머리말) */
export const reportRowOf = (row: RpcRow<'operator_reports'>): ReportRow => ({
  reportId: row.report_id,
  createdAt: row.created_at,
  reason: row.reason,
  reporter: { userId: row.reporter_user_id, nickname: row.reporter_nickname ?? null },
  reported: { userId: row.reported_user_id, nickname: row.reported_nickname ?? null },
  reviewedAt: row.reviewed_at ?? null,
  isOpen: row.is_open,
  reviewOutcome: row.review_outcome ?? null,
  snapshotMessages: row.snapshot_messages ?? null,
  warningRef: row.warning_ref ?? null,
  chosenExcerpt: row.chosen_excerpt ?? null,
  overdue: row.overdue === true,
});

export type AccountNow = Account & { readonly status: string | null };

export type Snapshot = {
  readonly capturedAt: string;
  readonly contextBefore: number;
  readonly contextAfter: number;
  readonly messages: readonly SnapshotMessage[];
};

export type Review = {
  readonly outcome: string;
  readonly note: string | null;
  /** 당시 제재 대상 — 기록된 `sanctioned_user_id` 의 신고 안의 자리. 제재가 없으면 `null` */
  readonly sanctioned: Side | null;
  readonly reviewerNickname: string | null;
};

/** 경고로 적힌 적이 있는 신고의 안내 — 이용자에게 간 것(갈래 · 안내번호)과 이용자가 확인했는가(ADR 0108) */
export type WarningRecord = {
  readonly ref: string;
  /** 지금 경고면 갈래가 있고, 이의 제기를 인정해 결과가 바뀌었으면 `null` */
  readonly category: string | null;
  readonly acknowledgedAt: string | null;
};

export type ReportDetail = {
  readonly reportId: string;
  readonly createdAt: string;
  readonly reason: string;
  readonly detail: string | null;
  readonly reporter: AccountNow;
  readonly reported: AccountNow;
  readonly reviewedAt: string | null;
  /** 처리 필요인가 — 목록과 같은 정의(`report_is_open`, ADR 0107) */
  readonly isOpen: boolean;
  /** 검토 기록(ADR 0105) — 검토 문이 채운다. 결과가 없으면 `null` */
  readonly review: Review | null;
  /** 경고의 안내 — 경고로 적힌 적이 없으면 `null` */
  readonly warning: WarningRecord | null;
  /** 대화 신고가 아니면 `null` — 「대화 근거 없음」 */
  readonly snapshot: Snapshot | null;
  /** 처리 버전 — 처분 이력 줄 수. 처분 폼이 함께 낸다(ADR 0188) */
  readonly version: number;
  /** 처분 이력 — 최근 것부터, 지금 결과까지 */
  readonly reviewLog: readonly ReviewLogLine[];
  /** 이 신고의 이용 정지 결정을 바꿨는데 그 계정이 아직 정지면 그 자리 — 해제는 회원 화면에서(G-111 ③) */
  readonly heldSuspension: Side | null;
};

/** 신고 한 건과 그 스냅샷의 답 — 두 문을 함께 옮긴다 */
export function reportDetailOf(
  row: RpcRow<'operator_report'>,
  copied: readonly RpcRow<'operator_report_snapshot'>[],
): ReportDetail {
  const capturedAt = row.captured_at ?? null;
  return {
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
    isOpen: row.is_open,
    review:
      (row.review_outcome ?? null) === null
        ? null
        : {
            outcome: row.review_outcome,
            note: row.review_note ?? null,
            sanctioned: sideOf(row.sanctioned_side ?? null),
            reviewerNickname: row.reviewer_nickname ?? null,
          },
    warning:
      (row.warning_ref ?? null) === null
        ? null
        : {
            ref: row.warning_ref,
            category: row.warning_category ?? null,
            acknowledgedAt: row.warning_acknowledged_at ?? null,
          },
    snapshot:
      capturedAt === null
        ? null
        : {
            capturedAt,
            contextBefore: row.context_before,
            contextAfter: row.context_after,
            messages: chosenOnce(
              copied.map((message) => ({
                seq: message.seq,
                sentAt: message.sent_at,
                side: sideOf(message.side ?? null),
                body: message.body,
                chosen: message.chosen === true,
              })),
            ),
          },
    version: row.review_version ?? 0,
    reviewLog: reviewLogOf(row.review_log ?? null),
    heldSuspension: sideOf(row.held_suspension_side ?? null),
  };
}

/** 대상 회원 요약의 한 계정 — 처분 이력 최근 셋과 함께 */
export type PartySummary = Party & { readonly recent: readonly SanctionLine[] };

export const partiesOf = (rows: readonly RpcRow<'operator_report_target'>[]): readonly PartySummary[] =>
  rows.flatMap((row): PartySummary[] => {
      const side = sideOf(row.side ?? null);
      if (side === null) return [];
      return [
        {
          side,
          userId: row.user_id,
          nickname: row.nickname ?? null,
          status: row.status ?? null,
          isOperator: row.is_operator === true,
          warnings12m: row.warnings_12m ?? 0,
          warnedHere: row.warned_here === true,
          recent: sanctionLinesOf(row.recent ?? null),
        },
      ];
    });
