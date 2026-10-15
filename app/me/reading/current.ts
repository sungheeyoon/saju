import {
  READING_KINDS,
  RUN_STATUSES,
  type CurrentReading,
  type LastRun,
  type ReadingAnswer,
  type ReadingEntry,
} from '@/src/lib/reading';
import { STEMS, type Stem } from '@/src/lib/saju';
import {
  hasSeatName,
  listedPairSummary,
  readingBody,
  readingGrounding,
  seatNicknamesOf,
  viewerIsFirstOf,
} from '@/src/lib/reading/display';

import { supabaseOnServer } from '../../auth/server-client';
import { readingTargetArgs, type ReadingTarget } from './target';
import { rpcArgs } from '@/src/lib/db';
import { dbFailure, read, recordDbFailure, unread, type SkippableRead } from '../../db-error';
import { readAccount } from '../account';

/**
 * **현재 결과가 브라우저로 내려가는 문.**
 *
 * 화면을 여는 것은 저장된 값을 읽는 일이고 **AI 를 부르지 않는다**(ADR 0001).
 * 그 규율이 코드 모양으로도 참이도록, 읽는 자리(여기)와 만드는 자리(`pipeline.ts`)를
 * 갈라 둔다 — 한 함수가 「없으면 만든다」를 하면 조회만으로 비용과 결과가 달라진다.
 *
 * 근거와 프롬프트는 여기서 안 나간다. 그 둘은 내부 테스트 화면의 것이고 문이 따로다.
 */

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
    dayMasterA: stemOf(row.day_master_a),
    dayMasterB: stemOf(row.day_master_b),
    scoreScale: {
      baseline: row.score_baseline ?? null,
      version: row.score_version ?? null,
      relation: row.score_relation ?? null,
    },
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

/**
 * 마지막 시도가 어떻게 됐나.
 *
 * 생성은 누름과 같은 왕복이 아니라 `after` 로 떨어지므로, 실패하면 알림함에
 * `reading_failed` 가 선다(`fail_reading_job`, `20260831090000_reading_failure_is_told.sql`).
 * 그 대상의 화면으로 다시 들어온 사람에게도 — 다른 기기에서 열었거나 새로고침한 뒤에도 —
 * 「지난번에 실패했다」를 말할 수 있어야 해서, 그 근거를 이 값이 든다(US 56).
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
    /*
      앱이 DB 보다 먼저 나가면 세 칸이 안 온다 — 그때도 「진행을 모른다」로 읽힌다(0절 · 본문 전). 지어 넣지 않는다.
    */
    progress:
      status === 'running'
        ? {
            jobStatus: row.job_status ?? null,
            sectionsBegun: row.sections_begun ?? 0,
            bodyWritten: row.body_written ?? false,
          }
        : null,
  };
}

/**
 * 천간 열 중 하나가 아니면 `null`.
 *
 * **칸이 없어도 `null` 이다.** 앱이 DB 보다 먼저 배포되면 옛 문은 두 칸을 안 준다 — 그때 표지는
 * 회색으로 서고 나머지는 그대로 돈다.
 */
const stemOf = (value: string | null | undefined): Stem | null => STEMS.find((stem) => stem === value) ?? null;

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

  const rows = data ?? [];
  /* 인연 궁합의 요약에 호칭이 있을 때만 내가 어느 자리인지 읽는다 — 없으면 왕복을 안 늘린다 */
  const viewer = rows.some((row) => row.kind === 'match' && row.metaphor != null && hasSeatName(row.metaphor))
    ? await matchViewerOf(supabase)
    : null;

  return rows.flatMap((row) => {
    /* 모르는 kind 는 그리지 않는다 — DB 의 `text` 를 화면의 네 갈래로 좁히는 자리다 */
    const kind = READING_KINDS.find((known) => known === row.kind);
    if (kind === undefined) return [];

    /*
      **한 줄 요약도 모델 글이다**(ADR 0181) — 자리 호칭을 지금의 닉네임으로 바꾼다. 내 궁합은 두 이름표가 `charts.a` ·
      `charts.b` 차례로 온다(`person_a` 가 작은 쪽). 인연 궁합은 이 문이 상대 닉네임만 주므로 내 닉네임 · 내 자리를
      `matchViewerOf` 로 맞춘다. 못 맞추면 호칭이 남은 요약은 세우지 않는다(`listedPairSummary`).
    */
    const labelA = row.label_a ?? null;
    const labelB = row.label_b ?? null;
    const summary = row.metaphor ?? null;
    const partnerUserId = row.match_id == null ? undefined : viewer?.partners.get(row.match_id);
    const metaphor =
      kind === 'private'
        ? listedPairSummary(summary, labelA !== null && labelB !== null ? { first: labelA, second: labelB } : null)
        : kind === 'match'
          ? listedPairSummary(
              summary,
              viewer !== null && partnerUserId !== undefined && labelA !== null
                ? seatNicknamesOf(
                    { viewer: viewer.nickname, partner: labelA },
                    viewerIsFirstOf(viewer.userId, partnerUserId),
                  )
                : null,
            )
          : summary;

    return [
      {
        kind,
        personA: row.person_a ?? null,
        personB: row.person_b ?? null,
        matchId: row.match_id ?? null,
        labelA,
        labelB,
        score: row.score ?? null,
        metaphor,
        createdAt: row.created_at,
        fromCurrentChart: row.from_current_chart,
        dayMasterA: stemOf(row.day_master_a),
        dayMasterB: stemOf(row.day_master_b),
      },
    ];
  });
}

/**
 * 인연 궁합 요약의 호칭을 바꿀 재료 — 내 계정 id · 닉네임과 Match 마다의 상대 계정 id.
 *
 * `my_readings` 는 내가 어느 자리인지를 안 준다. 마이그레이션 없이 이미 있는 두 읽기로 맞춘다 — 내 행(`app_user`,
 * 정책이 내 것만 준다)과 `my_matches`(같은 `visible_matches()` 위에 선다). **어느 하나라도 못 읽으면 `null`** — 목록은
 * 그대로 서고, 호칭이 남은 요약만 안 선다(부속 정보, ADR 0078).
 */
async function matchViewerOf(
  supabase: Awaited<ReturnType<typeof supabaseOnServer>>,
): Promise<{ userId: string; nickname: string; partners: ReadonlyMap<string, string> } | null> {
  const [account, matches] = await Promise.all([
    readAccount(supabase, ['status', 'id', 'nickname']),
    supabase.rpc('my_matches'),
  ]);
  if (matches.error) {
    recordDbFailure(matches.error, 'my_matches');
    return null;
  }
  const row = account.row;
  if (row === null || row.nickname === null) return null;

  return {
    userId: row.id,
    nickname: row.nickname,
    partners: new Map((matches.data ?? []).map((match) => [match.match_id, match.partner_user_id])),
  };
}

type ReadingArtifacts = {
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
