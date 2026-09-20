import type { Saju } from '@/src/lib/saju';

import { supabaseOnServer } from '../auth/server-client';
import { storedChartOf } from '@/src/lib/input/stored';
import { storedInputOf } from './person-input';
import { UUID } from '../uuid';

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
 * **`user_person_access` 엣지가 있으면 RLS 가 이미 그 Person 을 읽게 해 준다**는
 * 것이고, 그러므로 이 payload 는 사용자가 이미 조회할 수 있는 범위를 넓히지 않는다.
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
  /** 이 사용자가 그 사람을 부르는 이름(`user_person_access.local_label`) */
  readonly name: string;
  /** 이미 계산된 명식 — 계산 입력 자체는 이 모듈 밖으로 나가지 않는다 */
  readonly saju: Saju;
  readonly [granted]: true;
};

/**
 * 볼 수 있는 사람에 대한 답 — **둘 중 하나다.**
 *
 * 앞서는 못 읽는 입력을 **던졌고**, 두 화면이 각자 `instanceof` 로 받아 각자 다른
 * 모양으로 그렸다. 못 읽는 것은 이 문이 아는 사실이지 예외적인 사건이 아니므로
 * 값으로 낸다 — 예외로 두면 부르는 쪽이 그것을 받는 것을 **잊을 수 있고**, 잊은
 * 자리는 500 이 된다.
 *
 * 「없다」와 「못 본다」는 여전히 `null` 하나다(아래).
 */
export type PersonView =
  | { readonly kind: 'ok'; readonly payload: PersonPayload }
  | { readonly kind: 'unreadable-input'; readonly message: string };

/** 주소로 들어온 값이라 모양부터 본다 — 형식이 틀린 것도 「없는 사람」과 같은 답이다 */
/**
 * @returns 볼 수 있으면 답, **없거나 못 보면 `null`.**
 *
 * 두 경우를 가르지 않는 것이 요점이다. 「그런 사람 없습니다」와 「볼 수 없습니다」가
 * 갈리면 그 차이만으로 그 Person 이 실재하는지 알아낼 수 있다. RLS 는 「안 보인다」
 * 까지만 해 주므로 그다음 한 문장을 여기서 묶는다.
 */
export async function payloadForViewer(personId: string): Promise<PersonView | null> {
  if (!UUID.test(personId)) return null;

  const supabase = await supabaseOnServer();

  /**
   * 정책이 자기 것만 내주므로 `user_id` 를 적지 않는다. 적으면 판정하는 자리가
   * 둘이 되고, 둘은 언젠가 어긋난다(ADR 0004).
   */
  const [person, { data: edge }] = await Promise.all([
    storedInputOf(supabase, personId),
    supabase.from('user_person_access').select('local_label').eq('person_id', personId).maybeSingle(),
  ]);

  if (person === null || !edge) return null;

  const stood = storedChartOf(person.input, edge.local_label);
  if (!stood.ok) return { kind: 'unreadable-input', message: stood.message };

  return {
    kind: 'ok',
    payload: {
      /** 주소에 적힌 글자가 아니라 **DB 가 정규화한 값**이다(`StoredPerson.id`) */
      personId: person.id,
      name: stood.query.name,
      saju: stood.saju,
      [granted]: true,
    },
  };
}
