'use server';

import { rpcArgs } from '@/src/lib/db';

import { supabaseOnServer } from '../../auth/server-client';
import { userFacingDbMessage } from '../../db-error';
import { refresh } from '../../refresh';
import { noteDenial } from '../denial';
import { GRANT_MAX, NOTE_MAX, isGrantReason, type GrantRequest } from './credit-grant';

/**
 * 무상 풀이권 지급 · 회수의 누름 (G-111 ①, ADR 0187).
 *
 * 내는 값은 확인창에 보인 고정본이다(`grantPlan`). 판정 — 운영자인가 · 상한 · 갈래 · 메모 · 관련 신고 · 회수할 수 있는 수 · 읽은
 * 버전 · 같은 요청 번호 — 은 전부 DB 의 문 안에 있다. 여기서 먼저 거르는 것은 문을 부를 것도 없는 모양뿐이다. 거절(`42501`)은
 * 그 트랜잭션의 접속기록이 되감기므로 `noteDenial` 이 따로 적는다. 성공하면 지금 화면을 서버가 다시 읽어 그린다 — 화면이 셈한
 * 값이 아니라 DB 의 새 장부 · 이력이 선다.
 */

type Answer = { readonly ok: true; readonly replayed: boolean } | { readonly ok: false; readonly message: string };

const shapeProblem = (input: GrantRequest): string | null => {
  if (!isGrantReason(input.kind, input.reason)) return '사유를 골라 주세요.';
  if (!Number.isInteger(input.credits) || input.credits < 1) return '수량을 1장 이상 골라 주세요.';
  if (input.kind === 'grant' && input.credits > GRANT_MAX) return `한 번에 1장에서 ${GRANT_MAX}장까지 지급합니다.`;
  const note = input.note.trim();
  if (note.length === 0 || note.length > NOTE_MAX) return `메모를 ${NOTE_MAX}자 안으로 적어 주세요.`;
  return null;
};

export async function bookCreditGrant(input: GrantRequest): Promise<Answer> {
  const problem = shapeProblem(input);
  if (problem !== null) return { ok: false, message: problem };

  const supabase = await supabaseOnServer();
  const { data, error } =
    input.kind === 'grant'
      ? await supabase.rpc(
          'operator_grant_reading_credits',
          rpcArgs<'operator_grant_reading_credits'>({
            p_user_id: input.userId,
            p_credits: input.credits,
            p_reason: input.reason,
            p_note: input.note,
            p_report_id: input.reportId,
            p_seen_version: input.seenVersion,
            p_request_id: input.requestId,
          }),
        )
      : await supabase.rpc(
          'operator_revoke_reading_credits',
          rpcArgs<'operator_revoke_reading_credits'>({
            p_user_id: input.userId,
            p_credits: input.credits,
            p_reason: input.reason,
            p_note: input.note,
            p_seen_version: input.seenVersion,
            p_request_id: input.requestId,
          }),
        );

  const where = input.kind === 'grant' ? 'operator_grant_reading_credits' : 'operator_revoke_reading_credits';
  if (error) {
    if (error.code === '42501') await noteDenial(supabase, input.kind === 'grant' ? 'credits.grant' : 'credits.revoke');
    return { ok: false, message: userFacingDbMessage(error, where) };
  }

  refresh('credits-granted');
  return { ok: true, replayed: data?.[0]?.replayed === true };
}
