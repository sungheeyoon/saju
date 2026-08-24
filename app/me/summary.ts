import { elementSummaryOf, type ElementSummary } from '@/src/lib/matching/elementAxes';

import { supabaseOnServer } from '../auth/server-client';
import type { Query } from '../query';
import { chartOf } from '../chart';
import { queryFromRevision } from '../revision';

/**
 * 매칭 풀에 내놓을 **오행 요약**을 내 판본에서 만든다.
 *
 * 요약은 DB 가 못 만든다 — 절기·자시·경도 판정이 엔진에 있다. 그래서 앱이 만들어
 * 넣고, DB 는 **모양**을 본다(`is_element_summary`). 만드는 자리를 여기 하나로 두는
 * 것은, 참여를 켤 때와 판본을 고칠 때 서로 다른 값이 올라가는 일을 막으려는 것이다.
 *
 * 여기서 만드는 것은 언제나 **내 것**이다. 남의 요약을 앱이 만들 일은 없다 — 후보의
 * 요약은 각자가 참여할 때 내놓은 것이고, 우리는 그것을 읽지도 않는다(DB 안에서
 * 두 축으로 바뀌어 나온다).
 */
export function elementSummaryFrom(query: Query): ElementSummary {
  // 익명 화면·저장된 화면과 **같은 함수**로 계산한다. 여기서 따로 세면 후보 목록의
  // 오행과 내 명식의 오행이 갈릴 수 있다.
  return elementSummaryOf(chartOf(query).analysis.elements);
}

export type SelfSummary = { personId: string; summary: ElementSummary };

/**
 * 지금 저장된 내 판본에서 요약 한 벌.
 *
 * @returns selfPerson 이 없거나 판본을 못 읽으면 `null`. 못 읽는 판본을 기본값으로
 *   메우지 않는다 — 그러면 내가 저장한 적 없는 사주가 매칭 풀에 올라간다.
 */
export async function selfElementSummary(): Promise<SelfSummary | null> {
  const supabase = await supabaseOnServer();

  const { data: account } = await supabase.from('app_user').select('self_person_id').maybeSingle();
  if (!account?.self_person_id) return null;

  const personId = account.self_person_id;

  const [{ data: person }, { data: edge }] = await Promise.all([
    supabase.from('person').select('current_revision_id').eq('id', personId).maybeSingle(),
    supabase.from('user_person_access').select('local_label').eq('person_id', personId).maybeSingle(),
  ]);
  if (!person?.current_revision_id || !edge) return null;

  const { data: revision } = await supabase
    .from('person_chart_revision')
    .select('calendar, original_date, solar_date, birth_time, gender, city, late_night_rule, time_basis')
    .eq('id', person.current_revision_id)
    .maybeSingle();
  if (!revision) return null;

  try {
    return { personId, summary: elementSummaryFrom(queryFromRevision(revision, edge.local_label)) };
  } catch {
    // 못 읽는 판본이면 요약도 없다. 부르는 쪽이 「참여할 수 없다」고 말한다.
    return null;
  }
}
