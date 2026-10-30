import { mySurveyOf, surveyContextOf, type MySurvey, type SurveyContext } from '@/src/lib/survey';

import { supabaseOnServer } from '../../auth/server-client';
import { dbFailure } from '../../db-error';

/**
 * 서비스 설문이 **브라우저로 내려오는 문.**
 *
 * 여기서 아무것도 판정하지 않는다. **어느 문항이 서는가**는 DB 가 답하고
 * (`service_survey_context`), 화면은 그 값을 읽는다. 화면이 스스로 세면 저장하는 자리와
 * 그리는 자리가 다른 조건을 쓰게 되고, 그때 「안 물어본 문항의 답」이 저장된다.
 */

export type { MySurvey, SurveyContext };

type Row = Record<string, unknown>;

export async function surveyContext(): Promise<SurveyContext | null> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('service_survey_context');
  if (error) throw dbFailure(error, 'service_survey_context');

  const row = ((data ?? []) as Row[])[0];
  return row === undefined ? null : surveyContextOf(row);
}

/**
 * 내가 남긴 것 — **초안도 내려온다.**
 *
 * 「답했는가」만 받으면 고치는 화면이 빈 칸으로 열리고, 거기서 다시 보내면 적어 두었던
 * 글이 지워진다. 풀이 설문이 이미 한 번 겪은 자리다.
 */
export async function mySurvey(): Promise<MySurvey | null> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_service_survey');
  /*
    **삼키면 초안이 지워진다.** 못 읽은 것을 「아직 안 썼다」로 내면 폼이 빈 칸으로 열리고,
    거기서 다시 보내면 적어 두었던 글이 덮인다 — 풀이 설문이 이미 한 번 겪은 자리다.
  */
  if (error) throw dbFailure(error, 'my_service_survey');

  const row = ((data ?? []) as Row[])[0];
  return row === undefined ? null : mySurveyOf(row);
}
