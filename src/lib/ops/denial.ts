import { UUID } from '../uuid';

/** 운영자 문의 거절을 가르는 말 — 적는 문(`note_operator_*`)을 부르는 것은 웹 `app/ops/denial.ts` · 앱 `mobile/src/ops/denial.ts` 다(G-23 ⑩ · ADR 0105 · 0191) */
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

/** 운영자가 아니라고 DB 가 답했다(`42501`) — 운영자 문이 화면에 내는 거절. 화면은 404 를 세운다 */
export const DENIED = 'denied';
export type Denied = typeof DENIED;

/** 문이 운영자가 아닌 사람을 거절한 코드인가 — 이 코드를 가르는 자리는 이 파일뿐이다(`denial.boundary.test.ts`) */
export const isDenialCode = (code: string | undefined): boolean => code === '42501';

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
export const idOf = (value: string | undefined): string | undefined => (value !== undefined && UUID.test(value) ? value : undefined);

/** 접속기록에 적을 거절 코드 — SQLSTATE 면 그대로, 아니면(전송 오류 · PostgREST 의 코드) `other` */
export const refusalCode = (code: string | undefined): string =>
  code !== undefined && SQLSTATE.test(code) ? code : 'other';
