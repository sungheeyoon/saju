import { calculateChart } from '@/src/lib/input/chart';
import { queryFromSearchParams } from '@/src/lib/input/query';
import { readingEvidenceOf } from '@/src/lib/reading';
import {
  TASTE_CHECK_FAILED,
  TASTE_RUN_CALL,
  checkTasteRun,
  normalizeClaim,
  tasteEvidenceOf,
  tasteFingerprintOf,
  tasteRunPromptOf,
  tasteRunShapeOf,
  type TasteEvidence,
  type TasteRunOutput,
} from '@/src/lib/reading/taste-run';
import {
  MODEL_TIMEOUT,
  TASTE_CLOSED,
  answerOfReserve,
  answerOfView,
  type TasteAnswer,
  type TasteSessionView,
} from '@/src/lib/reading/taste-visit';
import type { Saju } from '@/src/lib/saju';

import type { Reserved, TasteFinish } from './keyed-taste';
import type { ModelCall } from './me/reading/generator';
import type { Visitor } from './taste-visitor';

/**
 * **로그인 전 사주 문단 한 번** — 받은 입력에서 근거와 지문을 서버가 짓고, 예약하고, 필요하면 모델을 부르고, 결과를
 * 적는다(ADR 0143). 서버 액션(`app/actions.ts` 의 `requestTaste`)이 진짜 손잡이를 넣어 부르고, 시험이 가짜를 넣어 부른다
 * (`app/taste-run.test.ts`).
 *
 * ## 무엇이 어디로 가나
 *
 * - **생년월일시 원문은 여기서 계산에만 쓴다.** 예약 · 결과 · 모델로 가는 것은 지문(16진 64자) · HMAC · 맛보기 근거로 지은
 *   프롬프트(`tasteRunPromptOf`) · 모델이 낸 칸 · 사용량뿐이다. 실패해도 입력을 기록에 싣지 않는다.
 * - **지문은 클라이언트가 정하지 않는다** — 브라우저는 입력(주소 `#` 뒤의 모양)만 보내고, 지문은 여기서 엔진으로 다시 센다.
 *
 * ## 갈래
 *
 * 한도 · 다 쓴 입력은 모델을 안 부르고 답한다. 이미 성공한 글 · 지금 쓰는 글은 세션을 읽는다. 부르는 갈래만 모델을 부르고,
 * 결과가 검사(`checkTasteRun`)를 지나야 성공으로 적는다 — 못 지나면 실패 코드로 적고 다음 요청이 재시도한다(상한은 DB).
 * **실패해도 다른 글로 바꿔치기하지 않는다** — 화면은 실패를 실패로 세운다.
 */

/** 서버 액션이 넣는 손잡이 — 시험은 가짜를 넣는다 */
export type TasteHands = {
  /** 이 요청의 방문자 — 비밀이 없거나 IP 를 못 읽으면 `null` */
  visitor: () => Promise<Visitor | null>;
  reserve: (args: { fingerprint: string; browserHmac: string; ipHmac: string }) => Promise<Reserved | null>;
  view: (sessionId: string, browserHmac: string) => Promise<{ ok: true; value: TasteSessionView | null } | { ok: false }>;
  finish: (finish: TasteFinish) => Promise<'recorded' | 'ignored' | null>;
  call: (
    prompt: string,
    options: {
      shape: ReturnType<typeof tasteRunShapeOf>;
      reasoningEffort: typeof TASTE_RUN_CALL.reasoningEffort;
      maxOutputTokens: number;
      timeoutMs: number;
    },
  ) => Promise<ModelCall<TasteRunOutput>>;
  /** 응답 시간을 재는 시계(ms) */
  clock: () => number;
};

/** 한 사람의 명식에서 맛보기 근거 — 때를 짚는 칸은 맛보기 근거가 버리므로 지금 시각은 지문을 안 바꾼다 */
export function tasteEvidenceOfSaju(saju: Saju): TasteEvidence {
  const built = readingEvidenceOf('self', { a: saju }, new Date());
  if (built.kind !== 'self' && built.kind !== 'person') throw new Error('한 사람의 근거가 아니다');
  return tasteEvidenceOf(built.evidence);
}

/** 명식의 근거 지문 — 귀속(`claim_taste_session`)이 확정 입력으로 다시 잴 때도 이것이다 */
export const tasteFingerprintOfSaju = (saju: Saju): Promise<string> => tasteFingerprintOf(tasteEvidenceOfSaju(saju));

/** 주소 `#` 뒤의 모양 → 명식. 못 읽으면 `null` */
export function sajuOfDraft(draft: string): Saju | null {
  if (typeof draft !== 'string' || draft.length > 1_000) return null;
  const query = queryFromSearchParams(new URLSearchParams(draft));
  if (query === null) return null;
  const chart = calculateChart(query);
  return chart.ok ? chart.saju : null;
}

/** 세션을 읽어 답한다 — 문이 터졌으면 닫는다 */
async function answerFromView(
  hands: TasteHands,
  sessionId: string,
  browserHmac: string,
  failedWith: 'failed' | 'timeout' = 'failed',
): Promise<TasteAnswer> {
  const view = await hands.view(sessionId, browserHmac);
  return view.ok ? answerOfView(view.value, sessionId, failedWith) : TASTE_CLOSED;
}

/**
 * 입력 하나로 로그인 전 사주 문단을 받는다 — 화면이 받는 다섯 상태 중 하나로 답한다.
 */
export async function serveTaste(draft: string, hands: TasteHands): Promise<TasteAnswer> {
  const saju = sajuOfDraft(draft);
  if (saju === null) return TASTE_CLOSED;

  const taste = tasteEvidenceOfSaju(saju);
  const fingerprint = await tasteFingerprintOf(taste);

  const visitor = await hands.visitor();
  if (visitor === null) return TASTE_CLOSED;

  const reserved = await hands.reserve({ fingerprint, browserHmac: visitor.browserHmac, ipHmac: visitor.ipHmac });
  if (reserved === null) return TASTE_CLOSED;

  const settled = answerOfReserve(reserved.outcome);
  if (settled !== null) return settled;
  if (reserved.sessionId === null) return TASTE_CLOSED;
  if (reserved.outcome !== 'call_model') return answerFromView(hands, reserved.sessionId, visitor.browserHmac);
  if (reserved.artifactId === null || reserved.attempt === null) return TASTE_CLOSED;

  const startedAt = hands.clock();
  const called = await hands.call(tasteRunPromptOf(taste), {
    shape: tasteRunShapeOf(taste),
    reasoningEffort: TASTE_RUN_CALL.reasoningEffort,
    maxOutputTokens: TASTE_RUN_CALL.maxOutputTokens,
    timeoutMs: TASTE_RUN_CALL.timeoutMs,
  });
  const responseMs = Math.max(0, Math.round(hands.clock() - startedAt));

  /*
    사용량은 SDK 의 셈 그대로다(`@ai-sdk/openai` 의 Responses 사용량 변환) — **`inputTokens` 는 캐시 읽기 · 캐시 쓰기를 포함한
    입력 전체**이고 둘은 그 안의 몫이다. `outputTokens` 도 추론 토큰을 포함한 전체이고 `reasoningTokens` 가 그 안의 몫이다.
    못 받은 칸은 0 이 아니라 비운다 — 비용이 조용히 0 이 되지 않게.
  */
  const usage = called.ok
    ? {
        inputTokens: called.usage?.inputTokens ?? null,
        cacheReadTokens: called.usage?.cacheReadTokens ?? null,
        cacheWriteTokens: called.usage?.cacheWriteTokens ?? null,
        outputTokens: called.usage?.outputTokens ?? null,
        reasoningTokens: called.reasoningTokens,
        responseMs,
      }
    : { inputTokens: null, cacheReadTokens: null, cacheWriteTokens: null, outputTokens: null, reasoningTokens: null, responseMs };

  const passed = called.ok && checkTasteRun(called.output, taste).ok;
  const failureCode = called.ok ? (passed ? null : TASTE_CHECK_FAILED) : called.code;

  const output =
    called.ok && passed
      ? {
          previewMarkdown: called.output.previewMarkdown.trim(),
          topic: called.output.topic,
          distinctivePattern: called.output.distinctivePattern.trim(),
          continuationQuestion: called.output.continuationQuestion.trim(),
          answerDirection: called.output.answerDirection.trim(),
          supportingClaims: called.output.supportingClaims.map(normalizeClaim).filter((claim) => claim !== ''),
        }
      : null;

  const recorded = await hands.finish({
    artifactId: reserved.artifactId,
    attempt: reserved.attempt,
    failureCode,
    output,
    usage,
  });
  if (recorded === null) return TASTE_CLOSED;

  if (recorded === 'recorded' && output !== null) {
    return { state: 'ready', sessionId: reserved.sessionId, preview: output.previewMarkdown };
  }

  /* 실패 — 다시 읽어도 되는지는 DB 가 센 시도 수가 답한다. 늦게 와서 무시된 결과도 세션이 지금 무엇인지 읽는다 */
  return answerFromView(hands, reserved.sessionId, visitor.browserHmac, failureCode === MODEL_TIMEOUT ? 'timeout' : 'failed');
}

/** 기다리는 화면이 다시 묻는다 — 세션 id 와 이 브라우저의 HMAC 이 함께 맞아야 읽힌다. 쿠키를 새로 심지 않는다 */
export async function viewTaste(
  sessionId: string,
  hands: Pick<TasteHands, 'view'> & { browserHmac: () => Promise<string | null> },
): Promise<TasteAnswer> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(sessionId)) return TASTE_CLOSED;
  const browserHmac = await hands.browserHmac();
  if (browserHmac === null) return TASTE_CLOSED;
  const view = await hands.view(sessionId, browserHmac);
  return view.ok ? answerOfView(view.value, sessionId) : TASTE_CLOSED;
}
