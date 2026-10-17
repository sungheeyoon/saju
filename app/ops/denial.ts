import { rpcArgs } from '@/src/lib/db';

import type { supabaseOnServer } from '../auth/server-client';
import { UUID } from '../uuid';

/**
 * 운영자 화면의 문이 받은 거절을 접속기록에 적는다 (G-23 ⑩ · ADR 0105).
 *
 * 운영자 문은 거절하며 `42501` 을 던지고, 던진 트랜잭션에 적은 줄은 되감긴다. 그래서 거절을 받은 뒤 제
 * 트랜잭션에서 따로 적는다(`note_operator_denial`). 적지 못해도 화면은 404 그대로다 — 거절을 적는 일이 거절의 답을
 * 바꾸지 않는다. 못 적은 것은 기록으로만 남긴다.
 *
 * 동작 이름은 화면의 머리 문이다 — 한 화면이 문 여럿을 불러도 거절은 한 줄이다(신고 상세는 `reports.detail`, 설문은
 * `survey.overview`, 오늘의 숫자는 `today.figures`). DB 가 받는 이름은 `note_operator_denial` 의 목록 하나가 든다.
 */
export type DeniedAction =
  | 'reports.list'
  | 'reports.detail'
  | 'reports.review'
  | 'survey.overview'
  | 'today.figures'
  | 'credits.refund_basis'
  | 'credits.refund_status'
  | 'credits.refund_hold'
  | 'credits.refund_book'
  | 'credits.refund_release'
  | 'credits.grant'
  | 'credits.revoke'
  | 'members.find'
  | 'members.warnings'
  | 'members.credits'
  | 'members.credit_history'
  | 'members.sanctions'
  | 'members.suspend'
  | 'members.unsuspend';

export async function noteDenial(
  supabase: Awaited<ReturnType<typeof supabaseOnServer>>,
  action: DeniedAction,
  reportId: string | null = null,
): Promise<void> {
  const { error } = await supabase.rpc(
    'note_operator_denial',
    rpcArgs<'note_operator_denial'>({ p_action: action, p_report_id: reportId ?? undefined }),
  );
  if (error) console.error('note_operator_denial', error);
}

/** 운영자의 쓰기 동작 — 거절되면 `noteWriteRefusal` 이 적는다. DB 의 `note_operator_refusal` 이 받는 목록과 같다 */
export type WriteAction = Extract<
  DeniedAction,
  | 'reports.review'
  | 'members.suspend'
  | 'members.unsuspend'
  | 'credits.grant'
  | 'credits.revoke'
  | 'credits.refund_hold'
  | 'credits.refund_book'
  | 'credits.refund_release'
>;

/** 거절 줄의 대상 — id 만. 메모 · 판단 근거는 싣지 않는다(ADR 0105) */
export type RefusedTarget = { readonly reportId?: string; readonly userId?: string; readonly orderId?: string };

const SQLSTATE = /^[0-9A-Z]{5}$/;

/** 모양이 틀린 id 는 싣지 않는다 — 거절을 적는 부름이 다시 모양으로 거절되지 않게 */
const idOf = (value: string | undefined): string | undefined => (value !== undefined && UUID.test(value) ? value : undefined);

/** 접속기록에 적을 거절 코드 — SQLSTATE 면 그대로, 아니면(전송 오류 · PostgREST 의 코드) `other` */
export const refusalCode = (code: string | undefined): string =>
  code !== undefined && SQLSTATE.test(code) ? code : 'other';

/**
 * 운영자의 쓰기가 거절됐다고 접속기록에 적는다 (G-111 R-4 · ADR 0191).
 *
 * `42501` 은 지금처럼 `noteDenial`(운영자가 아닌 사람의 `denied`)이고, 그 밖의 거절 — 버전 충돌 `55000` · 상태 거절 `23514` · 모양
 * `22023` 등 — 은 `note_operator_refusal` 이 `refused` 한 줄로 적는다. 거절한 트랜잭션의 줄은 되감기므로 따로 적는다. 적지 못해도
 * 화면의 답은 그대로다 — 못 적은 것은 서버 기록에만 남긴다. 문을 부르기 전에 액션이 모양으로 거른 것도 `22023` 으로 적는다.
 */
export async function noteWriteRefusal(
  supabase: Awaited<ReturnType<typeof supabaseOnServer>>,
  action: WriteAction,
  code: string | undefined,
  target: RefusedTarget = {},
): Promise<void> {
  if (code === '42501') {
    await noteDenial(supabase, action, idOf(target.reportId) ?? null);
    return;
  }
  const { error } = await supabase.rpc(
    'note_operator_refusal',
    rpcArgs<'note_operator_refusal'>({
      p_action: action,
      p_code: refusalCode(code),
      p_report_id: idOf(target.reportId),
      p_user_id: idOf(target.userId),
      p_order_id: idOf(target.orderId),
    }),
  );
  if (error) console.error('note_operator_refusal', error);
}
