import type { FeltLength, IssueTag } from '../reading/feedback';

/** 설문 집계를 화면의 값으로 옮긴다 — 세는 것은 DB 의 `operator_survey_*` 다. 웹과 앱이 함께 쓴다 */
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

/** 일곱 문의 답. 집계 함수는 늘 한 줄을 내므로 한 줄이 없으면 `null` — 계약이 깨진 것이다 */
export function surveyOf(answers: { readonly [K in keyof OperatorSurvey]: unknown }): OperatorSurvey | null {
  const counts = ((answers.overview ?? []) as Row[])[0];
  const said = ((answers.service ?? []) as Row[])[0];
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
    versions: ((answers.versions ?? []) as Row[]).map((row) => ({
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
    tags: ((answers.tags ?? []) as Row[]).map((row) => ({
      promptVersion: (row.prompt_version as string | null) ?? null,
      tag: row.tag as IssueTag,
      answers: Number(row.answers),
    })),
    comments: ((answers.comments ?? []) as Row[]).map((row) => ({
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
    serviceCounts: ((answers.serviceCounts ?? []) as Row[]).map((row) => ({
      question: row.question as string,
      choice: row.choice as string,
      answers: Number(row.answers),
    })),
    serviceTexts: ((answers.serviceTexts ?? []) as Row[]).map((row) => ({
      improveText: (row.improve_text as string | null) ?? null,
      freeText: (row.free_text as string | null) ?? null,
      priceSolo: (row.price_solo as string | null) ?? null,
      pricePair: (row.price_pair as string | null) ?? null,
      submittedAt: row.submitted_at as string,
    })),
  };
}

/** 답한 날 — 서울 날짜 */
export const surveyDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' });
