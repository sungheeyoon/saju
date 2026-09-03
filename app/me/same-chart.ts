import { chartFingerprint, chartOf } from '../chart';
import type { Query } from '../query';
import { UnreadableRevisionError, queryFromRevision } from '../revision';
import { supabaseOnServer } from '../auth/server-client';

/**
 * 이미 저장돼 있는 같은 명식 — **저장하기 전에 묻기 위한 값.**
 *
 * 막으려는 것은 중복 행이 아니라 **풀이권이 두 번 나가는 것**이다. 대상이 둘이면
 * 풀이도 두 벌이고 풀이권도 둘이다(ADR 0013·0021).
 */
export type SameChart = {
  readonly personId: string;
  readonly label: string;
  /** 나 자신이면 갈 곳이 사람 상세가 아니라 `/me` 다 */
  readonly isSelf: boolean;
};

/**
 * 내 목록에서 같은 명식을 찾는다 — **서버에서 계산해 견준다.**
 *
 * ## 왜 DB 에 안 묻나
 *
 * **DB 는 명식을 계산할 수 없다.** 절기·자시·경도 판정이 TypeScript 엔진에 있고, 저장하는
 * 것은 명식이 아니라 입력이다(ADR 0001). 그래서 견주려면 저장된 판본을 읽어 **같은
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
 * @returns 못 읽는 판본은 **없는 것으로 친다.** 여기서 하는 일은 먼저 물어보는 것이지
 *   판정이 아니고, 못 읽는 판본을 「같다」고도 「다르다」고도 말할 수 없다.
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

  const [{ data: account }, { data: edges }] = await Promise.all([
    supabase.from('app_user').select('self_person_id').maybeSingle(),
    // 정책이 자기 목록만 내준다 — `user_id` 를 여기서 또 적지 않는다.
    supabase
      .from('user_person_access')
      .select('person_id, local_label')
      .order('created_at', { ascending: true }),
  ]);

  if (!edges || edges.length === 0) return null;

  const { data: persons } = await supabase
    .from('person')
    .select('id, current_revision_id')
    .in(
      'id',
      edges.map((edge) => edge.person_id as string),
    );

  const currentIds = (persons ?? [])
    .map((person) => person.current_revision_id)
    .filter((id): id is string => id !== null);

  if (currentIds.length === 0) return null;

  const { data: revisions } = await supabase
    .from('person_chart_revision')
    .select(
      'person_id, calendar, original_date, solar_date, birth_time, gender, city, late_night_rule, time_basis',
    )
    .in('id', currentIds);

  const byPerson = new Map((revisions ?? []).map((revision) => [revision.person_id, revision]));

  for (const edge of edges) {
    const revision = byPerson.get(edge.person_id);
    if (revision === undefined) continue;

    let theirs: string;
    try {
      theirs = chartFingerprint(chartOf(queryFromRevision(revision, edge.local_label as string)));
    } catch (error) {
      // 못 읽는 판본과 못 세는 판본은 **견주지 않는다** — 둘 다 「모른다」이지 「다르다」가 아니다.
      if (error instanceof UnreadableRevisionError) continue;
      continue;
    }

    if (theirs === mine) {
      return {
        personId: edge.person_id as string,
        label: edge.local_label as string,
        isSelf: edge.person_id === account?.self_person_id,
      };
    }
  }

  return null;
}
