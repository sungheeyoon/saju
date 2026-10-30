import { surveyOf, type OperatorSurvey } from '@/src/lib/ops/survey';

import { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';
import { deniedAmong, type Denied } from '../denial';

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
 *
 * **문이 읽을 때마다 DB 가 접속기록에 한 줄을 적는다**(ADR 0105 추기 2026-10-01) — 성공은 일곱 문 안에서 문마다, 거절은
 * 아래에서 `deniedAmong` 이 머리 문의 이름(`survey.overview`) 한 줄로. 기록에는 설문 답 · 글이 안 들어간다.
 */

export { DENIED } from '../denial';
export type {
  CommentRow,
  ServiceCount,
  ServiceOverview,
  ServiceText,
  SurveyOverview,
  TagRow,
  VersionRow,
} from '@/src/lib/ops/survey';

/**
 * 일곱을 함께 청한다 — **하나라도 거절당하면 거절이다.**
 *
 * 일곱이 같은 문(`is_operator`)을 지나므로 갈릴 일이 없지만, 갈리는 날 화면이 반쪽만
 * 그리는 것보다 아무것도 안 그리는 편이 낫다.
 *
 * 못 읽으면 다른 운영 화면처럼 `unread` 로 내고 원문은 기록에 간다 — 화면은 그 자리에 실패 줄을 세운다. 집계 함수는
 * 늘 한 줄을 내므로, 성공했는데 한 줄이 없는 것은 계약이 깨진 것이라 던진다(`app/ops/today/read.ts` 와 같다).
 *
 * @returns 거절이면 `DENIED`.
 */
export async function operatorSurvey(): Promise<Denied | SkippableRead<OperatorSurvey>> {
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
  const denied = await deniedAmong(supabase, 'survey.overview', asked);
  if (denied) return denied;
  const failed = asked.find((answer) => answer.error !== null)?.error;
  if (failed) return unread(failed, 'operator_survey');

  const survey = surveyOf({
    overview: overview.data,
    versions: versions.data,
    tags: tags.data,
    comments: comments.data,
    service: service.data,
    serviceCounts: serviceCounts.data,
    serviceTexts: serviceTexts.data,
  });
  if (survey === null) {
    throw new Error('operator_survey_overview · operator_service_survey_overview: 집계 한 줄이 없다');
  }
  return read(survey);
}
