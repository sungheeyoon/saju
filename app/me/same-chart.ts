import { chartFingerprint, chartOf } from '@/src/lib/input/chart';
import type { Query } from '@/src/lib/input/query';
import { sameChartAmong, type SameChart } from '@/src/lib/input/same-chart';
import { supabaseOnServer } from '../auth/server-client';
import { dbFailure } from '../db-error';
import { myEdges } from './home/circle';
import { storedInputsOf } from './person-input';

export type { SameChart };

/**
 * 내 목록에서 같은 명식을 찾는다 — **서버에서 계산해 견준다.**
 *
 * ## 왜 DB 에 안 묻나
 *
 * **DB 는 명식을 계산할 수 없다.** 절기·자시·경도 판정이 TypeScript 엔진에 있고, 저장하는
 * 것은 명식이 아니라 입력이다(ADR 0001). 그래서 견주려면 저장된 입력을 읽어 **같은
 * 엔진으로 다시 계산**하는 수밖에 없다.
 *
 * 지문을 열로 저장해 두는 길도 있었다. 안 간다 — 엔진이 바뀌면 그 값은 조용히 낡고,
 * 낡은 지문은 「다른 사람」이라고 **조용히** 답한다. 그러면 이 기능이 있는데 안 도는
 * 날이 오고 아무도 모른다.
 *
 * ## 브라우저가 아니라 여기서 한다
 *
 * 견주려면 내 사람들의 출생 입력을 다 읽어야 한다. 그것을 브라우저로 내리면, 익명
 * 화면에서 저장 한 번 누르려고 **가족 열 명의 생년월일시가 클라이언트로 간다.**
 * 서버 액션이 이미 내 세션으로 도므로 여기서 읽고 여기서 버린다.
 *
 * ## 나도 센다
 *
 * `self` 와 `person` 은 다른 kind 라 **각자 현재 결과를 하나씩 든다**. 자기 생년월일시를
 * 가족으로 한 번 더 저장하면 풀이권이 정확히 한 번 더 나간다 — 이 함수가 막으려는 바로
 * 그 일이다. 그래서 `user_person_access` 를 통째로 본다(내 엣지가 거기 있다).
 *
 * @returns 못 읽는 입력은 **없는 것으로 친다.** 여기서 하는 일은 먼저 물어보는 것이지
 *   판정이 아니고, 못 읽는 입력을 「같다」고도 「다르다」고도 말할 수 없다.
 *
 * **계산 오류는 안 삼킨다 — 저장이 멈춘다.** 앞서는 `catch` 가 두 갈래였는데 둘 다
 * `continue` 라 사실상 전부 건너뛰었다. 건너뛴 대가는 「같은 명식을 못 찾아 풀이권이
 * 두 번 나가는 것」이고, 그것이 이 함수가 존재하는 이유다. 한 사람에서 엔진이 터지면
 * 답을 모르는 채로 저장을 밀지 않는다.
 *
 * **조회가 터진 것도 같다**(ADR 0078). 계정과 엣지의 `error` 를 안 꺼내던 때는 목록을 못
 * 읽은 것이 「같은 사람이 없다」(`null`)로 흘러, 묻지 않은 채 저장이 밀렸다. 사람 입력을 못
 * 읽을 때(`storedInputsOf`)와 같은 길로 던진다.
 */
export async function sameChartInMyList(query: Query): Promise<SameChart | null> {
  let mine: string;
  try {
    mine = chartFingerprint(chartOf(query));
  } catch {
    // 계산이 안 되는 입력은 저장도 안 된다. 거절은 그쪽에서 한다.
    return null;
  }

  const supabase = await supabaseOnServer();

  /* 엣지는 「내 사람」 문이 읽는다 — 못 읽으면 던진다(ADR 0078) */
  const [{ data: account, error: accountError }, edges] = await Promise.all([
    supabase.from('app_user').select('self_person_id').maybeSingle(),
    myEdges(supabase),
  ]);

  if (accountError) throw dbFailure(accountError, 'app_user.self_person_id');
  if (edges.length === 0) return null;

  const byPerson = await storedInputsOf(
    supabase,
    edges.map((edge) => edge.personId),
  );

  if (byPerson.size === 0) return null;

  return sameChartAmong(mine, edges, byPerson, account?.self_person_id ?? null);
}
