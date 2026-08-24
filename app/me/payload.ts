import type { Saju } from '@/src/lib/saju';

import { supabaseOnServer } from '../auth/server-client';
import { chartOf } from '../chart';
import { queryFromRevision } from '../revision';

/**
 * **저장된 한 사람이 브라우저로 내려가는 유일한 문.**
 *
 * 묻지 않고 답만 낸다. 「어떤 종류의 payload 를 원하는가」를 인자로 받으면 호출부가
 * `'managed'` 라고 댈 수 있고, 언젠가 Match 자리에서도 그렇게 댄다(ADR 0007 「이행」).
 * 그래서 종류를 밖에 내놓지 않는다 — 접근 근거를 안에서 조회하고, 무엇을 자를지
 * 안에서 정하고, 허용된 payload 나 `null` 을 낸다.
 *
 * 4단계에는 자를 것이 없다. 근거는 「내가 등록하고 내가 입력한 사람이라서」가
 * **아니다** — claim 이 일어나면 등록한 사람도 `viewer` 로 내려간다. 정확한 근거는
 * **`user_person_access` 엣지가 있으면 RLS 가 이미 그 Person 의 판본 전체를 읽게
 * 해 준다**는 것이고(`"Person 이 보이면 그 판본도 보인다"` 정책은 역할을 묻지 않는다),
 * 그러므로 이 payload 는 사용자가 이미 조회할 수 있는 범위를 넓히지 않는다.
 *
 * 자를 것이 생기는 것은 Match 상대다(ADR 0008). 그때 갈라지는 것이 **호출부가 아니라
 * 이 함수 안**이도록 경계를 지금 세운다.
 *
 * 조회는 `supabaseOnServer()` 의 사용자 JWT 로 한다. 이 경로에는 `security definer`
 * 도 `service_role` 도 쓰지 않는다 — RLS 가 이미 답을 들고 있는데 definer 를 세우면
 * 판정하는 자리가 둘이 된다(ADR 0004).
 */

/**
 * 밖에서 지을 수 없는 증표.
 *
 * 이 심볼을 내보내지 않으므로 다른 모듈은 `PersonPayload` 를 **손으로 지을 수 없다.**
 * 판별자를 평범한 문자열로 두면 호출부가 똑같은 객체를 만들어 넘길 수 있고, 그러면
 * 종류를 인자에서 뺀 효과가 사라진다. 보장하는 것은 암호가 아니라 **모양**이다.
 */
const granted = Symbol('payloadForViewer');

export type PersonPayload = {
  readonly personId: string;
  /** 어느 판본을 봤는지 — 화면에 쓰지 않더라도 「무엇으로 계산했나」의 답이다 */
  readonly revisionId: string;
  /** 이 사용자가 그 사람을 부르는 이름(`user_person_access.local_label`) */
  readonly name: string;
  /** 이미 계산된 명식 — 계산 입력 자체는 이 모듈 밖으로 나가지 않는다 */
  readonly saju: Saju;
  readonly [granted]: true;
};

/** 주소로 들어온 값이라 모양부터 본다 — 형식이 틀린 것도 「없는 사람」과 같은 답이다 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @returns 볼 수 있으면 payload, **없거나 못 보면 `null`.**
 *
 * 두 경우를 가르지 않는 것이 요점이다. 「그런 사람 없습니다」와 「볼 수 없습니다」가
 * 갈리면 그 차이만으로 그 Person 이 실재하는지 알아낼 수 있다. RLS 는 「안 보인다」
 * 까지만 해 주므로 그다음 한 문장을 여기서 묶는다.
 *
 * @throws {UnreadableRevisionError} 볼 수는 있는데 지금 엔진이 그 판본을 못 읽을 때.
 *   못 읽는 판본을 기본값으로 메우면 저장할 때 본 사주와 다른 사주가 나온다.
 */
export async function payloadForViewer(personId: string): Promise<PersonPayload | null> {
  if (!UUID.test(personId)) return null;

  const supabase = await supabaseOnServer();

  /**
   * 정책이 자기 것만 내주므로 `user_id` 를 적지 않는다. 적으면 판정하는 자리가
   * 둘이 되고, 둘은 언젠가 어긋난다(ADR 0004).
   */
  const [{ data: person }, { data: edge }] = await Promise.all([
    supabase.from('person').select('current_revision_id').eq('id', personId).maybeSingle(),
    supabase.from('user_person_access').select('local_label').eq('person_id', personId).maybeSingle(),
  ]);

  /**
   * 현재 판본이 없는 Person 은 만들어질 수 없다 — Person·판본·엣지가 한 트랜잭션에
   * 들어가기 때문이다(`create_self_person` · `create_managed_person`). 그래도 그 상태가
   * 실재한다면 우리가 보여줄 수 있는 사람이 아니므로 같은 답으로 묶는다.
   */
  if (!person?.current_revision_id || !edge) return null;

  const { data: revision } = await supabase
    .from('person_chart_revision')
    .select('calendar, original_date, solar_date, birth_time, gender, city, late_night_rule, time_basis')
    .eq('id', person.current_revision_id)
    .maybeSingle();

  if (!revision) return null;

  const query = queryFromRevision(revision, edge.local_label);

  return {
    personId,
    revisionId: person.current_revision_id,
    name: query.name,
    // 서버가 계산한다. 익명 화면과 **같은 함수**라 저장하기 전에 본 사주와
    // 저장한 뒤에 보는 사주가 다를 자리가 없다.
    saju: chartOf(query),
    [granted]: true,
  };
}
