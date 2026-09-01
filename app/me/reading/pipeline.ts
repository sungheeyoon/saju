import { randomUUID } from 'node:crypto';

import { after } from 'next/server';

import { relationOf } from '@/src/lib/people';
import type { Saju } from '@/src/lib/saju';
import {
  isScored,
  NOTHING_KNOWN,
  READING_POLICY,
  type BirthSecret,
  type ReadingAbout,
  type ReadingKind,
} from '@/src/lib/reading';

import { supabaseOnServer } from '../../auth/server-client';
import { chartOf } from '../../chart';
import { NoKeyError, keyedClient } from '../../keyed-client';
import { UnreadableRevisionError, queryFromRevision, type StoredRevision } from '../../revision';
import { ResultClosedError, pinnedInputs } from '../match/inputs';
import { generateReadingArtifact, readingInputOf, type ReadingGenerator } from './generator';
import { GENERATION } from './generation';
import { openAIReadingGenerator, submitBackgroundReading } from './model';

/**
 * **결과 생성 요청** — 사용자가 눌렀을 때만 도는 길.
 *
 * 한 번의 왕복에서 여섯을 한다: 시작을 기록하고 · 판본을 읽고 · 근거를 자르고 ·
 * 모델을 부르고 · 나온 것을 검사하고 · 통째로 교체한다. 실패하면 **직전 성공 결과를
 * 건드리지 않고** 실패만 남긴다(PRD).
 *
 * ## 세 kind 가 갈리는 자리는 둘뿐이다
 *
 * **어디서 판본을 읽는가** — 자기 풀이와 비공개 궁합은 RLS 가 이미 열어 준 길로 읽고,
 * 공유 궁합은 매인 판본을 열쇠로 읽는다(ADR 0010). **어디까지 자르는가** —
 * `readingEvidenceOf` 가 kind 를 받아 정한다. 나머지는 한 길이다.
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
 * 확인된 채 기록된 것이다. 행은 **대상**의 증표이지 자격을 임대하는 표가 아니다 — 저장은
 * 그 행의 사용자로 현재 계정·엣지·차단 상태를 한 번 더 묻는다.
 *
 * ## 판본을 앱이 고르지 않는다
 *
 * `start_reading_run` 이 대상과 함께 **쓸 판본을 내준다.** 앱이 스스로 고르면 만들 때
 * 쓴 판본과 저장할 때 확인하는 판본이 서로 다른 자리에서 정해지고, 그 사이에 사용자가
 * 입력을 고치면 「지금 입력으로 썼다」고 적힌 옛 글이 남는다.
 */

export type ReadingTarget =
  | { kind: 'self' }
  | { kind: 'private'; personA: string; personB: string }
  | { kind: 'match'; matchId: string };

export type ReadingRequest =
  /** 새 결과로 교체했다 */
  | { ok: true; replaced: true }
  /** 같은 요청이 이미 돌았다 — 현재 결과를 읽으면 된다 */
  | { ok: true; replaced: false }
  | { ok: false; message: string };

/** `start_reading_run` 이 내주는 한 줄 */
type StartedRun = {
  run_id: string;
  person_a: string | null;
  person_b: string | null;
  match_id: string | null;
  revision_a: string;
  revision_b: string | null;
  viewer_is_first: boolean;
};

const secretOf = (revision: StoredRevision): BirthSecret => ({
  originalDate: revision.original_date,
  solarDate: revision.solar_date,
  birthTime: revision.birth_time,
  city: revision.city,
});

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
 * @returns 열었으면 그 시도, 이미 도는 것이 있으면 `null`, 못 열면 거절 문장.
 */
async function openRun(
  target: ReadingTarget,
  requestKey: string | undefined,
  generator: ReadingGenerator,
): Promise<{ ok: true; started: StartedRun | null } | { ok: false; message: string }> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('start_reading_run', {
    p_kind: target.kind,
    /** 같은 누름의 재전송을 알아보는 값. 무엇을 막는지는 아래 주석이 든다 */
    p_idempotency_key: requestKey ?? randomUUID(),
    p_person_a: target.kind === 'private' ? target.personA : null,
    p_person_b: target.kind === 'private' ? target.personB : null,
    p_match_id: target.kind === 'match' ? target.matchId : null,
    p_model: generator.generation.model,
    p_prompt_version: READING_POLICY.version,
  });

  if (error) return { ok: false, message: error.message };

  // 0행은 「같은 요청이 이미 돌았다」다. 모델을 부르지 않는다.
  return { ok: true, started: ((data ?? []) as StartedRun[])[0] ?? null };
}

/** 연 시도를 **끝까지 민다** — 자르고·부르고·검사하고·저장한다. */
/**
 * **떠나보낸다** — 얼리고, 제출하고, 이름표를 적는다 (ADR 0020).
 *
 * 완성본을 기다리지 않는다. 여기서 하는 일은 전부 밀리초짜리이거나 짧은 왕복 하나뿐이라
 * 240초 벽에 닿지 않는다.
 *
 * ## 얼리는 것이 제출보다 먼저다
 *
 * 순서가 뒤집히면 제출은 됐는데 재료가 없는 순간이 생기고, 그 사이에 webhook 이 오면
 * 집을 것이 없어 그대로 흘러간다.
 *
 * ## 실패는 여기서 닫는다
 *
 * 얼리기 전이나 제출 전에 걸린 것은 아직 아무것도 안 떠났으므로 그 자리에서 닫는다.
 * **제출한 뒤에 실패하는 자리는 없다** — 이름표를 못 적어도 `metadata` 가 그 일감을
 * 되찾아 주고, 그마저 안 되면 복구기가 deadline 에 닫는다.
 */
async function sendRun(target: ReadingTarget, started: StartedRun): Promise<void> {
  const { kind } = target;

  let keyed: ReturnType<typeof keyedClient>;
  try {
    keyed = keyedClient('결과 제출');
  } catch (failure) {
    await fail(started.run_id, 'unexpected', failure instanceof NoKeyError ? failure.message : '');
    return;
  }

  let read: Awaited<ReturnType<typeof revisionsFor>>;
  try {
    read = await revisionsFor(kind, started);
  } catch (failure) {
    await fail(started.run_id, 'closed', failure instanceof Error ? failure.message : '');
    return;
  }

  let charts: { a: Saju; b?: Saju };
  try {
    const [first, second] = read.revisions;
    charts = {
      a: chartOf(queryFromRevision(first, READING_CHART_NAMES[0])),
      b:
        second === undefined
          ? undefined
          : chartOf(queryFromRevision(second, READING_CHART_NAMES[1])),
    };
  } catch (failure) {
    if (failure instanceof UnreadableRevisionError) {
      await fail(started.run_id, 'unreadable-revision', failure.message);
      return;
    }
    throw failure;
  }

  const viewedAt = new Date();
  const made = readingInputOf({ kind, charts, viewedAt, about: read.about });
  if (!made.ok) {
    await fail(started.run_id, made.code, made.detail);
    return;
  }

  const { error: freezeError } = await keyed.rpc('freeze_reading_job', {
    p_run_id: started.run_id,
    p_revision_a: started.revision_a,
    p_revision_b: started.revision_b,
    p_prompt: made.input.prompt,
    p_evidence: made.input.evidenceText,
    p_prompt_version: READING_POLICY.version,
    p_requested_model: GENERATION.model,
    p_generation: { ...GENERATION.settings, provider: GENERATION.provider },
    p_viewed_at: viewedAt.toISOString(),
  });

  if (freezeError) {
    await fail(started.run_id, 'unexpected', freezeError.message);
    return;
  }

  const submitted = await submitBackgroundReading(made.input.prompt, started.run_id);
  if (!submitted.ok) {
    await fail(started.run_id, submitted.code, submitted.detail);
    return;
  }

  /**
   * **못 적어도 잃지 않는다.** 요청에 실어 보낸 `metadata.reading_run_id` 로 webhook 이
   * 되찾는다 — 이름표를 결과에 붙여 보내는 것이 우리 쪽 기록보다 먼저인 이유다.
   */
  await keyed.rpc('adopt_reading_job', {
    p_run_id: started.run_id,
    p_response_id: submitted.responseId,
  });
}

async function closeRun(
  target: ReadingTarget,
  started: StartedRun,
  generator: ReadingGenerator,
): Promise<ReadingRequest> {
  /**
   * **모델보다 열쇠를 먼저 확인한다.** 자기 풀이·비공개 궁합은 계산 입력을 사용자 JWT 로
   * 읽으므로 이 확인이 저장 직전까지 미뤄지기 쉽다. 그러면 열쇠 없는 배포에서도 유료
   * 생성을 한 뒤 결과만 버린다 — 만들 수 없는 결과는 부르지도 않는다.
   */
  let keyed: ReturnType<typeof keyedClient>;
  try {
    keyed = keyedClient('결과를 저장할');
  } catch (failure) {
    if (failure instanceof NoKeyError) return fail(started.run_id, 'closed', failure.message);
    throw failure;
  }

  try {
    return await generate(target.kind, started, keyed, generator);
  } catch (failure) {
    /**
     * 여기까지 온 예외는 우리가 값으로 다루지 않은 것이다. 시도를 열어 둔 채 끝내면
     * 그 대상은 「도는 중」으로 남아 화면이 영영 그렇게 말한다.
     */
    await fail(started.run_id, 'unexpected', failure instanceof Error ? failure.message : '알 수 없는 실패');
    throw failure;
  }
}

/**
 * **누름 하나를 끝까지 처리한다** — 열고, 만들고, 저장한다.
 *
 * **화면은 이 길로 오지 않고, 응답 뒤에 도는 일도 더는 이 함수가 아니다**(ADR 0020).
 * `beginReading` 은 이제 얼리고 떠나보내며(`sendRun`), 완성본은 webhook 이나 복구기가
 * 가져와 저장한다(`collect.ts`).
 *
 * 그래도 남긴다. **자르기 → 프롬프트 → 검사 → 저장을 한 번에 밀어 보는 자리**가 여기
 * 하나뿐이고, 그 네 자리는 새 길에서도 그대로 쓰인다. 다만 **이 함수가 초록이라고 화면이
 * 도는 것은 아니다** — 배선은 `beginReading` 을 미는 시험이 따로 잰다.
 *
 * 옛 길만 밀던 동안 새 배선은 한 번도 안 지나간 채로 네 층이 다 초록이었다. 그 상태가
 * 실제로 있었고, 그래서 이 문단이 있다.
 */
export async function requestReading(
  target: ReadingTarget,
  /**
   * 한 번 누른 것을 가리키는 값 — **브라우저가 짓는다.**
   *
   * 손으로 적을 자리를 여는 것이 맞는 드문 경우다. 이 값이 지어내는 것은 남에 대한
   * 사실이 아니라 **자기 요청의 이름**이고, 거짓으로 지어도 자기 요청 하나가 두 번
   * 도는 것뿐이다. 같은 누름의 재전송을 알아보려면 브라우저 쪽에 안정된 값이 있어야 한다.
   *
   * 없으면 서버가 짓는다 — 그때는 이 열쇠가 아무것도 막지 못하고, 막는 것은 DB 의
   * 대상별 잠금뿐이다.
   */
  requestKey?: string,
  generator: ReadingGenerator = openAIReadingGenerator,
): Promise<ReadingRequest> {
  const opened = await openRun(target, requestKey, generator);
  if (!opened.ok) return opened;
  if (opened.started === null) return { ok: true, replaced: false };

  return closeRun(target, opened.started, generator);
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
  generator: ReadingGenerator = openAIReadingGenerator,
): Promise<ReadingStart> {
  const opened = await openRun(target, requestKey, generator);
  if (!opened.ok) return opened;
  if (opened.started === null) return { ok: true, started: false };

  const started = opened.started;
  after(async () => {
    /**
     * **여기서 던지면 아무도 못 듣는다.** 응답은 이미 나갔고 부르는 쪽이 없다. 그래도
     * `sendRun` 이 시도를 닫아 두므로 화면은 다음 물음에서 실패를 본다 — 열린 채
     * 남는 것만은 막아야 그 대상이 10분간 잠기지 않는다.
     */
    try {
      await sendRun(target, started);
    } catch {
      // 여기까지 온 것은 우리가 못 적은 경우다. 복구기가 deadline 에 닫는다.
    }
  });

  return { ok: true, started: true };
}

async function fail(runId: string, code: string, detail: string): Promise<ReadingRequest> {
  const supabase = await supabaseOnServer();

  await supabase.rpc('fail_reading_run', {
    p_run_id: runId,
    p_failure_code: code,
    p_failure_detail: detail,
  });

  return { ok: false, message: messageFor(code, detail) };
}

/** 사용자가 읽을 말 — 코드 이름을 그대로 보이지 않는다 */
function messageFor(code: string, detail: string): string {
  /**
   * 시간 초과도 여기다. 새 코드를 안 적으면 아래 갈래로 새어 「검사를 통과하지
   * 못했습니다(model-timeout)」가 되는데, 검사는 서 보지도 못했다.
   */
  if (code === 'model-timeout') {
    return '결과를 만드는 데 너무 오래 걸려 중간에 멈췄습니다. 잠시 뒤에 다시 시도해 주세요. 지금 보이는 결과는 그대로입니다.';
  }
  if (code === 'model-call-failed' || code === 'model-no-output') {
    return '결과를 만들지 못했습니다. 잠시 뒤에 다시 시도해 주세요. 지금 보이는 결과는 그대로입니다.';
  }
  if (code === 'unreadable-revision') return detail;
  if (code === 'closed') return detail;

  return `만든 글이 검사를 통과하지 못했습니다(${code}). 지금 보이는 결과는 그대로입니다.`;
}

async function generate(
  kind: ReadingKind,
  started: StartedRun,
  keyed: ReturnType<typeof keyedClient>,
  generator: ReadingGenerator,
): Promise<ReadingRequest> {
  let read: Awaited<ReturnType<typeof revisionsFor>>;
  try {
    read = await revisionsFor(kind, started);
  } catch (failure) {
    if (failure instanceof ResultClosedError) return fail(started.run_id, 'closed', failure.message);
    throw failure;
  }
  const { revisions, about } = read;

  let charts: { a: Saju; b?: Saju };
  try {
    const [first, second] = revisions;
    charts = {
      a: chartOf(queryFromRevision(first, READING_CHART_NAMES[0])),
      b: second === undefined ? undefined : chartOf(queryFromRevision(second, READING_CHART_NAMES[1])),
    };
  } catch (failure) {
    /** 못 읽는 판본은 기본값으로 메우지 않는다 — 화면들과 같은 규율 */
    if (failure instanceof UnreadableRevisionError) {
      return fail(started.run_id, 'unreadable-revision', failure.message);
    }
    throw failure;
  }

  const viewedAt = new Date();
  const generated = await generateReadingArtifact({
    kind,
    charts,
    viewedAt,
    secrets: revisions.map(secretOf),
    about,
    generator,
  });
  if (!generated.ok) return fail(started.run_id, generated.code, generated.detail);

  const { evidenceText, output, prompt } = generated.artifact;

  /**
   * **대상을 다시 대지 않는다.** 열쇠가 여는 것은 시도 하나이고, 그 시도가 무엇에
   * 대한 것인지는 이미 DB 에 적혀 있다 — 앱이 kind 나 Person 을 여기서 또 대면 시도와
   * 대상을 갈라 놓을 수 있는 자리가 생긴다.
   */
  const { error } = await keyed.rpc('save_reading', {
    p_run_id: started.run_id,
    p_revision_a: started.revision_a,
    p_revision_b: started.revision_b,
    p_output: output.markdown,
    p_score: isScored(kind) ? output.score : null,
    p_evidence: evidenceText,
    p_prompt: prompt,
    p_prompt_version: READING_POLICY.version,
    p_model: generator.generation.model,
    p_generation: {
      provider: generator.generation.provider,
      settings: generator.generation.settings,
    },
    p_viewed_at: viewedAt.toISOString(),
  });

  /**
   * 거절당했으면 **여기서 시도를 닫는다.**
   *
   * DB 안에서 닫을 수 없다 — 거절은 `raise` 로 나가고, 그 `raise` 가 같은 트랜잭션의
   * `update` 를 되돌린다. 안 닫으면 그 대상이 만료까지 잠겨 다시 눌러도 아무 일이
   * 일어나지 않는다.
   */
  if (error) {
    await fail(started.run_id, 'save-rejected', error.message);
    return { ok: false, message: error.message };
  }

  return { ok: true, replaced: true };
}

/**
 * 그 대상의 계산 입력 — **kind 마다 읽는 문이 다르다.**
 *
 * 공유 궁합만 열쇠를 쓴다(ADR 0010). 나머지 둘은 RLS 가 이미 열어 준 길이고, 거기에
 * 열쇠를 쓰면 「무엇을 볼 수 있는가」의 답이 정책에서 앱 코드로 옮겨 간다.
 */
/**
 * 그 시도가 읽을 판본들과, 그 사람들을 **부르는 말.**
 *
 * 둘을 함께 내는 까닭은 차례가 하나이기 때문이다. 이름을 다른 함수가 따로 구해 오면
 * 판본의 차례와 이름의 차례를 맞추는 일이 부르는 쪽 몫이 되고, **자리가 넷이면 하나는
 * 안 고쳐진다.**
 */
async function revisionsFor(
  kind: ReadingKind,
  started: StartedRun,
): Promise<{ revisions: StoredRevision[]; about: ReadingAbout }> {
  if (kind === 'match') {
    const inputs = await pinnedInputs(started.match_id as string);
    const a = inputs.get(started.revision_a);
    const b = started.revision_b === null ? undefined : inputs.get(started.revision_b);

    if (a === undefined || b === undefined) {
      throw new ResultClosedError('매인 판본을 찾지 못했습니다');
    }

    /**
     * **공유 궁합은 아직 이름을 못 부른다.**
     *
     * 이름이 없어서가 아니다 — 두 사람 다 스스로 고른 별명이 있고 결과 화면에 이미
     * 서 있다(`partner_nickname`). 없는 것은 **어느 판본이 누구 것인가**다.
     * `match_calculation_inputs` 는 판본만 내주고 소유자를 안 밝힌다. 그 매김을 앱이
     * 짐작하면 두 사람의 이름이 서로 바뀐 채 나갈 수 있고, 그건 안 부르는 것보다 나쁘다.
     *
     * 내 쪽 별명을 상대 자리에 쓰는 길도 막혀 있다. 내가 붙인 말은 상대가 보는 화면에
     * 실려서는 안 된다 — 그것이 이 파일이 처음부터 localLabel 을 근거에 안 실은 이유다.
     */
    /**
     * **관계도 여기서 고르지 않는다.** 인연 찾기에서 만나 서로 동의한 사이라는 것은
     * 성립 방식이 이미 정한 사실이라, 프롬프트가 kind 로 안다(`relationBlock`).
     */
    return { revisions: [a, b], about: NOTHING_KNOWN };
  }

  const supabase = await supabaseOnServer();
  const wanted = [started.revision_a, ...(started.revision_b === null ? [] : [started.revision_b])];

  const { data } = await supabase
    .from('person_chart_revision')
    .select(
      'id, person_id, calendar, original_date, solar_date, birth_time, gender, city, late_night_rule, time_basis',
    )
    .in('id', wanted);

  const rows = new Map(
    (data ?? []).map((row) => [row.id as string, row as StoredRevision & { person_id: string }]),
  );

  /**
   * 하나라도 못 읽으면 멈춘다. 한 사람 것으로 두 사람 궁합을 지어낼 수 없고,
   * 지어낼 수 없는 것을 기본값으로 메우면 아무도 동의한 적 없는 결과가 선다.
   */
  const found = wanted.map((id) => {
    const row = rows.get(id);
    if (row === undefined) throw new ResultClosedError('계산 입력을 읽지 못했습니다');
    return row;
  });

  return { revisions: found, about: await aboutFor(found.map((row) => row.person_id)) };
}

/**
 * 내가 그 사람을 뭐라 부르고 **이 쌍이 무슨 사이인가** — 차례는 판본이 정한다.
 *
 * 쌍의 차례를 여기서 다시 정하지 않는다. 비공개 궁합의 두 판본은 DB 가 Person id 로
 * 줄 세워 내주므로(`least`·`greatest`), 이름도 **그 판본이 들고 온 `person_id`** 를 따라
 * 붙인다. 앱이 같은 정렬 규칙을 한 번 더 적으면 자리가 둘이 되고, 둘이 갈리는 날
 * 이름과 명식이 서로 바뀐 채로 나간다.
 *
 * 못 찾은 자리는 지어내지 않는다 — 부를 말이 없다는 사실을 그대로 넘긴다.
 *
 * ## 관계는 **쌍에 물어본다**
 *
 * 사람에 붙였다면 어머니와 친구의 궁합에서는 답이 없었을 것이다 — 어머니가 나의
 * 가족인 것과 어머니가 그 친구와 무슨 사이인지는 다른 물음이기 때문이다. 궁합 화면이
 * 지금 보고 있는 두 사람에 대해 묻고, 그 답이 그 쌍에 남는다.
 *
 * **없으면 「모른다」다.** 행이 없는 것이 곧 모른다이므로, 여기서 두 가지 없음을
 * 가르지 않는다.
 */
async function aboutFor(personIds: readonly string[]): Promise<ReadingAbout> {
  const supabase = await supabaseOnServer();
  const [first, second] = personIds;

  const [edges, pair] = await Promise.all([
    // 정책이 자기 목록만 내준다. 여기서 `user_id` 를 또 적지 않는다.
    supabase
      .from('user_person_access')
      .select('person_id, local_label')
      .in('person_id', [...personIds]),
    second === undefined
      ? Promise.resolve({ data: null })
      : supabase.rpc('pair_relation_of', { p_person_a: first, p_person_b: second }),
  ]);

  const labels = new Map(
    (edges.data ?? []).map((row) => [row.person_id as string, row.local_label as string]),
  );
  const a = labels.get(first);
  const b = second === undefined ? undefined : labels.get(second);

  /**
   * **하나라도 못 찾으면 이름은 통째로 포기한다.** 한쪽만 이름으로 부르고 다른 쪽을
   * 「두 번째 분」이라 부르면, 읽는 사람은 이름 없는 쪽이 덜 중요한 사람인 줄 안다.
   */
  const names =
    a === undefined || (second !== undefined && b === undefined) ? null : { a, b };

  return { names, relation: relationOf(pair.data as string | null) };
}
