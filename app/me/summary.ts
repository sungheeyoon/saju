import { elementSummaryOf, type ElementSummary } from '@/src/lib/matching/elementAxes';

import { supabaseOnServer } from '../auth/server-client';
import { storedChartOf } from '@/src/lib/input/stored';
import { storedInputOf } from './person-input';

/**
 * 매칭 풀에 내놓을 **오행 요약**을 내 입력에서 만든다.
 *
 * 요약은 DB 가 못 만든다 — 절기·자시·경도 판정이 엔진에 있다. 그래서 앱이 만들어
 * 넣고, DB 는 **모양**을 본다(`is_element_summary`). 만드는 자리를 여기 하나로 두는
 * 것은, 참여를 켤 때와 입력을 고칠 때 서로 다른 값이 올라가는 일을 막으려는 것이다.
 *
 * 여기서 만드는 것은 언제나 **내 것**이다. 남의 요약을 앱이 만들 일은 없다 — 후보의
 * 요약은 각자가 참여할 때 내놓은 것이고, 우리는 그것을 읽지도 않는다(DB 안에서
 * 두 축으로 바뀌어 나온다).
 */
export type SelfSummary = { personId: string; summary: ElementSummary };

/**
 * 지금 저장된 내 입력에서 요약 한 벌.
 *
 * @returns selfPerson 이 없거나 입력을 못 읽으면 `null`. 못 읽는 입력을 기본값으로
 *   메우지 않는다 — 그러면 내가 저장한 적 없는 사주가 매칭 풀에 올라간다.
 *
 * **계산 오류는 안 삼킨다.** 앞서는 맨 `catch` 가 명식 계산까지 함께 감쌌고, 그래서
 * 엔진이 터져도 조용히 `null` 이 났다 — 사용자는 자기가 매칭 풀에서 빠진 줄 모르고,
 * 그 사실은 어디에도 안 남는다. 못 읽는 입력만 `null` 이고 그 밖은 던진다.
 */
export async function selfElementSummary(): Promise<SelfSummary | null> {
  const supabase = await supabaseOnServer();

  const { data: account } = await supabase.from('app_user').select('self_person_id').maybeSingle();
  if (!account?.self_person_id) return null;

  const personId = account.self_person_id;

  const [person, { data: edge }] = await Promise.all([
    storedInputOf(supabase, personId),
    supabase.from('user_person_access').select('local_label').eq('person_id', personId).maybeSingle(),
  ]);
  if (person === null || !edge) return null;

  const stood = storedChartOf(person.input, edge.local_label);
  // 못 읽는 입력이면 요약도 없다. 부르는 쪽이 「참여할 수 없다」고 말한다.
  if (!stood.ok) return null;

  return {
    personId,
    // 익명 화면·저장된 화면과 **같은 함수**로 계산한다. 여기서 따로 세면 후보 목록의
    // 오행과 내 명식의 오행이 갈릴 수 있다.
    summary: elementSummaryOf(stood.saju.analysis.elements),
  };
}
