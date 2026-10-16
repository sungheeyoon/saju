import type { Trouble } from './settle';

/**
 * **결제 이상을 운영자에게 알린다** (G-110 ④, `20261213090000`).
 *
 * `settle.ts` 가 서명이 맞은 알림에서 고른 이상(`Trouble`)과 까닭(`note`)을 DB 의 `report_payment_trouble` 로 옮긴다 —
 * 그 문이 `notify_ops` 를 거쳐 장애 알림과 같은 주소(`ops_alert_url`)로 보낸다. 결제 하나 · 갈래 하나에 하루 한 줄이다.
 *
 * - **Production 에서만 보낸다** — 서버 오류 알림(`app/request-error.ts`)과 같은 선. Preview · 로컬의 샌드박스 결제가
 *   운영자의 알림함에 서지 않게
 * - **DB 가 받는 모양으로 깎는다** — 결제 번호는 짧은 토큰이 아니면 `null`, 까닭은 인쇄 가능한 ASCII 200자. 열쇠 없음
 *   (`NoKeyError`)처럼 한글이 든 까닭은 그 자리를 `?` 로 메운다
 * - **결제 알림의 답을 바꾸지 않는다** — 실패는 삼키고 로그에 한 줄(ADR 0078), 부름은 {@link TROUBLE_TIMEOUT_MS} 에 끊는다.
 *   DB 에 못 닿아 승인이 실패한 갈래는 이 알림도 같이 실패한다 — 그때 남는 것은 Vercel 로그와 PortOne 의 재전송이다
 *
 * 열쇠는 여기서 안 든다 — 라우트가 부르는 손(`send`)을 넘긴다(열쇠를 드는 자리는 `app/keyed-client.ts` 의 목록이다).
 */

/** 알림 부름을 끊는 시간 — PortOne 에 가는 답이 이보다 오래 기다리지 않는다 */
export const TROUBLE_TIMEOUT_MS = 1500;

export type TroubleArgs = { p_kind: Trouble['kind']; p_payment_id: string | null; p_reason: string };

/** 라우트가 넘기는 손 — DB 의 답(오류면 `error`)을 돌려준다. 던져도 된다 */
export type SendTrouble = (args: TroubleArgs, signal: AbortSignal) => PromiseLike<{ error: { code?: string } | null }>;

const PAYMENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** DB 가 받는 모양 — `report_payment_trouble` 의 검사와 같은 선 */
export function troubleArgs(trouble: Trouble, note: string | null): TroubleArgs {
  const paymentId = trouble.paymentId && PAYMENT_ID.test(trouble.paymentId) ? trouble.paymentId : null;
  const reason = (note ?? '').replace(/[^\x20-\x7e]+/g, '?').trim().slice(0, 200);
  return { p_kind: trouble.kind, p_payment_id: paymentId, p_reason: reason || trouble.kind };
}

/**
 * @param vercelEnv 시험이 넣는 자리 — 기본은 `process.env.VERCEL_ENV`
 */
export async function tellTrouble(
  trouble: Trouble,
  note: string | null,
  send: SendTrouble,
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
): Promise<void> {
  if (vercelEnv !== 'production') return;

  try {
    const { error } = await send(troubleArgs(trouble, note), AbortSignal.timeout(TROUBLE_TIMEOUT_MS));
    if (error) console.error('portone webhook: report_payment_trouble', error.code ?? 'unknown');
  } catch (thrown) {
    console.error('portone webhook: report_payment_trouble', thrown instanceof Error ? thrown.name : typeof thrown);
  }
}
