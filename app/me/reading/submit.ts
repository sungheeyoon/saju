import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';
import { relationOf } from '@/src/lib/people';
import type { Saju } from '@/src/lib/saju';
import {
  promptVersionOf,
  sectionCounter,
  writesSummaryLast,
  type ReadingAbout,
  type ReadingKind,
} from '@/src/lib/reading';
import { continuationBlockOf, type TasteRunCarry } from '@/src/lib/reading/continuation';
import { SEAT_NAMES } from '@/src/lib/reading/display';
import { storedChartOf, type StoredInput } from '@/src/lib/input/stored';

import { recordDbFailure } from '../../db-error';
import { failReadingJob } from './fail-job';
import { GENERATION } from './generation';
import { readingInputOf } from './generator';
import { SUBMIT_UNANSWERED, submitBackgroundReading } from './model';

/**
 * **얼린 일감을 떠나보내는 자리** — 누름의 `after`(`pipeline.ts`)와 복구기가 함께 부른다(ADR 0210).
 *
 * 로그인 세션을 묻지 않는다 — 복구기는 관문 밖에서 돌고 사람이 없다. 열쇠는 부르는 쪽이 넘긴다(`KEY_HOLDERS`, ADR 0136).
 */

type Keyed = SupabaseClient<Database>;

/**
 * 집어 온 얼린 작업 — **이 뒤로 다시 읽는 것이 없다.**
 *
 * `birth_a`·`birth_b` 는 시도를 열 때 값으로 얼린 계산 입력이고, `about` 은 그때 두 사람의 사이다.
 * 셋 다 DB 가 얼렸다 — 앱이 고르는 자리가 없다.
 *
 * **`about` 에는 그때의 이름(`names`)도 얼어 있지만 여기서 읽지 않는다**(운영자 2026-10-15) — 이름은 모델로
 * 보내지 않고, 화면이 자리 호칭을 지금의 닉네임으로 바꾼다(`withNicknames`). 그래서 타입에도 안 적는다.
 */
export type FrozenJob = {
  run_id: string;
  kind: ReadingKind;
  birth_a: StoredInput;
  birth_b: StoredInput | null;
  about: { relation: string | null };
};

/**
 * 두 사람을 부르는 말 — **이름은 자료에 들어가지 않는다.**
 *
 * 프롬프트가 `charts.a`·`charts.b` 를 자리 호칭(`SEAT_NAMES`)으로 부르므로 여기서도 그렇게 짓는다.
 * 별명이나 localLabel 을 넣으면 그 이름이 근거에 실려 나가고, 공유 결과에서는 상대가 나를 뭐라
 * 부르는지까지 새어 나간다.
 */
export const READING_CHART_NAMES = [SEAT_NAMES.first, SEAT_NAMES.second] as const;

/**
 * 집어 온 작업을 **떠나보낸다** — 짓고, 적고, 제출하고, 이름표를 붙인다 (ADR 0020).
 *
 * 완성본을 기다리지 않는다. 여기서 하는 일은 전부 밀리초짜리이거나 짧은 왕복 하나뿐이라
 * 240초 벽에 닿지 않는다.
 *
 * ## 적는 것이 제출보다 먼저다
 *
 * 순서가 뒤집히면 제출은 됐는데 재료가 없는 순간이 생기고, 그 사이에 webhook 이 오면
 * 집을 것이 없어 그대로 흘러간다.
 *
 * ## 실패는 **열쇠로** 닫는다
 *
 * 사용자 권한으로 닫는 문(`fail_reading_run`)은 `r.user_id = auth.uid()` 를 걸어 수락이 연 시도(**청한 사람**
 * 것)를 못 닫았고, 사용자가 제 시도를 곧바로 닫아 하루 상한을 태울 수 있어 걷었다(ADR 0120). 열쇠가 여는 문은
 * 임자를 안 묻는다.
 */
export async function submitFrozen(
  keyed: Keyed,
  job: FrozenJob,
  /** 이어진 맛보기의 스냅숏 — 자기 풀이에서 귀속된 세션이 이 시도에 이어졌을 때만(ADR 0143). 없으면 지금 모양 그대로다 */
  continuation: TasteRunCarry | null,
  /** 집을 때 쓴 임대 식별자 — 제출 직전 문과 그 앞의 실패 닫기는 지금 쥔 작업자일 때만 선다(ADR 0210) */
  leaseId: string,
  /** 복구기는 따라 읽지 않는다 — 일감 하나가 본문을 다 쓸 때까지 뒤가 밀린다(ADR 0210) */
  follow: 'follow' | 'leave' = 'follow',
): Promise<void> {
  const { kind } = job;

  /**
   * 여기서 닫는 실패는 **떠나보내기 전**이거나 provider 가 거절한 제출(상태 코드 · 스트림의 `error` 사건)이라 쓴 토큰을 모른다 —
   * `null` 로 적는다(ADR 0039). 답을 못 받은 제출은 여기서 안 닫는다(아래)
   */
  const close = async (code: string, detail: string): Promise<void> => {
    await failReadingJob(keyed, 'submit', { runId: job.run_id, code, detail, usage: null });
  };
  /** 제출 직전 문 앞의 실패 — 임대를 잃은 옛 작업자가 새 작업자의 시도를 닫지 못하게 식별자를 든다(ADR 0210) */
  const closeHeld = async (code: string, detail: string): Promise<void> => {
    await failReadingJob(keyed, 'submit', { runId: job.run_id, code, detail, usage: null, leaseId });
  };

  /**
   * 얼린 입력을 세운다 — **`person` 행이 아니라 값이다**(ADR 0071).
   *
   * 못 읽는 입력은 시도를 닫고, 그 밖의 계산 오류는 그대로 던진다. 던진 것은 바깥의
   * `catch` 가 기록만 남기고, 시도는 복구기나 기한이 처리한다.
   */
  const stood = {
    a: storedChartOf(job.birth_a, READING_CHART_NAMES[0]),
    b: job.birth_b === null ? null : storedChartOf(job.birth_b, READING_CHART_NAMES[1]),
  };

  const unreadable = [stood.a, stood.b].find((one) => one !== null && !one.ok);
  if (unreadable !== undefined && unreadable !== null && !unreadable.ok) {
    await closeHeld('unreadable-revision', unreadable.message);
    return;
  }

  if (!stood.a.ok || (stood.b !== null && !stood.b.ok)) return;

  const charts: { a: Saju; b?: Saju } = {
    a: stood.a.saju,
    b: stood.b === null ? undefined : stood.b.saju,
  };

  /** 얼려 둔 사이를 그대로 쓴다 — **모르는 자리는 지어내지 않는다.** 이름은 넘기지 않는다(`FrozenJob`) */
  const about: ReadingAbout = { relation: relationOf(job.about?.relation ?? null) };

  const viewedAt = new Date();
  const made = readingInputOf({ kind, charts, viewedAt, about });
  if (!made.ok) {
    await closeHeld(made.code, made.detail);
    return;
  }

  /**
   * **이어쓰기는 프롬프트 맨 뒤에 붙는다**(ADR 0143 의 2) — 자기 풀이의 프롬프트(`readingPromptOf`)는 한 글자도 안 바뀌고,
   * 사람마다 다른 블록이 그 뒤에 선다. 얼린 프롬프트가 이 전체라 회수 · 검산이 보는 것도 이것이다. 회수가 이어쓰기를 알아보는
   * 표는 `generation.continuation` 이다 — 그 칸이 든 원문으로 답이 맛보기를 되풀이하는지 잰다(`collect.ts`).
   */
  const continued = continuation !== null && kind === 'self';
  const prompt = continued ? `${made.input.prompt}\n\n${continuationBlockOf(continuation)}` : made.input.prompt;

  const { data: preparedNow, error: prepareError } = await keyed.rpc('prepare_reading_job', {
    p_run_id: job.run_id,
    p_prompt: prompt,
    p_evidence: made.input.evidenceText,
    p_prompt_version: promptVersionOf(kind),
    p_requested_model: GENERATION.model,
    p_generation: {
      ...GENERATION.settings,
      provider: GENERATION.provider,
      ...(continued ? { continuation: { preview: continuation.previewMarkdown } } : {}),
    },
    p_viewed_at: viewedAt.toISOString(),
    p_lease_id: leaseId,
    /**
     * **프롬프트에 실은 기준점과 그 눈금** — 풀이를 다시 여는 화면이 만든 때의 눈금으로 지표를 그린다(ADR 0113).
     * 저장하는 문이 얼린 작업에서 옮긴다. 한 사람 풀이는 싣지 않는다 — 인자가 빠지면 DB 기본값 `null` 이다.
     */
    ...(made.input.score === null
      ? {}
      : {
          p_score_baseline: made.input.score.baseline,
          p_score_version: made.input.score.version,
          ...(made.input.score.relation === null ? {} : { p_score_relation: made.input.score.relation }),
        }),
  });

  if (prepareError) {
    await closeHeld('unexpected', prepareError.message);
    return;
  }

  /**
   * **문이 거짓이면 보내지 않는다.** 시도가 이미 닫혔거나(만료 · 복구기의 `prepare-timeout`) 작업이 이미 지나갔다는 뜻이다 —
   * 그때 보내면 모델은 돌고 그 시도에는 제출 직전 표시(`prepared_at`)가 없어 하루 상한이 못 센다(ADR 0198). 복구기가 다시 집어
   * 식별자가 바뀌어도 여기서 선다 — 둘이 함께 제출하지 않는다(ADR 0210). 닫는 것은 이미 닫은 쪽의 일이라 여기서는 돌아가기만 한다.
   */
  if (preparedNow !== true) return;

  const submitted = await submitBackgroundReading(prompt, job.run_id, {
    summaryLast: writesSummaryLast(kind),
    continuation: continued,
  });
  /**
   * **답을 못 받은 제출은 닫지 않는다.** provider 가 받았으면 응답이 돌고 있고, 그 webhook 이 이름표(`metadata.reading_run_id`)로
   * 이 시도를 되찾는다 — 되찾기는 `submitting` 인 시도만 받으므로 여기서 닫으면 그 결과는 버려진다(`submit-unanswered.test.ts`).
   * 안 닿았으면 아무것도 안 오고, 복구기가 기한(`reading_job_deadline()`)에 `model-timeout` 으로 닫는다. 까닭은 기록에만 남긴다.
   */
  if (!submitted.ok && submitted.code === SUBMIT_UNANSWERED) {
    console.error('submit: 답 없음 — 시도를 열어 둔다', job.run_id, submitted.detail);
    return;
  }
  if (!submitted.ok) {
    await close(submitted.code, submitted.detail);
    return;
  }

  /**
   * **못 적어도 잃지 않는다.** 요청에 실어 보낸 `metadata.reading_run_id` 로 webhook 이
   * 되찾는다 — 이름표를 결과에 붙여 보내는 것이 우리 쪽 기록보다 먼저인 이유다.
   */
  const { error: notAdopted } = await keyed.rpc('adopt_reading_job', {
    p_run_id: job.run_id,
    p_response_id: submitted.responseId,
  });
  if (notAdopted) console.error('submit: adopt_reading_job', notAdopted.code, notAdopted.message);

  if (follow === 'leave') {
    submitted.release();
    return;
  }
  await followProgress(keyed, job.run_id, submitted.written);
}

/**
 * 만드는 동안 **몇 번째 절까지 썼는지** 적는다 — 절 번호만, 글은 한 자도 안 적는다(ADR 0127).
 *
 * 흘러나오는 본문 조각에서 절 머리를 세고(`sectionCounter`), 값이 바뀔 때만 열쇠 문 하나를 부른다. 본문을 다 썼으면
 * 더 셀 것이 없어 그만둔다 — 완성본은 webhook 이 받는다.
 *
 * **여기서 무엇이 끊겨도 진행만 멈춘다.** 스트림이 끊기거나 적는 문이 거절해도 시도는 안 닫는다 — 만드는 일은
 * provider 쪽에서 그대로 돌고 있고, 닫는 것은 결과를 받는 쪽(`collect.ts`)의 일이다. 끝난 시도라 적는 문이
 * `false` 로 답하면 거기서 그만둔다.
 */
async function followProgress(
  keyed: Keyed,
  runId: string,
  written: AsyncIterable<string>,
): Promise<void> {
  const counter = sectionCounter();
  let noted = counter.count;

  try {
    for await (const chunk of written) {
      const now = counter.feed(chunk);
      if (now.begun === noted.begun && now.bodyWritten === noted.bodyWritten) continue;

      const { data: stillRunning, error } = await keyed.rpc('note_reading_progress', {
        p_run_id: runId,
        p_sections_begun: now.begun,
        p_body_written: now.bodyWritten,
      });
      if (error) {
        console.error('progress: note_reading_progress', error.code, error.message);
        return;
      }
      if (stillRunning !== true) return;

      noted = now;
      if (now.bodyWritten) return;
    }
  } catch (thrown) {
    console.error('progress: 따라 읽기가 끊겼다', thrown instanceof Error ? thrown.message : thrown);
  }
}

/**
 * **제출 전에 멈춘 일감을 복구기가 다시 보낸다**(ADR 0210) — `after` 가 안 돌았거나 제출 전에 죽은 것이다.
 *
 * 다시 보내도 되는지는 DB 가 집으면서 정한다(`reading_job_resendable`). 0행이면 아무 일도 안 한다 — 첫 작업자가 먼저 지나갔거나
 * 시도가 닫혔다. 이어쓰기는 첫 작업자의 메모리에 있던 값이라 집기의 답에서 읽는다. 제출하고 이름표를 적으면 돌아간다.
 *
 * @returns 집었는가 — 복구기가 세는 값이다
 */
export async function resendStalledRun(keyed: Keyed, runId: string): Promise<boolean> {
  const leaseId = randomUUID();
  const { data, error } = await keyed.rpc('retake_stalled_reading_job', { p_run_id: runId, p_lease_id: leaseId });
  if (error) {
    /* 닫지 않는다 — 다음 바퀴가 다시 집고, 못 집으면 기한이 닫는다 */
    recordDbFailure(error, 'resend: retake_stalled_reading_job');
    return false;
  }

  const row = (data ?? [])[0];
  if (row === undefined) return false;

  const continuation: TasteRunCarry | null =
    row.preview_markdown === null
      ? null
      : {
          previewMarkdown: row.preview_markdown,
          continuationQuestion: row.continuation_question,
          answerDirection: row.answer_direction,
          supportingClaims: row.supporting_claims ?? [],
        };
  const job: FrozenJob = {
    run_id: row.run_id,
    kind: row.kind as ReadingKind,
    birth_a: row.birth_a as StoredInput,
    birth_b: row.birth_b as StoredInput | null,
    about: row.about as FrozenJob['about'],
  };
  await submitFrozen(keyed, job, continuation, leaseId, 'leave');
  return true;
}
