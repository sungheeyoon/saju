import { supabaseOnServer } from '../../auth/server-client';
import type { ReadingTarget } from './pipeline';

/**
 * **현재 결과가 브라우저로 내려가는 문.**
 *
 * 화면을 여는 것은 저장된 값을 읽는 일이고 **AI 를 부르지 않는다**(PRD·ADR 0001).
 * 그 규율이 코드 모양으로도 참이도록, 읽는 자리(여기)와 만드는 자리(`pipeline.ts`)를
 * 갈라 둔다 — 한 함수가 「없으면 만든다」를 하면 조회만으로 비용과 결과가 달라진다.
 *
 * 근거와 프롬프트는 여기서 안 나간다. 그 둘은 내부 테스트 화면의 것이고 문이 따로다.
 */

export type CurrentReading = {
  readonly id: string;
  /** 궁합만. 자기 풀이는 `null` */
  readonly score: number | null;
  /** 원문 Markdown — 화면은 이 글의 절 구조를 알지 않는다 */
  readonly output: string;
  readonly model: string;
  readonly viewedAt: string;
  readonly createdAt: string;
  /** 공유 결과의 글이 「첫 번째 분」이라 부르는 것이 나인가 */
  readonly viewerIsFirst: boolean;
  /** 이 글을 만든 판본이 아직 지금 판본인가 — `match` 는 언제나 참이다 */
  readonly fromCurrentRevision: boolean;
};

export type LastRun = {
  readonly status: 'running' | 'succeeded' | 'failed';
  readonly failureCode: string | null;
  readonly createdAt: string;
};

const argsOf = (target: ReadingTarget) => ({
  p_kind: target.kind,
  p_person_a: target.kind === 'private' ? target.personA : null,
  p_person_b: target.kind === 'private' ? target.personB : null,
  p_match_id: target.kind === 'match' ? target.matchId : null,
});

/** @returns 아직 만들지 않았거나 못 보는 대상이면 `null` — 둘을 가르지 않는다 */
export async function currentReading(target: ReadingTarget): Promise<CurrentReading | null> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_reading', argsOf(target));
  if (error) return null;

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (row === undefined) return null;

  return {
    id: row.id as string,
    score: (row.score as number | null) ?? null,
    output: row.output as string,
    model: row.model as string,
    viewedAt: row.viewed_at as string,
    createdAt: row.created_at as string,
    viewerIsFirst: row.viewer_is_first as boolean,
    fromCurrentRevision: row.from_current_revision as boolean,
  };
}

/**
 * 마지막 시도가 어떻게 됐나.
 *
 * 실패는 알림함에 서지 않는다 — 생성이 요청과 같은 왕복에서 끝나므로 누른 사람은 그
 * 자리에서 본다. 다만 다른 기기에서 열었거나 새로고침한 뒤에도 「지난번에 실패했다」를
 * 말할 수 있어야 해서, 그 근거를 이 값이 든다(US 56).
 */
export async function lastReadingRun(target: ReadingTarget): Promise<LastRun | null> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_last_reading_run', argsOf(target));
  if (error) return null;

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (row === undefined) return null;

  return {
    status: row.status as LastRun['status'],
    failureCode: (row.failure_code as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export type ReadingArtifacts = {
  readonly evidence: string;
  readonly prompt: string;
  readonly promptVersion: string;
  readonly generation: unknown;
};

/**
 * 근거·프롬프트·생성 설정 — **내부 테스트 화면만 부른다.**
 *
 * 사용자가 읽는 화면에서는 한 번도 실려 나가지 않아야 「결과 화면에 무엇이 나가는가」에
 * 한 문장으로 답할 수 있다(ADR 0008).
 */
export async function readingArtifacts(target: ReadingTarget): Promise<ReadingArtifacts | null> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_reading_artifacts', argsOf(target));
  if (error) return null;

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (row === undefined) return null;

  return {
    evidence: row.evidence as string,
    prompt: row.prompt as string,
    promptVersion: row.prompt_version as string,
    generation: row.generation,
  };
}
