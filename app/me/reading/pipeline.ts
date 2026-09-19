import { randomUUID } from 'node:crypto';

import { after } from 'next/server';

import { relationOf } from '@/src/lib/people';
import type { Saju } from '@/src/lib/saju';
import {
  promptVersionOf,
  READING_UNEXPECTED_NOTE,
  writesSummaryLast,
  type ReadingAbout,
  type ReadingKind,
} from '@/src/lib/reading';

import { supabaseOnServer } from '../../auth/server-client';
import { userFacingDbMessage } from '../../db-error';
import { chartOf } from '@/src/lib/input/chart';
import { NoKeyError, keyedClient } from '../../keyed-client';
import { UnreadableRevisionError, queryFromRevision, type StoredRevision } from '@/src/lib/input/revision';
import { readingInputOf } from './generator';
import { GENERATION } from './generation';
import { submitBackgroundReading } from './model';
import { readingTargetArgs, type ReadingTarget } from './target';

/**
 * **결과 생성 요청** — 사용자가 눌렀을 때만 도는 길.
 *
 * 누르면 시도를 열고(`beginReading`), 응답이 나간 뒤에 **얼린 입력을 집어** 근거를
 * 자르고 · 프롬프트를 짓고 · 떠나보낸다(`sendRun`). 완성본을 가져와 검사하고 통째로
 * 교체하는 일은 webhook 과 복구기가 한다(`collect.ts`, ADR 0020). 실패하면 **직전 성공
 * 결과를 건드리지 않고** 실패만 남긴다(ADR 0017).
 *
 * ## 입력은 **시도를 여는 그 트랜잭션에서** 언다 (ADR 0071)
 *
 * 앞서는 이 파일이 응답 뒤에 판본을 읽어 입력을 정했다. 그 틈에 사용자가 입력을 고치면
 * **동의한 것과 계산한 것이 갈렸다.** 이제 `start_reading_run` 이 시도를 열면서 같은
 * 문장 안에서 계산 입력을 값으로 얼린다.
 *
 * 그래서 이 파일이 **읽는 자리가 하나로 줄었다** — 얼린 작업 하나다. `person` 도 판본도
 * 여기서 다시 안 읽고, kind 마다 갈리던 「어디서 입력을 읽는가」도 없어졌다. 공유 궁합의
 * 계산 입력을 열쇠로 읽던 문(`match_calculation_inputs`)도 이 길에서 빠진다.
 *
 * ## 집는 일은 **원자적이다**
 *
 * `take_reading_job`(수동)과 `match_run_awaiting_send`(수락)는 조회가 아니라 **전이**다 —
 * `frozen` 을 `preparing` 으로 옮기면서 그 행을 내준다. 복구기와 겹치거나 같은 누름이
 * 재전송돼도 **먼저 부른 쪽 하나만** 작업을 받고, 두 번째는 0행이다. 조회와 전이가
 * 갈리면 두 프로세스가 같은 작업을 들고 두 번 제출한다.
 *
 * ## 두 번 눌러도 한 번만 바뀐다 — 막는 것이 셋이다
 *
 * 1. **브라우저가 짓는 열쇠** — 같은 누름의 재전송이면 같은 값이라 두 번째가 0행이다.
 * 2. **대상별 잠금**(DB) — 다른 창, 다른 기기, **Match 의 상대**까지 같은 대상이면
 *    줄을 선다. 잠금이 사람별이면 두 당사자가 서로의 시도를 못 보고 둘 다 돈다.
 * 3. **늦게 돌아온 호출 거절**(DB) — 그 사이 새 시도가 열렸으면 저장이 거절된다.
 *
 * 화면의 버튼이 눌린 동안 잠기는 것은 거들 뿐이다 — 창이 둘이면 그 잠금은 없는 것과 같다.
 *
 * ## 저장은 **열쇠로** 한다
 *
 * `save_reading` 은 `authenticated` 에게 닫혀 있다(ADR 0013). 열어 두면 로그인한 사람이
 * 이 파이프라인을 통째로 건너뛰고 임의의 글을 저장할 수 있고, Match 에서는 그 글이
 * 상대에게 간다. 열쇠가 여는 것은 **시도 하나**이고, 그 시도는 사용자 JWT 로 자격이
 * 확인된 채 기록된 것이다.
 */

/** `start_reading_run` 이 내주는 한 줄 — 이 파일이 쓰는 것은 **시도 id 하나**다 */
type StartedRun = { run_id: string };

/**
 * 집어 온 얼린 작업 — **이 뒤로 다시 읽는 것이 없다.**
 *
 * `birth_a`·`birth_b` 는 시도를 열 때 값으로 얼린 계산 입력이고, `about` 은 그때 그
 * 사람들을 부르던 말과 두 사람의 사이다. 셋 다 DB 가 얼렸다 — 앱이 고르는 자리가 없다.
 */
type FrozenJob = {
  run_id: string;
  kind: ReadingKind;
  birth_a: StoredRevision;
  birth_b: StoredRevision | null;
  about: { names: { a: string; b?: string } | null; relation: string | null };
};

/**
 * 두 사람을 부르는 말 — **이름은 자료에 들어가지 않는다.**
 *
 * 프롬프트가 `charts.a`·`charts.b` 를 「첫 번째 분」·「두 번째 분」이라 부르므로 여기서도
 * 그렇게 짓는다. 별명이나 localLabel 을 넣으면 그 이름이 근거에 실려 나가고, 공유
 * 결과에서는 상대가 나를 뭐라 부르는지까지 새어 나간다.
 */
export const READING_CHART_NAMES = ['첫 번째 분', '두 번째 분'] as const;

/**
 * 시도를 **연다** — 모델은 아직 안 부른다.
 *
 * 여는 일과 만드는 일을 가르는 것이 비동기 생성의 전부다. 여기까지는 밀리초짜리
 * DB 왕복 하나라 응답을 붙들지 않고, 만드는 일은 응답이 나간 뒤에 돈다.
 *
 * **입력은 이 왕복 안에서 언다**(ADR 0071). 그래서 이 함수가 돌아온 뒤에 사용자가 입력을
 * 고쳐도 이미 시작된 생성은 동결값으로 끝난다.
 *
 * @returns 열었으면 그 시도, 이미 도는 것이 있으면 `null`, 못 열면 거절 문장.
 */
async function openRun(
  target: ReadingTarget,
  requestKey: string | undefined,
): Promise<{ ok: true; started: StartedRun | null } | { ok: false; message: string }> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('start_reading_run', {
    /* 대상을 인자로 푸는 일은 `target.ts` 하나가 한다 — 여기서 또 풀면 두 벌이 된다 */
    ...readingTargetArgs(target),
    /** 같은 누름의 재전송을 알아보는 값. 무엇을 막는지는 위 주석이 든다 */
    p_idempotency_key: requestKey ?? randomUUID(),
    p_model: GENERATION.model,
    p_prompt_version: promptVersionOf(target.kind),
  });

  /**
   * **거절은 DB 가 문장으로 낸다.** 그 문장은 그대로 세우고, 우리가 쓰지 않은 오류
   * (스키마·정책·PostgREST)는 기록으로 보낸다 — 사용자가 할 수 있는 것이 없고 우리
   * 스키마의 속만 말한다(`userFacingDbMessage`).
   */
  if (error) {
    return {
      ok: false,
      message: userFacingDbMessage(error, 'start_reading_run', READING_UNEXPECTED_NOTE),
    };
  }

  // 0행은 「같은 요청이 이미 돌았다」다. 모델을 부르지 않는다.
  return { ok: true, started: ((data ?? []) as StartedRun[])[0] ?? null };
}

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
 * `fail_reading_run` 은 `r.user_id = auth.uid()` 를 건다. 수락이 연 시도는 **청한 사람**
 * 것으로 서 있고 이 코드는 받은 쪽 응답 뒤에서 도므로, 그 문으로는 못 닫는다 — 그러면
 * 실패한 인연 궁합이 만료까지 열린 채 남는다. 열쇠가 여는 문은 임자를 안 묻는다.
 */
async function submitFrozen(
  keyed: ReturnType<typeof keyedClient>,
  job: FrozenJob,
): Promise<void> {
  const { kind } = job;

  const close = async (code: string, detail: string): Promise<void> => {
    await keyed.rpc('fail_reading_job', {
      p_run_id: job.run_id,
      p_failure_code: code,
      p_failure_detail: detail,
      /** 여기서 닫는 실패는 전부 **떠나보내기 전**이라 쓴 토큰이 없다(ADR 0039) */
      p_usage: null,
    });
  };

  let charts: { a: Saju; b?: Saju };
  try {
    charts = {
      a: chartOf(queryFromRevision(job.birth_a, READING_CHART_NAMES[0])),
      b:
        job.birth_b === null
          ? undefined
          : chartOf(queryFromRevision(job.birth_b, READING_CHART_NAMES[1])),
    };
  } catch (failure) {
    if (failure instanceof UnreadableRevisionError) {
      await close('unreadable-revision', failure.message);
      return;
    }
    throw failure;
  }

  /**
   * 얼려 둔 말을 그대로 쓴다 — **모르는 자리는 지어내지 않는다.**
   *
   * 이름을 하나라도 못 찾았으면 DB 가 이미 `null` 로 얼렸다(`reading_about`). 한쪽만
   * 이름으로 부르고 다른 쪽을 자리 이름으로 부르면, 읽는 사람은 이름 없는 쪽이 덜
   * 중요한 사람인 줄 안다.
   */
  const about: ReadingAbout = {
    names: job.about?.names ?? null,
    relation: relationOf(job.about?.relation ?? null),
  };

  const viewedAt = new Date();
  const made = readingInputOf({ kind, charts, viewedAt, about });
  if (!made.ok) {
    await close(made.code, made.detail);
    return;
  }

  const { error: prepareError } = await keyed.rpc('prepare_reading_job', {
    p_run_id: job.run_id,
    p_prompt: made.input.prompt,
    p_evidence: made.input.evidenceText,
    p_prompt_version: promptVersionOf(kind),
    p_requested_model: GENERATION.model,
    p_generation: { ...GENERATION.settings, provider: GENERATION.provider },
    p_viewed_at: viewedAt.toISOString(),
  });

  if (prepareError) {
    await close('unexpected', prepareError.message);
    return;
  }

  const submitted = await submitBackgroundReading(made.input.prompt, job.run_id, {
    summaryLast: writesSummaryLast(kind),
  });
  if (!submitted.ok) {
    await close(submitted.code, submitted.detail);
    return;
  }

  /**
   * **못 적어도 잃지 않는다.** 요청에 실어 보낸 `metadata.reading_run_id` 로 webhook 이
   * 되찾는다 — 이름표를 결과에 붙여 보내는 것이 우리 쪽 기록보다 먼저인 이유다.
   */
  await keyed.rpc('adopt_reading_job', {
    p_run_id: job.run_id,
    p_response_id: submitted.responseId,
  });
}

/**
 * 방금 연 시도를 집어 떠나보낸다.
 *
 * **0행이면 아무 일도 안 한다** — 이미 누가 집었거나 그 사이 시도가 닫힌 것이다. 그때
 * 또 제출하면 같은 시도에 두 번 나간다.
 */
async function sendRun(runId: string): Promise<void> {
  let keyed: ReturnType<typeof keyedClient>;
  try {
    keyed = keyedClient('결과 제출');
  } catch (failure) {
    await failAsUser(runId, 'unexpected', failure instanceof NoKeyError ? failure.message : '');
    return;
  }

  const { data, error } = await keyed.rpc('take_reading_job', { p_run_id: runId });
  if (error) {
    await keyed.rpc('fail_reading_job', {
      p_run_id: runId,
      p_failure_code: 'unexpected',
      p_failure_detail: error.message,
      p_usage: null,
    });
    return;
  }

  const job = ((data ?? []) as FrozenJob[])[0];
  if (job === undefined) return;

  await submitFrozen(keyed, job);
}

/** 눌렀을 때 화면이 곧바로 받는 답 — **결과가 아니라 시작 여부다.** */
export type ReadingStart =
  /** 이 누름이 시도를 열었다. 만드는 일은 응답 뒤에 돈다 */
  | { ok: true; started: true }
  /** 이미 도는 시도가 있다. 아무것도 새로 열지 않았다 */
  | { ok: true; started: false }
  | { ok: false; message: string };

/**
 * **응답을 먼저 보내고 만드는 일은 뒤에 돈다.**
 *
 * 앞서는 누름 하나가 모델 호출까지 붙들고 있었다. 그래서 새로고침이나 탭 닫기가
 * 요청을 끊으면 **만들던 것이 함께 끊겼고**, 열린 시도가 남아 그 대상이 10분간
 * 잠겼다. 사용자가 한 일은 새로고침 하나인데 대가가 그것이었다.
 *
 * `after` 는 응답이 나간 **뒤에** 콜백을 돌린다(라우트의 `maxDuration` 안에서).
 * 그러면 브라우저가 끊어도 만들던 것은 안 끊긴다 — 응답은 이미 갔으니 끊을 것이 없다.
 * 화면은 시도의 상태를 물어 보며 기다리고, 다른 기기에서 열어도 같은 상태를 본다.
 *
 * **시도를 여는 일은 여기서 기다린다.** `after` 안에서 열면 「눌렀는데 아무 일도 안
 * 일어난 것처럼 보이는」 창이 생기고, 그 사이에 한 번 더 누르면 잠금이 아직 없어서
 * 두 번 돈다. 여는 것은 밀리초짜리 DB 왕복 하나라 응답을 붙들지 않는다.
 */
export async function beginReading(
  target: ReadingTarget,
  requestKey?: string,
): Promise<ReadingStart> {
  const opened = await openRun(target, requestKey);
  if (!opened.ok) return opened;
  if (opened.started === null) return { ok: true, started: false };

  const runId = opened.started.run_id;
  after(async () => {
    /**
     * **여기서 던지면 아무도 못 듣는다.** 응답은 이미 나갔고 부르는 쪽이 없다. 그래도
     * `sendRun` 이 시도를 닫아 두므로 화면은 다음 물음에서 실패를 본다 — 열린 채
     * 남는 것만은 막아야 그 대상이 10분간 잠기지 않는다.
     */
    try {
      await sendRun(runId);
    } catch {
      // 여기까지 온 것은 우리가 못 적은 경우다. 복구기가 deadline 에 닫는다.
    }
  });

  return { ok: true, started: true };
}

/**
 * 동의가 연 시도를 **떠나보낸다** (ADR 0038).
 *
 * 수락은 시도를 열고 입력을 얼리기만 한다 — 자르기·프롬프트·제출은 Node 의 일이고,
 * DB 트랜잭션 안에서 할 수 있는 것이 아니다. 그래서 수락한 사람의 응답 뒤(`after`)에
 * 이 함수가 돈다.
 *
 * ## 누른 사람이 아니라 열쇠로 집는다
 *
 * 시도는 **청한 사람** 것으로 서 있고 `reading_run` 은 당사자에게도 안 열린다. 수락을
 * 부른 사람은 받은 쪽이라 그 행을 볼 길이 없다 — 그래서 열쇠가 여는 문 하나로 찾는다
 * (`match_run_awaiting_send`). 그 문은 **아직 아무도 안 집은 것만** 내주므로 두 번
 * 부르거나 복구기와 겹쳐도 같은 시도가 두 번 나가지 않는다.
 *
 * ## 못 보내도 막다른 길이 아니다
 *
 * 여기서 실패하면 시도는 `submitFrozen` 이 닫고(실패로), 결과 화면에는 「다시 만들기」가
 * 선다. 「누를 버튼이 없다」는 성공 경로의 약속이지 실패 경로의 약속이 아니다.
 */
export async function sendAcceptedMatchReading(requestId: string): Promise<void> {
  let keyed: ReturnType<typeof keyedClient>;
  try {
    keyed = keyedClient('동의가 연 시도를 제출할');
  } catch {
    // 열쇠가 없는 배포다. 시도는 열린 채로 남고 만료 때 닫힌다 — 화면에 버튼이 돌아온다.
    return;
  }

  const { data, error } = await keyed.rpc('match_run_awaiting_send', { p_request_id: requestId });
  if (error) return;

  const job = ((data ?? []) as FrozenJob[])[0];
  // 0행은 「보낼 것이 없다」다 — 수락이 시도를 못 열었거나 이미 떠났다.
  if (job === undefined) return;

  await submitFrozen(keyed, job);
}

/**
 * 열쇠가 없을 때만 쓰는 문 — **사용자 세션으로 닫는다.**
 *
 * 열쇠가 없으면 `fail_reading_job` 도 못 부르므로 남는 길이 이것뿐이다. 인연 궁합에는
 * 안 닿지만(그 시도의 임자는 청한 사람이다) 그 자리는 애초에 열쇠 없이는 아무것도 못
 * 하는 배포이고, 만료가 닫는다.
 */
async function failAsUser(runId: string, code: string, detail: string): Promise<void> {
  const supabase = await supabaseOnServer();

  await supabase.rpc('fail_reading_run', {
    p_run_id: runId,
    p_failure_code: code,
    p_failure_detail: detail,
    p_usage: null,
  });
}
