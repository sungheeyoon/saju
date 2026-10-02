import 'server-only';

import { rpcArgs } from '@/src/lib/db';
import { TASTE_RUN_VERSIONS } from '@/src/lib/reading/taste-run';
import {
  isReserveOutcome,
  type ReserveOutcome,
  type TasteSessionStep,
  type TasteSessionView,
  type TasteStep,
} from '@/src/lib/reading/taste-visit';

import { recordDbFailure } from './db-error';
import { keyedClient } from './keyed-client';

/**
 * **로그인 전 사주 문단의 맛보기 쪽 문 다섯을 열쇠로 부르는 유일한 자리**(ADR 0143).
 *
 * 문 다섯(`reserve_taste` · `finish_taste` · `taste_session_view` · `count_taste_step` · `count_taste_step_once`)은
 * `service_role` 에만 열려 있다(`20261118090000` · `20261119090000`). `anon` 에 열면 아무나 HMAC 칸에 지어낸 값을 넣어 한도를 비켜 간다 — 그래서 지문 · HMAC 은 서버가
 * 짓는다(`app/taste-run.ts` · `app/taste-visitor.ts`). 가입한 회원 쪽 문 셋은 `app/me/keyed-taste-claims.ts` 가 든다 —
 * 그쪽은 로그인 세션을 읽는다. 둘을 가른 까닭: 풀이 회수(`app/me/reading/collect.ts`)가 퍼널 끝을 세는데, 그 길은 webhook ·
 * 크론이라 로그인 세션을 읽는 모듈에 닿으면 안 된다(`app/auth/signed-in.boundary.test.ts`).
 *
 * 이 자리가 지키는 둘(`app/me/keyed-chart-writes.ts` 와 같은 꼴, ADR 0136):
 *
 * 1. **판 이름은 여기 한 곳**(`TASTE_RUN_VERSIONS`)에서 싣는다 — 부르는 쪽이 판을 고르지 않는다.
 * 2. **이 다섯만 부른다** — 열쇠 클라이언트를 밖으로 내주지 않는다. 판정(한도 · 예산 · 재사용)은 DB 가 한다.
 *
 * 실패는 값으로 낸다 — 문이 터지면 원문은 기록에 가고(`recordDbFailure`) 부르는 쪽은 `null` 을 받아 그 자리를 닫는다.
 * 이 파일은 서버 액션이 아니다 — 브라우저가 직접 못 부른다. 잠금은 `scripts/layers.test.ts`.
 */

type Keyed = ReturnType<typeof keyedClient>;

/** 열쇠가 없는 배포 — 원문은 기록에, 부르는 쪽은 그 자리를 닫는다 */
function tasteKeyed(): Keyed | null {
  try {
    return keyedClient('로그인 전 사주 문단');
  } catch (failure) {
    console.error('keyed-taste: 열쇠 없음', failure instanceof Error ? failure.message : failure);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 로그인 전 — 서버가 지은 지문 · HMAC 만 간다
// ---------------------------------------------------------------------------

export type Reserved = {
  readonly outcome: ReserveOutcome;
  readonly sessionId: string | null;
  readonly artifactId: string | null;
  readonly attempt: number | null;
};

/** 모델을 부르기 **전에** 예약한다 — 못 불렀으면 `null`(그 자리를 닫는다) */
export async function reserveTaste({
  fingerprint,
  browserHmac,
  ipHmac,
}: {
  fingerprint: string;
  browserHmac: string;
  ipHmac: string;
}): Promise<Reserved | null> {
  const client = tasteKeyed();
  if (client === null) return null;

  const { data, error } = await client.rpc(
    'reserve_taste',
    rpcArgs<'reserve_taste'>({
      p_evidence_fingerprint: fingerprint,
      p_prompt_version: TASTE_RUN_VERSIONS.prompt,
      p_model_config_version: TASTE_RUN_VERSIONS.modelConfig,
      p_browser_hmac: browserHmac,
      p_ip_hmac: ipHmac,
    }),
  );
  if (error !== null) {
    recordDbFailure(error, 'reserve_taste');
    return null;
  }

  const row = (data ?? [])[0];
  if (row === undefined || !isReserveOutcome(row.outcome)) return null;
  return {
    outcome: row.outcome,
    sessionId: row.session_id ?? null,
    artifactId: row.artifact_id ?? null,
    attempt: row.attempt ?? null,
  };
}

/** 모델의 결과 — 성공이면 낼 칸이, 실패면 코드가 있다. 사용량은 어느 쪽이든 싣는다 */
export type TasteFinish = {
  readonly artifactId: string;
  readonly attempt: number;
  readonly failureCode: string | null;
  readonly output: {
    readonly previewMarkdown: string;
    readonly topic: string;
    readonly distinctivePattern: string;
    readonly continuationQuestion: string;
    readonly answerDirection: string;
    readonly supportingClaims: readonly string[];
  } | null;
  readonly usage: {
    readonly inputTokens: number | null;
    readonly cacheReadTokens: number | null;
    readonly cacheWriteTokens: number | null;
    readonly outputTokens: number | null;
    readonly reasoningTokens: number | null;
    readonly responseMs: number | null;
  };
};

/** 결과를 적는다 — `recorded` · `ignored`(늦게 왔다), 못 적었으면 `null` */
export async function finishTaste(finish: TasteFinish): Promise<'recorded' | 'ignored' | null> {
  const client = tasteKeyed();
  if (client === null) return null;

  const { output, usage } = finish;
  const { data, error } = await client.rpc(
    'finish_taste',
    rpcArgs<'finish_taste'>({
      p_artifact_id: finish.artifactId,
      p_attempt: finish.attempt,
      ...(finish.failureCode === null ? {} : { p_failure_code: finish.failureCode }),
      ...(output === null
        ? {}
        : {
            p_preview_markdown: output.previewMarkdown,
            p_topic: output.topic,
            p_distinctive_pattern: output.distinctivePattern,
            p_continuation_question: output.continuationQuestion,
            p_answer_direction: output.answerDirection,
            p_supporting_claims: [...output.supportingClaims],
          }),
      ...(usage.inputTokens === null ? {} : { p_input_tokens: usage.inputTokens }),
      ...(usage.cacheReadTokens === null ? {} : { p_cache_read_tokens: usage.cacheReadTokens }),
      ...(usage.cacheWriteTokens === null ? {} : { p_cache_write_tokens: usage.cacheWriteTokens }),
      ...(usage.outputTokens === null ? {} : { p_output_tokens: usage.outputTokens }),
      ...(usage.reasoningTokens === null ? {} : { p_reasoning_tokens: usage.reasoningTokens }),
      ...(usage.responseMs === null ? {} : { p_response_ms: usage.responseMs }),
    }),
  );
  if (error !== null) {
    recordDbFailure(error, 'finish_taste');
    return null;
  }
  return data === 'recorded' || data === 'ignored' ? data : null;
}

/**
 * 브라우저 하나가 제 세션을 읽는다 — 세션 id 와 브라우저 HMAC 이 함께 맞아야 한다. 0행은 `{ ok: true, value: null }`,
 * 문이 터졌으면 `{ ok: false }`.
 */
export async function tasteSessionView(
  sessionId: string,
  browserHmac: string,
): Promise<{ ok: true; value: TasteSessionView | null } | { ok: false }> {
  const client = tasteKeyed();
  if (client === null) return { ok: false };

  const { data, error } = await client.rpc(
    'taste_session_view',
    rpcArgs<'taste_session_view'>({ p_session_id: sessionId, p_browser_hmac: browserHmac }),
  );
  if (error !== null) {
    recordDbFailure(error, 'taste_session_view');
    return { ok: false };
  }

  const row = (data ?? [])[0];
  return {
    ok: true,
    value:
      row === undefined
        ? null
        : { state: row.state, retryable: row.retryable === true, preview: row.preview_markdown ?? null },
  };
}

/**
 * 회수가 세는 퍼널 끝(`reading_succeeded`) — 날짜와 단계뿐, 누구인지는 안 간다. 브라우저가 없는 길(webhook · 크론)이라
 * 세션을 못 싣는다 — 시도 하나에 한 번 저장한 뒤에만 부르므로 한 번이다. **세지 못해도 저장은 그대로다** — 원문만 기록에 간다.
 */
export async function countTasteStep(step: TasteStep): Promise<void> {
  const client = tasteKeyed();
  if (client === null) return;
  const { error } = await client.rpc('count_taste_step', rpcArgs<'count_taste_step'>({ p_step: step }));
  if (error !== null) recordDbFailure(error, 'count_taste_step');
}

/**
 * 브라우저와 함께 보는 퍼널 단계를 **세션당 한 번** 센다 — 세션 id 와 서버가 지은 브라우저 HMAC 이 함께 맞아야 DB 가 센다
 * (`count_taste_step_once`). 이미 셌거나 맞지 않으면 아무것도 안 는다. **세지 못해도 누름은 그대로다** — 원문만 기록에 간다.
 */
export async function countTasteStepOnce(sessionId: string, browserHmac: string, step: TasteSessionStep): Promise<void> {
  const client = tasteKeyed();
  if (client === null) return;
  const { error } = await client.rpc(
    'count_taste_step_once',
    rpcArgs<'count_taste_step_once'>({ p_session_id: sessionId, p_browser_hmac: browserHmac, p_step: step }),
  );
  if (error !== null) recordDbFailure(error, 'count_taste_step_once');
}
