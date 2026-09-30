'use server';

import type { AuthError } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

import { SERVICE_NAME } from '@/src/lib/brand';

import { supabaseOnServer } from '../../auth/server-client';
import { opsReturnPath } from '../second-factor';
import { SECOND_FACTOR_COPY } from './copy';

/**
 * **운영자가 제 계정에 TOTP 를 등록하고, 그 코드로 세션을 aal2 로 올린다** (ADR 0123).
 *
 * Supabase Auth 의 요소 API 를 사용자 쿠키 그대로 부른다 — 열쇠는 안 든다. 요소는 그 사람의 것이고, Auth 가
 * 「이 세션의 주인인가」를 스스로 묻는다. 확인을 마치면 Auth 가 새 토큰(aal2)을 내주고 서버 client 가 그 쿠키를
 * 이 응답에 싣는다. **Auth 는 확인하는 순간 그 사람의 다른 세션을 전부 끊는다**(`mfa.verify` 의 규약) — 운영자가
 * 다른 기기에서 다시 로그인하는 것은 의도다.
 *
 * 누구나 부를 수 있다 — 두 번째 요소는 자기 계정의 것이고 운영자 여부를 여기서 묻지 않는다(`../second-factor.ts`).
 * 운영자가 아닌 사람이 등록해도 운영자 문은 여전히 DB 가 거절한다.
 *
 * Auth 의 거절은 사용자에게 원문을 안 낸다. 거절의 기록은 Auth 가 제 로그에 남긴다(대시보드 Logs → Auth) —
 * 그래서 여기서 따로 적지 않는다.
 */

type Answer = { readonly ok: false; readonly message: string };

type Enrollment =
  | { readonly ok: true; readonly qrCode: string; readonly secret: string }
  | Answer;

/** Auth 가 코드를 거절한 까닭 넷 — 틀린 코드 · 지난 확인 · 요소 없음은 다시 넣으면 된다 */
const RETRYABLE = new Set(['mfa_verification_failed', 'mfa_challenge_expired', 'mfa_verification_rejected']);

const refusal = (error: AuthError, fallback: string): Answer => ({
  ok: false,
  message: RETRYABLE.has(error.code ?? '') ? SECOND_FACTOR_COPY.wrongCode : fallback,
});

/**
 * 등록을 연다 — QR 과 설정 키를 한 번 내준다.
 *
 * 확인을 안 마친 옛 TOTP 는 먼저 걷는다. 등록을 열어 두고 창을 닫으면 확인 전 요소가 남고, 그것이 쌓이면
 * 한 사람의 요소 상한(`max_enrolled_factors`)에 닿는다. 확인을 마친 요소가 이미 있으면 새로 열지 않는다 —
 * 그 사람은 코드만 넣으면 된다.
 */
export async function startTotpEnrollment(): Promise<Enrollment> {
  const supabase = await supabaseOnServer();

  const listed = await supabase.auth.mfa.listFactors();
  if (listed.error !== null) return refusal(listed.error, SECOND_FACTOR_COPY.enrollFailed);
  if (listed.data.totp.length > 0) return { ok: false, message: SECOND_FACTOR_COPY.alreadyEnrolled };

  for (const stale of listed.data.all) {
    if (stale.factor_type !== 'totp' || stale.status === 'verified') continue;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: stale.id });
    if (error !== null) return refusal(error, SECOND_FACTOR_COPY.enrollFailed);
  }

  const enrolled = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: SERVICE_NAME });
  if (enrolled.error !== null) return refusal(enrolled.error, SECOND_FACTOR_COPY.enrollFailed);

  return { ok: true, qrCode: asBase64Svg(enrolled.data.totp.qr_code), secret: enrolled.data.totp.secret };
}

/**
 * Auth 가 준 QR 은 `data:image/svg+xml;utf-8,<svg …>` 이다 — SVG 원문이 주소에 그대로 들고 끝에 줄바꿈이 붙어,
 * `next/image` 가 「끝에 제어 문자」로 거절했다(2026-09-28, e2e). 원문을 base64 로 다시 싣는다.
 */
function asBase64Svg(dataUrl: string): string {
  const svg = dataUrl.slice(dataUrl.indexOf(',') + 1).trim();
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

/**
 * 코드를 확인한다 — **성공하면 안 돌아온다**(돌아갈 운영 화면으로 보낸다).
 *
 * 어느 요소인지는 화면이 안 보낸다 — 서버가 그 사람의 요소 목록에서 고른다. 확인을 마친 TOTP 가 있으면 그것,
 * 없으면 방금 연 등록(확인 전 TOTP)이다.
 */
export async function confirmTotpCode(answer: { code: string; next: string }): Promise<Answer> {
  const code = answer.code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return { ok: false, message: SECOND_FACTOR_COPY.codeShape };

  const supabase = await supabaseOnServer();

  const listed = await supabase.auth.mfa.listFactors();
  if (listed.error !== null) return refusal(listed.error, SECOND_FACTOR_COPY.verifyFailed);

  const factor =
    listed.data.totp[0] ??
    listed.data.all.find((one) => one.factor_type === 'totp' && one.status !== 'verified');
  if (factor === undefined) return { ok: false, message: SECOND_FACTOR_COPY.noFactor };

  const verified = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (verified.error !== null) return refusal(verified.error, SECOND_FACTOR_COPY.verifyFailed);

  /* `redirect` 는 던진다 — try 안에 두지 않는다(Next 문서). 여기가 이 함수의 끝이다 */
  redirect(opsReturnPath(answer.next));
}
