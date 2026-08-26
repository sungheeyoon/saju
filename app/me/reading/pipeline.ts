import { randomUUID } from 'node:crypto';

import type { Saju } from '@/src/lib/saju';
import {
  isScored,
  READING_POLICY,
  type BirthSecret,
  type ReadingKind,
} from '@/src/lib/reading';

import { supabaseOnServer } from '../../auth/server-client';
import { chartOf } from '../../chart';
import { NoKeyError, keyedClient } from '../../keyed-client';
import { UnreadableRevisionError, queryFromRevision, type StoredRevision } from '../../revision';
import { ResultClosedError, pinnedInputs } from '../match/inputs';
import { generateReadingArtifact, type ReadingGenerator } from './generator';
import { gatewayReadingGenerator } from './model';

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
  generator: ReadingGenerator = gatewayReadingGenerator,
): Promise<ReadingRequest> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('start_reading_run', {
    p_kind: target.kind,
    /** 같은 누름의 재전송을 알아보는 값. 무엇을 막는지는 위 주석이 든다 */
    p_idempotency_key: requestKey ?? randomUUID(),
    p_person_a: target.kind === 'private' ? target.personA : null,
    p_person_b: target.kind === 'private' ? target.personB : null,
    p_match_id: target.kind === 'match' ? target.matchId : null,
    p_model: generator.generation.model,
    p_prompt_version: READING_POLICY.version,
  });

  if (error) return { ok: false, message: error.message };

  const started = ((data ?? []) as StartedRun[])[0];
  // 0행은 「같은 요청이 이미 돌았다」다. 모델을 부르지 않는다.
  if (started === undefined) return { ok: true, replaced: false };

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
  let revisions: StoredRevision[];
  try {
    revisions = await revisionsFor(kind, started);
  } catch (failure) {
    if (failure instanceof ResultClosedError) return fail(started.run_id, 'closed', failure.message);
    throw failure;
  }

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
async function revisionsFor(kind: ReadingKind, started: StartedRun): Promise<StoredRevision[]> {
  if (kind === 'match') {
    const inputs = await pinnedInputs(started.match_id as string);
    const a = inputs.get(started.revision_a);
    const b = started.revision_b === null ? undefined : inputs.get(started.revision_b);

    if (a === undefined || b === undefined) {
      throw new ResultClosedError('매인 판본을 찾지 못했습니다');
    }
    return [a, b];
  }

  const supabase = await supabaseOnServer();
  const wanted = [started.revision_a, ...(started.revision_b === null ? [] : [started.revision_b])];

  const { data } = await supabase
    .from('person_chart_revision')
    .select(
      'id, calendar, original_date, solar_date, birth_time, gender, city, late_night_rule, time_basis',
    )
    .in('id', wanted);

  const rows = new Map((data ?? []).map((row) => [row.id as string, row as StoredRevision]));

  /**
   * 하나라도 못 읽으면 멈춘다. 한 사람 것으로 두 사람 궁합을 지어낼 수 없고,
   * 지어낼 수 없는 것을 기본값으로 메우면 아무도 동의한 적 없는 결과가 선다.
   */
  return wanted.map((id) => {
    const row = rows.get(id);
    if (row === undefined) throw new ResultClosedError('계산 입력을 읽지 못했습니다');
    return row;
  });
}
