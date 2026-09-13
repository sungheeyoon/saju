import type { FeltLength, IssueTag } from '@/src/lib/reading';

import { supabaseOnServer } from '../../auth/server-client';

/**
 * 설문 집계가 **브라우저로 내려오는 문.**
 *
 * 여기서 아무것도 세지 않는다. 세는 것은 네 함수의 일이고(`operator_survey_*`), 이
 * 파일은 그 값을 타입으로 받아 적기만 한다 — 화면이 다시 세면 그 수와 SQL 의 수가
 * 갈리고, 그때 어느 쪽이 맞는지 아무도 모른다.
 *
 * **운영자인지도 여기서 안 묻는다.** 묻는 자리는 DB 하나다(`is_operator`). 화면이 먼저
 * 물어보고 열고 닫으면 판정하는 자리가 둘이 되므로, 그냥 자료를 청하고 **거절당하는
 * 것으로 안다.**
 */

/** 운영자가 아니라고 DB 가 답했다 — `42501` */
export const DENIED = 'denied';

export type SurveyOverview = {
  /** 들어온 답 */
  readonly answers: number;
  /** 답한 사람 */
  readonly respondents: number;
  /** 답이 달린 시도 */
  readonly answeredRuns: number;
  /** 완성된 풀이 — **답 ÷ 이 수는 응답률이 아니다.** 동의하지 않은 사람의 것이 섞여 있다 */
  readonly succeededRuns: number;
  readonly consented: number;
  readonly declined: number;
  /** 아직 안 물어본 사람 — 거절과 다르다 */
  readonly unasked: number;
};

export type VersionRow = {
  readonly promptVersion: string | null;
  readonly model: string | null;
  readonly kind: string;
  readonly answers: number;
  readonly usefulness: number;
  readonly perceivedFit: number;
  readonly felt: Record<FeltLength, number>;
};

export type TagRow = {
  readonly promptVersion: string | null;
  readonly tag: IssueTag;
  readonly answers: number;
};

export type CommentRow = {
  readonly promptVersion: string | null;
  readonly kind: string;
  readonly usefulness: number;
  readonly perceivedFit: number;
  readonly feltLength: FeltLength;
  readonly issueTags: readonly IssueTag[];
  readonly comment: string;
  readonly submittedAt: string;
};

/** 서비스 설문 — **제출한 것만 센다.** 초안은 함수가 이미 빼고 내려준다 */
export type ServiceOverview = {
  readonly submitted: number;
  readonly drafts: number;
  readonly pricedSolo: number;
  readonly pricedPair: number;
  readonly updated: number;
};

export type ServiceCount = {
  readonly question: string;
  readonly choice: string;
  readonly answers: number;
};

export type ServiceText = {
  readonly improveText: string | null;
  readonly freeText: string | null;
  readonly priceSolo: string | null;
  readonly pricePair: string | null;
  readonly submittedAt: string;
};

export type OperatorSurvey = {
  readonly overview: SurveyOverview;
  readonly versions: readonly VersionRow[];
  readonly tags: readonly TagRow[];
  readonly comments: readonly CommentRow[];
  readonly service: ServiceOverview;
  readonly serviceCounts: readonly ServiceCount[];
  readonly serviceTexts: readonly ServiceText[];
};

type Row = Record<string, unknown>;

/**
 * 일곱을 함께 청한다 — **하나라도 거절당하면 거절이다.**
 *
 * 일곱이 같은 문(`is_operator`)을 지나므로 갈릴 일이 없지만, 갈리는 날 화면이 반쪽만
 * 그리는 것보다 아무것도 안 그리는 편이 낫다.
 *
 * @returns 거절이면 `DENIED`, 못 읽었으면 `null`.
 */
export async function operatorSurvey(): Promise<OperatorSurvey | typeof DENIED | null> {
  const supabase = await supabaseOnServer();

  const [overview, versions, tags, comments, service, serviceCounts, serviceTexts] =
    await Promise.all([
      supabase.rpc('operator_survey_overview'),
      supabase.rpc('operator_survey_by_version'),
      supabase.rpc('operator_survey_tags'),
      supabase.rpc('operator_survey_comments'),
      supabase.rpc('operator_service_survey_overview'),
      supabase.rpc('operator_service_survey_counts'),
      supabase.rpc('operator_service_survey_texts'),
    ]);

  const asked = [overview, versions, tags, comments, service, serviceCounts, serviceTexts];
  if (asked.some((answer) => answer.error?.code === '42501')) return DENIED;
  if (asked.some((answer) => answer.error !== null)) return null;

  const counts = ((overview.data ?? []) as Row[])[0];
  const said = ((service.data ?? []) as Row[])[0];
  if (counts === undefined || said === undefined) return null;

  return {
    overview: {
      answers: Number(counts.answers),
      respondents: Number(counts.respondents),
      answeredRuns: Number(counts.answered_runs),
      succeededRuns: Number(counts.succeeded_runs),
      consented: Number(counts.consented),
      declined: Number(counts.declined),
      unasked: Number(counts.unasked),
    },
    versions: ((versions.data ?? []) as Row[]).map((row) => ({
      promptVersion: (row.prompt_version as string | null) ?? null,
      model: (row.model as string | null) ?? null,
      kind: row.kind as string,
      answers: Number(row.answers),
      usefulness: Number(row.usefulness),
      perceivedFit: Number(row.perceived_fit),
      felt: {
        short: Number(row.felt_short),
        right: Number(row.felt_right),
        long: Number(row.felt_long),
      },
    })),
    tags: ((tags.data ?? []) as Row[]).map((row) => ({
      promptVersion: (row.prompt_version as string | null) ?? null,
      tag: row.tag as IssueTag,
      answers: Number(row.answers),
    })),
    comments: ((comments.data ?? []) as Row[]).map((row) => ({
      promptVersion: (row.prompt_version as string | null) ?? null,
      kind: row.kind as string,
      usefulness: Number(row.usefulness),
      perceivedFit: Number(row.perceived_fit),
      feltLength: row.felt_length as FeltLength,
      issueTags: (row.issue_tags as IssueTag[] | null) ?? [],
      comment: row.comment as string,
      submittedAt: row.submitted_at as string,
    })),
    service: {
      submitted: Number(said.submitted),
      drafts: Number(said.drafts),
      pricedSolo: Number(said.priced_solo),
      pricedPair: Number(said.priced_pair),
      updated: Number(said.updated),
    },
    serviceCounts: ((serviceCounts.data ?? []) as Row[]).map((row) => ({
      question: row.question as string,
      choice: row.choice as string,
      answers: Number(row.answers),
    })),
    serviceTexts: ((serviceTexts.data ?? []) as Row[]).map((row) => ({
      improveText: (row.improve_text as string | null) ?? null,
      freeText: (row.free_text as string | null) ?? null,
      priceSolo: (row.price_solo as string | null) ?? null,
      pricePair: (row.price_pair as string | null) ?? null,
      submittedAt: row.submitted_at as string,
    })),
  };
}
