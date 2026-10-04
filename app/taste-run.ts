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
  TASTE_RETURNED_CLAIMS,
  answerOfReserve,
  answerOfView,
  type TasteAnswer,
  type TasteClaimResult,
  type TasteSessionView,
} from '@/src/lib/reading/taste-visit';
import type { Saju } from '@/src/lib/saju';

import type { Reserved, TasteFinish } from './keyed-taste';
import type { TasteClaim } from './me/keyed-taste-claims';
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

/**
 * 예약한 뒤에 결과를 제 코드로 못 적은 시도의 실패 코드 — 예외가 났거나 결과(성공 · 실패)를 적는 문이 터졌다. 그래도
 * `finish_taste` 로 닫아 둔다: 안 닫으면 그 artifact 는 시간 상한(60초)까지 `running` 으로 서서 같은 입력의 다른 요청이
 * 기다리고, 정리 크론이 `timeout` 으로 닫을 때까지 까닭이 남지 않는다. 꼴은 DB 의 `^[a-z0-9-]{1,64}$`.
 */
export const TASTE_INTERNAL_ERROR = 'taste-internal-error';

/** 서버 액션이 넣는 손잡이 — 시험은 가짜를 넣는다 */
export type TasteHands = {
  /**
   * 이 요청이 로그인한 사람의 것인가 — 그렇다면 모델도 예약도 없이 닫는다. 회원의 입력은 로그인 전 사주 문단으로 가지
   * 않는다(회원이 `/saju` 에 넣는 사주는 대개 남의 것이고, 회원에게는 저장한 사람의 풀이 길이 있다). 화면도 세션을 모르는
   * 동안 이 문단을 안 세우지만, 화면은 길을 가리킬 뿐 문을 지키지 않는다 — 서버가 다시 본다.
   */
  member: () => Promise<boolean>;
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
      /** SDK 의 숨은 재시도 — 늘 `0`. 시도 수는 DB 가 예약으로 센다(`app/me/reading/model.ts` 의 `maxRetries`) */
      maxRetries: 0;
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
  if (await hands.member()) return TASTE_CLOSED;

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

  return callReserved(hands, taste, {
    sessionId: reserved.sessionId,
    artifactId: reserved.artifactId,
    attempt: reserved.attempt,
    browserHmac: visitor.browserHmac,
  });
}

type Usage = TasteFinish['usage'];

/**
 * 예약한 시도 하나 — 모델을 부르고 결과를 적는다. **예약한 뒤의 모든 길이 `finish_taste` 를 지난다**: 모델 · 검사 · 결과
 * 적기 어디서 던지든, 결과를 적는 문이 터지든 `finally` 가 `TASTE_INTERNAL_ERROR` 로 닫는다(그것마저 못 적으면 기록만 남고
 * 정리 크론이 시간 상한에서 닫는다).
 */
async function callReserved(
  hands: TasteHands,
  taste: TasteEvidence,
  reserved: { sessionId: string; artifactId: string; attempt: number; browserHmac: string },
): Promise<TasteAnswer> {
  const startedAt = hands.clock();
  const elapsed = () => Math.max(0, Math.round(hands.clock() - startedAt));
  let usage: Usage | null = null;
  let finished = false;

  try {
    const called = await hands.call(tasteRunPromptOf(taste), {
      shape: tasteRunShapeOf(taste),
      reasoningEffort: TASTE_RUN_CALL.reasoningEffort,
      maxOutputTokens: TASTE_RUN_CALL.maxOutputTokens,
      timeoutMs: TASTE_RUN_CALL.timeoutMs,
      maxRetries: 0,
    });
    const responseMs = elapsed();

    /*
      사용량은 SDK 의 셈 그대로다(`@ai-sdk/openai` 의 Responses 사용량 변환) — **`inputTokens` 는 캐시 읽기 · 캐시 쓰기를 포함한
      입력 전체**이고 둘은 그 안의 몫이다. `outputTokens` 도 추론 토큰을 포함한 전체이고 `reasoningTokens` 가 그 안의 몫이다.
      못 받은 칸은 0 이 아니라 비운다 — 비용이 조용히 0 이 되지 않게.
    */
    usage = called.ok
      ? {
          inputTokens: called.usage?.inputTokens ?? null,
          cacheReadTokens: called.usage?.cacheReadTokens ?? null,
          cacheWriteTokens: called.usage?.cacheWriteTokens ?? null,
          outputTokens: called.usage?.outputTokens ?? null,
          reasoningTokens: called.reasoningTokens,
          responseMs,
        }
      : { ...NO_TOKENS, responseMs };

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
    finished = true;

    if (recorded === 'recorded' && output !== null) {
      return { state: 'ready', sessionId: reserved.sessionId, preview: output.previewMarkdown };
    }

    /* 실패 — 다시 읽어도 되는지는 DB 가 센 시도 수가 답한다. 늦게 와서 무시된 결과도 세션이 지금 무엇인지 읽는다 */
    return answerFromView(hands, reserved.sessionId, reserved.browserHmac, failureCode === MODEL_TIMEOUT ? 'timeout' : 'failed');
  } finally {
    if (!finished) await closeReserved(hands, reserved, usage ?? { ...NO_TOKENS, responseMs: elapsed() });
  }
}

const NO_TOKENS = {
  inputTokens: null,
  cacheReadTokens: null,
  cacheWriteTokens: null,
  outputTokens: null,
  reasoningTokens: null,
} as const;

/** 예약한 시도를 실패로 닫는다 — 던지지 않는다. 받은 사용량은 그대로 싣는다(토큰은 이미 나갔을 수 있다) */
async function closeReserved(
  hands: TasteHands,
  reserved: { artifactId: string; attempt: number },
  usage: Usage,
): Promise<void> {
  try {
    const closed = await hands.finish({
      artifactId: reserved.artifactId,
      attempt: reserved.attempt,
      failureCode: TASTE_INTERNAL_ERROR,
      output: null,
      usage,
    });
    if (closed === null) console.error('taste: 예약한 시도를 실패로도 못 닫았다 — 정리 크론이 시간 상한에서 닫는다');
  } catch (thrown) {
    console.error('taste: 예약한 시도를 닫다가 던졌다', thrown instanceof Error ? thrown.name : typeof thrown);
  }
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

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 귀속의 손잡이 — 서버 액션(`claimTaste`)이 진짜를, 시험이 가짜를 넣는다 */
export type TasteClaimHands = {
  /** 비밀 둘이 섰는가 — 없으면 이 배포는 문단을 안 쓴다. 다시 불러도 안 생긴다 */
  secretsReady: () => boolean;
  /** 이 브라우저의 쿠키로 지은 HMAC — 쿠키가 없으면 `null`. 쿠키는 다시 불러도 안 생긴다 */
  browserHmac: () => Promise<string | null>;
  /** 방금 저장한 내 사주의 지문 — 못 읽으면 `null`(계정 읽기가 DB 오류를 `null` 로 접는다, `readAccount`) */
  fingerprint: () => Promise<string | null>;
  /** DB 의 귀속 — 로그인 세션 · 열쇠 · 문이 터지면 `null` */
  claim: (args: { sessionId: string; browserHmac: string; fingerprint: string }) => Promise<TasteClaim | null>;
  /** 퍼널의 가입 완료 — 세션당 한 번은 DB 가 지킨다 */
  countCompleted: (sessionId: string, browserHmac: string) => Promise<void>;
  /** 귀속 표(쿠키)를 세운다 · 걷는다 */
  mark: (sessionId: string) => Promise<void>;
  forget: () => Promise<void>;
};

/**
 * 들고 온 세션을 이 회원에게 붙인다 — **답이 났는가(`claimed` · `terminal`)와 안 났는가(`retryable`)를 가른다**(ADR 0143 「덧」).
 *
 * 앞서는 셋을 「이어 볼 세션이 섰나」 하나(`continued`)로 접었다 — DB 오류와 진짜 불일치가 같은 `false` 였고, 화면은 세션 id 를
 * 먼저 지운 뒤 조용히 보통 흐름으로 갔다. 순간 장애 하나에 이어쓰기가 영영 끊겼다.
 *
 * 갈래의 근거:
 * - 쿠키가 없거나(`browserHmac` 이 `null`) 비밀이 없으면 `terminal` — 다시 불러도 그 값은 안 생긴다. 쿠키를 잃은 브라우저는 그
 *   세션을 읽을 길이 없다(`not_found` 와 같은 자리)
 * - 지문이 `null` 이면 `retryable` — 이 액션은 내 사주를 **저장한 직후**에만 불리므로, 내 사주가 없다는 답은 계정 읽기가 그
 *   순간 실패했다는 뜻이다
 * - `not_ready`(세션에 아직 글이 없다)는 `terminal` — 이 사람은 끊긴 물음을 본 적이 없다. 글이 선 세션만 가입 단추가 id 를
 *   싣고(`app/taste.tsx`), 실패 · 한도의 가입 경로는 id 를 안 싣는다. 이 갈래에 다시 시도를 세우면 영영 안 설 글을 기다린다
 * - 던진 것은 모두 `retryable` — 무엇이 터졌는지 모르면 답이 안 난 것이다
 *
 * `retryable` 이면 귀속 표를 건드리지 않는다 — 앞서 붙은 표가 있으면 그대로 두고, 다시 부르면 DB 가 멱등으로 답한다.
 */
export async function claimTasteWith(sessionId: string, hands: TasteClaimHands): Promise<TasteClaimResult> {
  const terminal = async (): Promise<TasteClaimResult> => {
    await hands.forget();
    return 'terminal';
  };

  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return terminal();
  if (!hands.secretsReady()) return terminal();

  let browserHmac: string | null;
  let fingerprint: string | null;
  try {
    browserHmac = await hands.browserHmac();
    if (browserHmac === null) return terminal();
    fingerprint = await hands.fingerprint();
  } catch (thrown) {
    console.error('taste: 귀속 전에 던졌다 — 다시 시도하게 한다', thrown instanceof Error ? thrown.name : typeof thrown);
    return 'retryable';
  }
  if (fingerprint === null) return 'retryable';

  const claim = await hands.claim({ sessionId, browserHmac, fingerprint });
  if (claim === null) return 'retryable';

  if ((TASTE_RETURNED_CLAIMS as readonly string[]).includes(claim.outcome)) {
    /* 퍼널 한 칸 — 못 세도 귀속의 답은 그대로다 */
    try {
      await hands.countCompleted(sessionId, browserHmac);
    } catch (thrown) {
      console.error('taste: 가입 완료를 못 셌다', thrown instanceof Error ? thrown.name : typeof thrown);
    }
  }
  if (claim.outcome !== 'claimed') return terminal();

  /* 이어진 풀이가 이미 섰으면 표는 다 쓰였다 — 그 풀이가 곧 열린다 */
  if (claim.readingRunStatus === 'succeeded') return terminal();
  await hands.mark(sessionId);
  return 'claimed';
}
