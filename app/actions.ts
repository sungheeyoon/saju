'use server';

import type { TasteRunOutput } from '@/src/lib/reading/taste-run';
import {
  TASTE_CLOSED,
  isTasteSessionStep,
  type TasteAnswer,
  type TasteClaimResult,
  type TasteSessionStep,
} from '@/src/lib/reading/taste-visit';

import { supabaseOnServer } from './auth/server-client';
import { signedInUser } from './auth/signed-in';
import { countTasteStepOnce, finishTaste, reserveTaste, tasteSessionView } from './keyed-taste';
import { claimTasteSession } from './me/keyed-taste-claims';
import { callModel } from './me/reading/model';
import { selfTasteFingerprint } from './me/reading/taste-carry';
import { claimTasteWith, serveTaste, viewTaste } from './taste-run';
import { browserHmacNow, forgetTasteClaim, markTasteClaimed, tasteSecrets, tasteVisitor } from './taste-visitor';

/**
 * **첫 화면(`/`)의 누름 — 로그인 전 사주 문단을 받고, 가입한 뒤 그 문단을 내 것으로 붙인다**(ADR 0143).
 *
 * 판단은 여기 없다 — 받기는 `app/taste-run.ts`, DB 는 `app/keyed-taste.ts`, 쿠키 · HMAC 은 `app/taste-visitor.ts` 가 한다.
 * 여기는 진짜 손잡이를 넣어 부를 뿐이다. **던지지 않는다** — 화면은 값으로 받는다.
 */

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 이 요청이 로그인한 사람의 것인가 — 쿠키의 JWT 서명을 이 서버가 확인한다(`signedInUser`, ADR 0117) */
const signedIn = async (): Promise<boolean> => (await signedInUser(await supabaseOnServer())) !== null;

/** 입력(주소 `#` 뒤의 모양) 하나로 로그인 전 사주 문단을 받는다 — 같은 입력을 다시 보내면 같은 세션 · 같은 글이다 */
export async function requestTaste(draft: string): Promise<TasteAnswer> {
  try {
    return await serveTaste(draft, {
      member: signedIn,
      visitor: () => tasteVisitor(),
      reserve: reserveTaste,
      view: tasteSessionView,
      finish: finishTaste,
      call: (prompt, options) => callModel<TasteRunOutput>(prompt, options),
      clock: () => performance.now(),
    });
  } catch (thrown) {
    return closedBy(thrown, 'requestTaste');
  }
}

/**
 * 계산 · 근거 짓기가 던진 것 — 이 자리를 닫는다. **기록에는 오류의 이름만 간다** — 문장에 입력이 섞일 수 있어 원문을 안 싣는다.
 */
function closedBy(thrown: unknown, where: string): TasteAnswer {
  console.error(`taste: ${where} 이 던졌다 — 자리를 닫는다`, thrown instanceof Error ? thrown.name : typeof thrown);
  return TASTE_CLOSED;
}

/** 기다리는 화면이 다시 묻는다 — 이 브라우저의 세션만 읽힌다 */
export async function readTaste(sessionId: string): Promise<TasteAnswer> {
  return viewTaste(sessionId, { view: tasteSessionView, browserHmac: browserHmacNow });
}

/**
 * 화면만 아는 퍼널 단계 — 가입 시작(「더보기」는 G-85 가 걷었다 — `TASTE_SESSION_STEPS`). **세션당 한 번**이다 — 세션 id 와
 * 이 브라우저의 쿠키가 함께 맞아야 DB 가 세고(`count_taste_step_once`), 쿠키가 없거나 id 꼴이 아니면 DB 까지 안 간다.
 */
export async function noteTasteStep(step: 'signup_started', sessionId: string): Promise<void> {
  if (step !== 'signup_started') return;
  await countOnce(step, sessionId);
}

async function countOnce(step: TasteSessionStep, sessionId: string, known?: string): Promise<void> {
  if (!isTasteSessionStep(step) || typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return;
  const browserHmac = known ?? (await browserHmacNow());
  if (browserHmac === null) return;
  await countTasteStepOnce(sessionId, browserHmac, step);
}

/**
 * 가입한 뒤 「이 사주가 내 사주 맞나요?」에서 내 사주를 저장한 다음 **세션을 내 것으로 붙인다.**
 *
 * 지문은 **방금 서버에 저장된 내 사주**로 다시 잰다(`selfTasteFingerprint` — 자기 풀이가 귀속을 다시 맞출 때와 같은 길) —
 * 클라이언트는 세션 id 만 보낸다. 다르면 DB 가 그 세션을 버린다(`discarded`). 붙었으면 「다음 누름은 이 세션을 잇는다」는
 * 표를 쿠키로 세운다(`TASTE_CLAIM_COOKIE`). 답은 세 갈래(`TasteClaimResult`)이고 까닭은 안 싣는다 — 갈래의 근거는
 * `claimTasteWith`(`app/taste-run.ts`)가 든다.
 *
 * 가입 완료(`signup_completed`)는 **그 세션을 들고 돌아온 것**이다 — 귀속 결과가 `TASTE_RETURNED_CLAIMS` 중 하나면 센다.
 * 세션당 한 번은 DB 가 지킨다 — 귀속 표 쿠키를 지우고 다시 와도 다시 안 센다.
 */
export async function claimTaste(sessionId: string): Promise<{ result: TasteClaimResult }> {
  try {
    const result = await claimTasteWith(sessionId, {
      secretsReady: () => tasteSecrets() !== null,
      browserHmac: browserHmacNow,
      fingerprint: selfTasteFingerprint,
      claim: claimTasteSession,
      countCompleted: (id, browserHmac) => countOnce('signup_completed', id, browserHmac),
      mark: markTasteClaimed,
      forget: forgetTasteClaim,
    });
    return { result };
  } catch (thrown) {
    console.error('taste: claimTaste 가 던졌다 — 다시 시도하게 한다', thrown instanceof Error ? thrown.name : typeof thrown);
    return { result: 'retryable' };
  }
}
