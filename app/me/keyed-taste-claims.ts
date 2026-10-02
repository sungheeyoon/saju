import 'server-only';

import { rpcArgs } from '@/src/lib/db';
import type { TasteRunCarry } from '@/src/lib/reading/continuation';

import { supabaseOnServer } from '../auth/server-client';
import { signedInUser } from '../auth/signed-in';
import { recordDbFailure } from '../db-error';
import { keyedClient } from '../keyed-client';

/**
 * **가입한 회원이 로그인 전 사주 문단을 이어받는 문 셋을 열쇠로 부르는 유일한 자리**(ADR 0143 의 4).
 *
 * 문 셋(`claim_taste_session` · `link_taste_reading_run` · `taste_continuation_of_run`)은 `service_role` 에만 열려 있고 첫 인자가
 * 회원 id 다. 로그인 문으로 열면 지문을 제가 고른 값으로 넣어 「확정 입력으로 다시 잰 지문과 같다」를 건너뛴다 — 그래서 지문 ·
 * 브라우저 HMAC 은 서버가 짓고, 회원 id 는 **세션에서 얻는다**(인자로 받지 않는다, ADR 0136 의 꼴). 쿠키의 JWT 서명을 이 서버가
 * 확인한 `signedInUser` 의 id 다. 판정(정지 · 베타 종료 · 가입 미완 · 남의 세션)은 DB 가 한다. 이 셋만 부르고 열쇠 클라이언트를
 * 밖으로 내주지 않는다. 로그인 전 쪽 문 넷은 `app/keyed-taste.ts` 가 든다.
 */

type Keyed = ReturnType<typeof keyedClient>;

/** 세션의 회원과 열쇠 한 쌍 — 둘 중 하나라도 없으면 부르지 않는다 */
async function member(): Promise<{ userId: string; keyed: Keyed } | null> {
  const user = await signedInUser(await supabaseOnServer());
  if (user === null) return null;
  try {
    return { userId: user.id, keyed: keyedClient('로그인 전 사주 문단 이어받기') };
  } catch (failure) {
    console.error('keyed-taste-claims: 열쇠 없음', failure instanceof Error ? failure.message : failure);
    return null;
  }
}

/** 귀속의 답 — DB 의 갈래 여섯. `claimed` 면 스냅숏과 이어진 풀이 시도의 상태가 함께 온다 */
export type TasteClaim =
  | {
      readonly outcome: 'claimed';
      readonly carry: TasteRunCarry;
      readonly readingRunId: string | null;
      /** `running` · `succeeded` · `failed`(시간 상한을 넘긴 것 포함) · 이어진 것이 없으면 `null` */
      readonly readingRunStatus: 'running' | 'succeeded' | 'failed' | null;
    }
  | { readonly outcome: 'discarded' | 'taken' | 'expired' | 'not_ready' | 'not_found' };

const RUN_STATUSES = ['running', 'succeeded', 'failed'] as const;

/**
 * 가입한 회원에게 세션을 붙인다 — **같은 회원이 다시 부르면 멱등**이다. 지문은 서버가 확정 입력에서 다시 잰 값이다.
 * 로그인 안 했거나 · 열쇠가 없거나 · 문이 터지면(정지 · 베타 종료 · 가입 미완 포함) `null` — 부르는 쪽은 보통 흐름으로 간다.
 */
export async function claimTasteSession({
  sessionId,
  browserHmac,
  fingerprint,
}: {
  sessionId: string;
  browserHmac: string;
  fingerprint: string;
}): Promise<TasteClaim | null> {
  const who = await member();
  if (who === null) return null;

  const { data, error } = await who.keyed.rpc(
    'claim_taste_session',
    rpcArgs<'claim_taste_session'>({
      p_user_id: who.userId,
      p_session_id: sessionId,
      p_browser_hmac: browserHmac,
      p_evidence_fingerprint: fingerprint,
    }),
  );
  if (error !== null) {
    recordDbFailure(error, 'claim_taste_session');
    return null;
  }

  const row = (data ?? [])[0];
  if (row === undefined) return null;
  if (row.outcome !== 'claimed') {
    return ['discarded', 'taken', 'expired', 'not_ready', 'not_found'].includes(row.outcome)
      ? { outcome: row.outcome as 'discarded' | 'taken' | 'expired' | 'not_ready' | 'not_found' }
      : null;
  }
  if (row.preview_markdown === null || row.continuation_question === null || row.answer_direction === null) return null;

  return {
    outcome: 'claimed',
    carry: {
      previewMarkdown: row.preview_markdown,
      continuationQuestion: row.continuation_question,
      answerDirection: row.answer_direction,
      supportingClaims: row.supporting_claims ?? [],
    },
    readingRunId: row.reading_run_id ?? null,
    readingRunStatus: RUN_STATUSES.find((status) => status === row.reading_run_status) ?? null,
  };
}

/** 잇기의 답 — DB 의 갈래 여섯 */
export type TasteLink = 'linked' | 'already_succeeded' | 'already_running' | 'not_claimed' | 'wrong_run' | 'run_taken';

/** 귀속된 세션을 이 회원의 자기 풀이 시도 하나에 잇는다 — 못 이었으면(문이 터짐) `null`, 보통 풀이로 간다 */
export async function linkTasteReadingRun(sessionId: string, runId: string): Promise<TasteLink | null> {
  const who = await member();
  if (who === null) return null;

  const { data, error } = await who.keyed.rpc(
    'link_taste_reading_run',
    rpcArgs<'link_taste_reading_run'>({ p_user_id: who.userId, p_session_id: sessionId, p_reading_run_id: runId }),
  );
  if (error !== null) {
    recordDbFailure(error, 'link_taste_reading_run');
    return null;
  }
  const outcome = (data ?? [])[0]?.outcome;
  return ['linked', 'already_succeeded', 'already_running', 'not_claimed', 'wrong_run', 'run_taken'].includes(outcome ?? '')
    ? (outcome as TasteLink)
    : null;
}

/**
 * 풀이 시도 하나에 이어진 맛보기 — **세션의 스냅숏**이다(artifact 를 다시 안 읽는다). 이 회원에게 귀속되고 이 시도에
 * 이어진 것이 없으면 `null`. 문이 터져도 `null` 이다 — 이어쓰기는 부속이라 풀이는 보통 모양으로 선다.
 */
export async function tasteContinuationOfRun(runId: string): Promise<TasteRunCarry | null> {
  const who = await member();
  if (who === null) return null;

  const { data, error } = await who.keyed.rpc(
    'taste_continuation_of_run',
    rpcArgs<'taste_continuation_of_run'>({ p_user_id: who.userId, p_reading_run_id: runId }),
  );
  if (error !== null) {
    recordDbFailure(error, 'taste_continuation_of_run');
    return null;
  }

  const row = (data ?? [])[0];
  if (row === undefined) return null;
  return {
    previewMarkdown: row.preview_markdown,
    continuationQuestion: row.continuation_question,
    answerDirection: row.answer_direction,
    supportingClaims: row.supporting_claims ?? [],
  };
}
