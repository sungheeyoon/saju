import {
  DENIED,
  idOf,
  isDenialCode,
  refusalCode,
  type Denied,
  type DeniedAction,
  type RefusedTarget,
  type WriteAction,
} from '@ops/denial';
import { backTo, secondFactorHref } from '@ops/return-path';
import { SIGN_IN_AGAIN_NOTE } from '@sign-in-again';

import { supabase } from '@/auth/client';

/**
 * 운영자 문 앞의 두 번째 요소와 거절의 기록 — 웹 `app/ops/second-factor.ts` · `app/ops/denial.ts` 와 같은 차례다(ADR 0209 · 0105 · 0191).
 *
 * **이 파일의 판정은 표시일 뿐이다.** 운영자인지는 아무도 안 묻고, 막는 것은 DB 의 `is_operator()` 다. 여기서 aal2 를 먼저 보는 까닭은
 * 자료가 나오고 접속기록에 「읽음」이 서기 전에 멈추려는 것이다. 못 읽으면 지나가지 않는다.
 */
export { DENIED, backTo, type Denied, type DeniedAction, type RefusedTarget, type WriteAction };

type SecondFactor = 'passed' | 'challenge' | 'enroll' | 'unread';

export async function secondFactorOf(): Promise<SecondFactor> {
  if (supabase === null) return 'unread';
  const { data } = await supabase.auth.getClaims();
  if (data?.claims.aal === 'aal2') return 'passed';
  const listed = await supabase.auth.mfa.listFactors();
  if (listed.error !== null) return 'unread';
  return listed.data.totp.length > 0 ? 'challenge' : 'enroll';
}

async function noteDenial(action: DeniedAction, reportId: string | null): Promise<void> {
  if (supabase === null) return;
  const { error } = await supabase.rpc('note_operator_denial', { p_action: action, p_report_id: reportId ?? undefined });
  if (error) console.error('note_operator_denial', error);
}

type Answer = { readonly error: { readonly code?: string } | null };

/** 문의 답들 가운데 하나라도 거절이면 적고 `DENIED` — 웹의 `deniedAmong` 과 같다 */
export async function deniedAmong(action: DeniedAction, answers: readonly Answer[], reportId: string | null = null): Promise<Denied | null> {
  if (!answers.some((answer) => isDenialCode(answer.error?.code))) return null;
  await noteDenial(action, reportId);
  return DENIED;
}

/** 운영자의 쓰기 거절 — `42501` 은 `denied`, 그 밖은 두 문을 다 부른다(서로의 반대만 적는다, ADR 0191) */
export async function noteWriteRefusal(action: WriteAction, code: string | undefined, target: RefusedTarget = {}): Promise<void> {
  if (isDenialCode(code)) {
    await noteDenial(action, idOf(target.reportId) ?? null);
    return;
  }
  const refusal = async () => {
    if (supabase === null) return;
    const { error } = await supabase.rpc('note_operator_refusal', {
      p_action: action,
      p_code: refusalCode(code),
      p_report_id: idOf(target.reportId),
      p_user_id: idOf(target.userId),
      p_order_id: idOf(target.orderId),
    });
    if (error) console.error('note_operator_refusal', error);
  };
  await Promise.all([refusal(), noteDenial(action, idOf(target.reportId) ?? null)]);
}

/** 화면의 머리가 할 일 — 로그인으로 · 확인 화면으로 · 없는 화면으로 · 문을 부른다 */
export type Passage = { readonly kind: 'out' } | { readonly kind: 'challenge'; readonly href: string } | { readonly kind: 'absent' } | { readonly kind: 'passed' };

export async function passageOf(action: DeniedAction, back: string, target: RefusedTarget = {}): Promise<Passage> {
  if (supabase === null) return { kind: 'out' };
  const { data } = await supabase.auth.getSession();
  if (data.session === null) return { kind: 'out' };
  const factor = await secondFactorOf();
  if (factor === 'passed') return { kind: 'passed' };
  if (factor === 'challenge') return { kind: 'challenge', href: secondFactorHref(back) };
  await noteDenial(action, idOf(target.reportId) ?? null);
  return { kind: 'absent' };
}

/** 쓰기의 맨 앞 — aal2 면 `null`, 아니면 그 쓰기가 낼 거절(문을 부르지 않는다) */
export async function writeWithoutSecondFactor(action: WriteAction, target: RefusedTarget = {}): Promise<{ readonly ok: false; readonly message: string } | null> {
  if (supabase === null) return { ok: false, message: SIGN_IN_AGAIN_NOTE };
  const { data } = await supabase.auth.getClaims();
  if (data?.claims.aal === 'aal2') return null;
  await noteDenial(action, idOf(target.reportId) ?? null);
  return { ok: false, message: SIGN_IN_AGAIN_NOTE };
}
