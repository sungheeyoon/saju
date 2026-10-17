'use server';

import { rpcArgs } from '@/src/lib/db';

import { supabaseOnServer } from '../../auth/server-client';
import { userFacingDbMessage } from '../../db-error';
import { refresh } from '../../refresh';
import { UUID } from '../../uuid';
import { noteWriteRefusal } from '../denial';
import { NOTE_MAX, WARNING_CATEGORIES, isOutcome, sanctions, type ReviewRequest } from './review';

/**
 * 신고 처분의 누름 (G-111 ②, ADR 0188).
 *
 * 내는 값은 처분 단추를 누를 때 고정한 것이다(`reviewPlan`). 판정 — 운영자인가 · 신고 · 제재 대상 · 읽은 처리 버전 · 같은 요청
 * 번호 · 정지할 수 있는 계정인가 — 은 전부 DB 의 문 안에 있다. 여기서 먼저 거르는 것은 문을 부를 것도 없는 모양뿐이다. 거절은
 * 그 트랜잭션의 접속기록이 되감기므로 `noteWriteRefusal` 이 따로 적는다 — 운영자가 아니면(`42501`) `denied`, 그 밖의 거절과 여기서
 * 거른 모양은 `refused`(G-111 R-4). 성공하면 지금 화면을 서버가 다시 읽어 그린다 —
 * 화면이 셈한 값이 아니라 DB 의 새 결과 · 버전 · 이력이 선다.
 */

type Answer = { readonly ok: true; readonly replayed: boolean } | { readonly ok: false; readonly message: string };

const shapeProblem = (input: ReviewRequest): string | null => {
  if (!isOutcome(input.outcome)) return '처분을 골라 주세요.';
  const note = input.note.trim();
  if (note.length === 0) return '판단 근거를 적어 주세요.';
  if (note.length > NOTE_MAX) return `판단 근거를 ${NOTE_MAX}자 안으로 적어 주세요.`;
  if (sanctions(input.outcome) !== (input.sanctionedUserId !== null)) return '제재 대상을 골라 주세요.';
  if (
    input.warningCategory !== null &&
    (input.outcome !== 'warning' || !WARNING_CATEGORIES.some((reason) => reason.value === input.warningCategory))
  ) {
    return '경고 갈래를 골라 주세요.';
  }
  if (!Number.isInteger(input.seenVersion) || input.seenVersion < 0) return '읽은 버전이 없습니다. 화면을 새로 열어 주세요.';
  if (!UUID.test(input.reportId) || !UUID.test(input.requestId)) return '화면을 새로 열어 주세요.';
  return null;
};

export async function writeReview(input: ReviewRequest): Promise<Answer> {
  const problem = shapeProblem(input);
  const supabase = await supabaseOnServer();
  if (problem !== null) {
    await noteWriteRefusal(supabase, 'reports.review', '22023', { reportId: input.reportId });
    return { ok: false, message: problem };
  }

  const { data, error } = await supabase.rpc(
    'operator_review_report',
    rpcArgs<'operator_review_report'>({
      p_report_id: input.reportId,
      p_outcome: input.outcome,
      p_note: input.note.trim(),
      p_sanctioned_user_id: input.sanctionedUserId,
      p_warning_category: input.warningCategory,
      p_seen_version: input.seenVersion,
      p_request_id: input.requestId,
    }),
  );

  // 거절이어도 지금 화면을 다시 그려 싣는다 — 다른 운영자가 먼저 적었으면 그 결과 · 버전이 선다
  refresh('report-reviewed');

  if (error) {
    await noteWriteRefusal(supabase, 'reports.review', error.code, { reportId: input.reportId });
    return { ok: false, message: userFacingDbMessage(error, 'operator_review_report') };
  }
  return { ok: true, replayed: data?.[0]?.replayed === true };
}
