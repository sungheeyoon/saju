import type { ReadingAnswer } from '@/src/lib/reading';
import { readingBody, readingGrounding } from '@/src/lib/reading/display';

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
  /** 사용자용 Markdown — 저장된 원문의 내부 검토용 근거 절은 서버 경계에서 뺀다 */
  readonly output: string;
  readonly model: string;
  readonly viewedAt: string;
  readonly createdAt: string;
  /** 공유 결과의 글이 「첫 번째 분」이라 부르는 것이 나인가 */
  readonly viewerIsFirst: boolean;
  /** 이 글을 만든 판본이 아직 지금 판본인가 — `match` 는 언제나 참이다 */
  readonly fromCurrentRevision: boolean;
  /**
   * 이 글을 만든 시도 — **설문이 매달릴 자리.**
   *
   * `null` 인 글이 있다. 이 값이 생기기 전에 저장된 것들이고, 어느 시도가 만들었는지를
   * 되짚어 지어 넣지 않았다 — 그것은 기록이 아니라 추측이다. 그 글에는 설문이 안 붙는다.
   */
  readonly sourceRunId: string | null;
  /**
   * 그 시도에 **내가** 남긴 답 — 안 남겼으면 `null`.
   *
   * 「답했는가」가 아니라 답 자체를 든다. 고치는 화면이 이 값으로 열려야 하고, 안
   * 그러면 다시 보내는 것이 적어 두었던 글을 지운다. 공유 궁합은 두 사람이 따로 답하므로
   * 이것은 **보고 있는 사람의 답**이다.
   */
  readonly myFeedback: ReadingAnswer | null;
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
    output: readingBody(row.output as string),
    model: row.model as string,
    viewedAt: row.viewed_at as string,
    createdAt: row.created_at as string,
    viewerIsFirst: row.viewer_is_first as boolean,
    fromCurrentRevision: row.from_current_revision as boolean,
    sourceRunId: (row.source_run_id as string | null) ?? null,
    myFeedback: (row.my_feedback as ReadingAnswer | null) ?? null,
  };
}

/**
 * 개선 활용에 동의했는가 — **설문 전체를 여는 값.**
 *
 * `null` 은 「아직 안 물었다」이고 `false` 는 「거절했다」다. 화면이 여는 조건은 둘 다
 * 아닌 `true` 하나뿐이라 여기서 좁혀 내보낸다 — 호출부가 `?? false` 를 손으로 적게
 * 두면 한 자리가 그것을 잊는다.
 *
 * **사주 서비스는 이 값을 묻지 않는다.** 명식도 궁합도 풀이 생성도 그대로 돌고, 닫히는
 * 것은 설문 하나뿐이다. 거절이 서비스를 좁히면 그것은 유효한 동의가 아니다.
 */
export async function improvementConsented(): Promise<boolean> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase
    .from('app_user')
    .select('improvement_consent')
    .maybeSingle();

  if (error || data === null) return false;
  return data.improvement_consent === true;
}

export type ReadingCredits = {
  readonly limit: number;
  readonly used: number;
  /** 지금 만들고 있는 것이 잡고 있는 자리 — 화면이 그 이유를 말할 수 있게 따로 든다 */
  readonly reserved: number;
  readonly available: number;
};

/**
 * 내게 남은 풀이권.
 *
 * **빼기는 DB 가 한다.** 여기서 `limit - used` 를 계산하면 `reserved` 를 잊은 화면이
 * 생기고, 두 자리가 서로 다른 숫자를 말한다.
 *
 * @returns 못 물으면 `null` — 잔액을 모르면 화면은 그 줄을 아예 안 세운다. 「알 수
 * 없음」을 세우는 것보다 낫다: 있지도 않은 숫자를 사용자가 세어 보게 된다.
 */
export async function readingCredits(): Promise<ReadingCredits | null> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_reading_credits');
  if (error) return null;

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (row === undefined) return null;

  return {
    limit: row.credit_limit as number,
    used: row.used as number,
    reserved: row.reserved as number,
    available: row.available as number,
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

/**
 * 내가 본 비공개 궁합 하나 — **결과가 아니라 결과로 가는 길이다.**
 *
 * 본문도 근거도 없다. 목록에 본문을 실으면 그 목록이 곧 두 번째 결과 화면이 되고,
 * 「결과 화면에 무엇이 나가는가」의 답이 둘이 된다(ADR 0008).
 */
export type PrivateReadingEntry = {
  readonly personA: string;
  readonly personB: string;
  readonly labelA: string;
  readonly labelB: string;
  readonly score: number | null;
  readonly createdAt: string;
  readonly fromCurrentRevision: boolean;
};

/**
 * 내가 본 비공개 궁합들 — **최근 것이 앞이다.**
 *
 * 차례도 좁힘도 DB 가 정한다(`my_private_readings`). 여기서 다시 정렬하거나 걸러내면
 * 판정하는 자리가 둘이 되고, 둘이 갈리는 날 화면이 DB 보다 넓거나 좁아진다.
 */
export async function myPrivateReadings(): Promise<readonly PrivateReadingEntry[]> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_private_readings');
  if (error) return [];

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    personA: row.person_a as string,
    personB: row.person_b as string,
    labelA: row.label_a as string,
    labelB: row.label_b as string,
    score: (row.score as number | null) ?? null,
    createdAt: row.created_at as string,
    fromCurrentRevision: row.from_current_revision as boolean,
  }));
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
/**
 * 절마다 **어디서 온 말인가** — 내부 화면만 읽는다.
 *
 * `currentReading` 은 서버 경계에서 이 절을 잘라 낸다(`readingBody`). 그 규율은 그대로
 * 두고, 되짚는 자리에서만 잘린 쪽을 따로 읽는다 — 한 함수가 두 벌을 다 내주면 언젠가
 * 사용자 화면이 그 값을 세운다.
 */
export async function readingGroundingOf(target: ReadingTarget): Promise<string | null> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_reading', argsOf(target));
  if (error) return null;

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  return row === undefined ? null : readingGrounding(row.output as string);
}

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
