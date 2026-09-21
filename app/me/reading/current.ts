import { READING_KINDS, type ReadingAnswer } from '@/src/lib/reading';
import { readingBody, readingGrounding } from '@/src/lib/reading/display';

import { supabaseOnServer } from '../../auth/server-client';
import { readingTargetArgs, type ReadingTarget } from './target';
import { rpcArgs } from '@/src/lib/db';
import { readReadingCredits, type ReadingCredits } from './credits';
import { dbFailure, read, unread, type SkippableRead } from '../../db-error';

/**
 * **현재 결과가 브라우저로 내려가는 문.**
 *
 * 화면을 여는 것은 저장된 값을 읽는 일이고 **AI 를 부르지 않는다**(ADR 0001).
 * 그 규율이 코드 모양으로도 참이도록, 읽는 자리(여기)와 만드는 자리(`pipeline.ts`)를
 * 갈라 둔다 — 한 함수가 「없으면 만든다」를 하면 조회만으로 비용과 결과가 달라진다.
 *
 * 근거와 프롬프트는 여기서 안 나간다. 그 둘은 내부 테스트 화면의 것이고 문이 따로다.
 */

export type CurrentReading = {
  readonly id: string;
  /** 궁합만. 자기 풀이는 `null` */
  readonly score: number | null;
  /**
   * 점수 아래 서는 한 줄 요약 — **이 열이 생기기 전 글에는 없다(`null`).**
   *
   * 되짚어 지어 넣지 않았다. 그때 나온 글이 아니고, 지어 넣으면 어느 것이 모델이 쓴
   * 것인지 갈린다. 자기 풀이에는 점수가 없어도 이것은 있다.
   */
  readonly metaphor: string | null;
  /** 사용자용 Markdown — 저장된 원문의 내부 검토용 근거 절은 서버 경계에서 뺀다 */
  readonly output: string;
  readonly model: string;
  readonly viewedAt: string;
  readonly createdAt: string;
  /** 공유 결과의 글이 「첫 번째 분」이라 부르는 것이 나인가 */
  readonly viewerIsFirst: boolean;
  /**
   * 이 글의 **여덟 글자**가 아직 지금 명식인가 — `match` 는 언제나 참이다.
   *
   * **판본이 아니라 여덟 글자로 견준다**(ADR 0071). 출생지를 서울에서 부산으로 고치면
   * 새 판본이 서지만 여덟 글자는 그대로일 수 있고, 그때 화면이 하려는 말은
   * 「이전 명식」이지 「이전 입력」이 아니다 — 앞서는 그 자리에서 한쪽으로 거짓말했다.
   *
   * 견주는 일은 계속 SQL 이 한다. 화면이 재면 판정하는 자리가 둘이 된다(ADR 0033).
   */
  readonly fromCurrentChart: boolean;
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

const RUN_STATUSES = ['running', 'succeeded', 'failed'] as const;

export type LastRun = {
  readonly status: (typeof RUN_STATUSES)[number];
  readonly failureCode: string | null;
  readonly createdAt: string;
};

/** @returns 아직 만들지 않았거나 못 보는 대상이면 `null` — 둘을 가르지 않는다 */
export async function currentReading(target: ReadingTarget): Promise<CurrentReading | null> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_reading', rpcArgs<'my_reading'>(readingTargetArgs(target)));
  if (error) throw dbFailure(error, 'my_reading');

  const row = (data ?? [])[0];
  if (row === undefined) return null;

  return {
    id: row.id,
    score: row.score ?? null,
    metaphor: row.metaphor ?? null,
    output: readingBody(row.output),
    model: row.model,
    viewedAt: row.viewed_at,
    createdAt: row.created_at,
    viewerIsFirst: row.viewer_is_first,
    fromCurrentChart: row.from_current_chart,
    sourceRunId: row.source_run_id ?? null,
    /* 이 칸만 `jsonb` 라 생성 타입이 `Json` 까지만 말한다 — 모양을 여기서 한 번 주장한다 */
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
export async function improvementConsented(): Promise<SkippableRead<boolean>> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase
    .from('app_user')
    .select('improvement_consent')
    .maybeSingle();

  /*
    **못 읽은 것을 「거절했다」로 내지 않는다**(ADR 0078). 앞서는 조회 실패와 실제 거절이
    같은 `false` 였고, 그래서 설문이 닫힌 화면이 두 가지 뜻을 가졌다.
  */
  if (error) return unread(error, 'app_user.improvement_consent');
  return read(data?.improvement_consent === true);
}

export type { ReadingCredits };

/**
 * 내게 남은 풀이권 — **서버 쪽 입구일 뿐이다.**
 *
 * 읽는 일도 도메인의 말로 옮기는 일도 `credits.ts` 가 한다. 헤더는 같은 문을 브라우저
 * client 로 부른다 — 한 값을 두 자리에서 따로 읽던 것을 그렇게 합쳤다(ADR 0078).
 */
export async function readingCredits(): Promise<SkippableRead<ReadingCredits | null>> {
  return readReadingCredits(await supabaseOnServer());
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

  const { data, error } = await supabase.rpc('my_last_reading_run', rpcArgs<'my_last_reading_run'>(readingTargetArgs(target)));
  if (error) throw dbFailure(error, 'my_last_reading_run');

  const row = (data ?? [])[0];
  if (row === undefined) return null;

  const status = RUN_STATUSES.find((known) => known === row.status);
  /* 모르는 상태는 없는 것과 같다 — 화면이 「알 수 없음」으로 버튼을 정할 수는 없다 */
  if (status === undefined) return null;

  return {
    status,
    failureCode: row.failure_code ?? null,
    createdAt: row.created_at,
  };
}

/**
 * 내가 만든 글 하나 — **결과가 아니라 결과로 가는 길이다.**
 *
 * kind 넷을 다 든다. 본문도 근거도 없다 — 목록에 본문을 실으면 그 목록이 곧 두 번째
 * 결과 화면이 된다(ADR 0008·0033).
 */
export type ReadingEntry = {
  readonly kind: ReadingTarget['kind'];
  /** `match` 는 `null` — 가는 길이 `matchId` 다 */
  readonly personA: string | null;
  readonly personB: string | null;
  readonly matchId: string | null;
  /** `self` 는 `null` — 대상이 나라서 부를 이름이 없다 */
  readonly labelA: string | null;
  readonly labelB: string | null;
  readonly score: number | null;
  readonly metaphor: string | null;
  readonly createdAt: string;
  /** 그 글의 여덟 글자가 아직 지금 명식인가(ADR 0071) */
  readonly fromCurrentChart: boolean;
};

/**
 * 내가 만든 글 전부 — **최근 것이 앞이다.**
 *
 * 차례도 좁힘도 DB 가 정한다(`my_readings`). 여기서 다시 정렬하거나 걸러내면 판정하는
 * 자리가 둘이 되고, 둘이 갈리는 날 화면이 DB 보다 넓거나 좁아진다.

 */
export async function myReadings(): Promise<readonly ReadingEntry[]> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_readings');
  if (error) throw dbFailure(error, 'my_readings');

  return (data ?? []).flatMap((row) => {
    /* 모르는 kind 는 그리지 않는다 — DB 의 `text` 를 화면의 네 갈래로 좁히는 자리다 */
    const kind = READING_KINDS.find((known) => known === row.kind);
    if (kind === undefined) return [];

    return [
      {
        kind,
        personA: row.person_a ?? null,
        personB: row.person_b ?? null,
        matchId: row.match_id ?? null,
        labelA: row.label_a ?? null,
        labelB: row.label_b ?? null,
        score: row.score ?? null,
        metaphor: row.metaphor ?? null,
        createdAt: row.created_at,
        fromCurrentChart: row.from_current_chart,
      },
    ];
  });
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

  /**
   * **인연 궁합만 문이 다르다**(ADR 0069). 그 글의 근거 절은 상대 자료를 인용할 수 있어
   * `my_reading` 이 이제 본문만 내준다. 원문은 운영자이면서 당사자일 때만 나오는 문에서
   * 읽는다 — 화면이 「운영자인가」를 여기서 묻지 않는 것이 요점이다. 물으면 판정하는 자리가
   * 둘이 되고, 둘은 언젠가 어긋난다.
   */
  if (target.kind === 'match') {
    const { data, error } = await supabase.rpc('match_reading_source', {
      p_match_id: target.matchId,
    });
    if (error) throw dbFailure(error, 'match_reading_source');

    const row = (data ?? [])[0];
    return row === undefined ? null : readingGrounding(row.output);
  }

  const { data, error } = await supabase.rpc('my_reading', rpcArgs<'my_reading'>(readingTargetArgs(target)));
  if (error) throw dbFailure(error, 'my_reading');

  const row = (data ?? [])[0];
  return row === undefined ? null : readingGrounding(row.output);
}

export async function readingArtifacts(target: ReadingTarget): Promise<ReadingArtifacts | null> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_reading_artifacts', rpcArgs<'my_reading_artifacts'>(readingTargetArgs(target)));
  if (error) throw dbFailure(error, 'my_reading_artifacts');

  const row = (data ?? [])[0];
  if (row === undefined) return null;

  return {
    evidence: row.evidence,
    prompt: row.prompt,
    promptVersion: row.prompt_version,
    generation: row.generation,
  };
}
