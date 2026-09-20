import type { StoredInput } from '@/src/lib/input/stored';

import type { supabaseOnServer } from '../auth/server-client';
import { dbFailure } from '../db-error';

type ServerClient = Awaited<ReturnType<typeof supabaseOnServer>>;

/**
 * **저장된 입력을 집어 오는 문.**
 *
 * 세우는 문(`storedChartOf`)과 갈라 둔다. 저쪽은 값을 받아 명식을 세우는 순수 함수라
 * DB 가 없고, 이쪽은 행을 집어 오기만 하고 명식을 모른다. 갈라야 하는 까닭은 **출처가
 * 셋**이기 때문이다 — `person` 행 하나, `person` 행 묶음, 그리고 얼린 생성 작업
 * (`reading_job.birth_a`). 셋째는 `person` 행이 아니므로 이 문을 못 지나지만 세우는
 * 문은 그대로 지난다.
 *
 * **없는 것은 `null` 이고 그것이 이 문의 전부다.** 「행이 없다」와 「못 읽는다」를 한
 * 문이 함께 답하면, 부르는 쪽이 그 둘을 가르려고 다시 갈래를 만든다.
 *
 * **조회가 터진 것은 「없다」가 아니다.** `maybeSingle()` 은 0행일 때도 터졌을 때도
 * `data: null` 로 오므로 둘을 가르는 유일한 값이 `error` 다(`readAccount` 가 같은 것을
 * 잰다). 안 보면 네트워크 장애가 「저장된 사주가 없습니다」로 둔갑하고, 사람 목록은
 * 전부 못 읽는 것처럼 선다 — 사용자가 고칠 것이 없는 일에 고칠 것이 있는 말을 붙이는 꼴이다.
 * 그래서 **터진 것은 던진다**(`dbFailure`, `candidates.ts` 와 같은 자리).
 *
 * 정책이 막은 것은 여기 안 온다 — RLS 는 0행으로 답하지 오류로 답하지 않는다. 「못 보는
 * 것」이 `null` 로 남는 이유이고, 그래서 이 던지기가 노출을 넓히지 않는다.
 */

/**
 * 입력 한 벌을 읽을 때 고르는 열 — **밖으로 안 나간다.**
 *
 * 앞서는 여섯 화면이 이 여덟 이름을 손으로 들고 각자 `select` 했다. 여덟 벌로 적혀
 * 있으면 한 벌이 언젠가 한 칸을 빠뜨리고, 빠뜨린 칸은 `undefined` 로 조용히 흘러
 * 들어간다 — 타입이 `string` 이라 아무도 안 막는다.
 */
const PERSON_INPUT_COLUMNS =
  'calendar, original_date, solar_date, birth_time, gender, city, late_night_rule, time_basis';

/**
 * 한 사람의 저장된 입력.
 *
 * `id` 를 함께 낸다 — **되돌려줄 값은 주소에 적힌 글자가 아니다.** Postgres 의 `uuid`
 * 비교는 대소문자를 안 가리므로 대문자로 적은 주소가 조회를 그대로 지나간다. 그 값을
 * 되돌려주면 부르는 쪽의 문자열 비교가 전부 어긋난다 — 「이게 내 selfPerson 인가」가
 * 거짓이 되고, 그때 화면은 못 만드는 버튼을 세운다. 정규화는 DB 가 이미 했다.
 */
export type StoredPerson = { readonly id: string; readonly input: StoredInput };

/**
 * 여덟 칸이 **함께 차거나 함께 빈다** — 한 칸이 그 답을 든다.
 *
 * DB 검사식이 그렇게 걸려 있다(`num_nonnulls(...) in (0, 7)`). 그래서 한 칸만 보면
 * 되고, 여덟을 다 보면 그 검사식과 같은 말을 두 곳에서 하게 된다.
 */
const filled = (row: Record<string, unknown> | null): boolean =>
  row !== null && row.calendar !== null && row.calendar !== undefined;

/**
 * 한 사람 — **없거나 입력이 비었으면 `null`.**
 *
 * 볼 수 없는 사람도 `null` 이다. 정책이 안 보여 주면 조회가 0행으로 오고, 여기서
 * 「없다」와 「못 본다」를 가르지 않는 것이 요점이다 — 갈리면 그 차이만으로 그 Person 이
 * 실재하는지 알아낼 수 있다.
 *
 * 클라이언트를 인자로 받는다. 부르는 쪽 여럿이 엣지(`user_person_access`)를 같은
 * `Promise.all` 에서 함께 읽으므로, 여기서 새로 만들면 그 병렬이 깨진다.
 */
export async function storedInputOf(
  supabase: ServerClient,
  personId: string,
): Promise<StoredPerson | null> {
  /* 정책이 볼 수 있는 것만 내주므로 `user_id` 를 적지 않는다 — 판정하는 자리를 둘로
     만들지 않는다(ADR 0004). */
  const { data, error } = await supabase
    .from('person')
    .select(`id, ${PERSON_INPUT_COLUMNS}`)
    .eq('id', personId)
    .maybeSingle();

  if (error) throw dbFailure(error, 'person.select');
  if (!filled(data)) return null;

  return { id: data!.id as string, input: data as unknown as StoredInput };
}

/**
 * 여럿 — **한 번에 읽는다.**
 *
 * 목록 화면이 사람마다 위 함수를 부르면 왕복이 사람 수만큼 는다. 입력이 빈 사람은
 * 지도에 안 들어가므로, 부르는 쪽은 `get` 이 `undefined` 를 내는 것으로 그 사실을 받는다.
 */
export async function storedInputsOf(
  supabase: ServerClient,
  personIds: readonly string[],
): Promise<Map<string, StoredInput>> {
  if (personIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('person')
    .select(`id, ${PERSON_INPUT_COLUMNS}`)
    .in('id', personIds);

  if (error) throw dbFailure(error, 'person.select.in');

  return new Map(
    (data ?? [])
      .filter((row) => filled(row))
      .map((row) => [row.id as string, row as unknown as StoredInput]),
  );
}
