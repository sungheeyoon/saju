'use server';

import type { TasteRunOutput } from '@/src/lib/reading/taste-run';
import { TASTE_CLOSED, type TasteAnswer } from '@/src/lib/reading/taste-visit';

import { countTasteStep, finishTaste, reserveTaste, tasteSessionView } from './keyed-taste';
import { claimTasteSession } from './me/keyed-taste-claims';
import { callModel } from './me/reading/model';
import { sajuOfDraft, serveTaste, tasteFingerprintOfSaju, viewTaste } from './taste-run';
import {
  browserHmacNow,
  claimedTasteSessionId,
  forgetTasteClaim,
  markTasteClaimed,
  tasteVisitor,
} from './taste-visitor';

/**
 * **첫 화면(`/`)의 누름 — 로그인 전 사주 문단을 받고, 가입한 뒤 그 문단을 내 것으로 붙인다**(ADR 0143).
 *
 * 판단은 여기 없다 — 받기는 `app/taste-run.ts`, DB 는 `app/keyed-taste.ts`, 쿠키 · HMAC 은 `app/taste-visitor.ts` 가 한다.
 * 여기는 진짜 손잡이를 넣어 부를 뿐이다. **던지지 않는다** — 화면은 값으로 받는다.
 */

/** 입력(주소 `#` 뒤의 모양) 하나로 로그인 전 사주 문단을 받는다 — 같은 입력을 다시 보내면 같은 세션 · 같은 글이다 */
export async function requestTaste(draft: string): Promise<TasteAnswer> {
  try {
    return await serveTaste(draft, {
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

/** 화면만 아는 퍼널 두 단계 — 더보기 · 가입 시작. 날짜와 단계만 센다 */
export async function noteTasteStep(step: 'more_clicked' | 'signup_started'): Promise<void> {
  if (step !== 'more_clicked' && step !== 'signup_started') return;
  await countTasteStep(step);
}

/**
 * 가입한 뒤 「이 사주가 내 사주 맞나요?」에서 저장한 입력으로 **세션을 내 것으로 붙인다.**
 *
 * 지문은 확정한 입력에서 서버가 다시 잰다 — 다르면 DB 가 그 세션을 버린다(`discarded`). 붙었으면 「다음 누름은 이 세션을
 * 잇는다」는 표를 쿠키로 세운다(`TASTE_CLAIM_COOKIE`). 다른 탭 · 다른 사람 · 바꾼 id · 24시간이 지난 세션은 **조용히 보통
 * 흐름**이다 — 답에 까닭을 안 싣는다.
 *
 * @returns 이어 볼 세션이 섰는가
 */
export async function claimTaste(draft: string, sessionId: string): Promise<{ continued: boolean }> {
  const quiet = async () => {
    await forgetTasteClaim();
    return { continued: false };
  };

  if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/.test(sessionId)) return quiet();
  const saju = sajuOfDraft(draft);
  const browserHmac = await browserHmacNow();
  if (saju === null || browserHmac === null) return quiet();

  let fingerprint: string;
  try {
    fingerprint = await tasteFingerprintOfSaju(saju);
  } catch (thrown) {
    closedBy(thrown, 'claimTaste');
    return quiet();
  }
  const claim = await claimTasteSession({ sessionId, browserHmac, fingerprint });
  if (claim === null || claim.outcome !== 'claimed') return quiet();

  /* 가입 완료는 처음 붙인 한 번만 센다 — 같은 세션을 다시 붙이는 것은 멱등이라 세지 않는다 */
  if ((await claimedTasteSessionId()) !== sessionId) await countTasteStep('signup_completed');
  /* 이어진 풀이가 이미 섰으면 표는 다 쓰였다 — 그 풀이가 곧 열린다 */
  if (claim.readingRunStatus === 'succeeded') return quiet();
  await markTasteClaimed(sessionId);
  return { continued: true };
}
