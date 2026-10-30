import { chartFingerprint } from './chart';
import { storedChartOf, type StoredInput } from './stored';

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
  readonly isSelfPerson: boolean;
  /**
   * 사람 목록에 서 있는 사람인가.
   *
   * **묻는가 마는가가 여기서 갈린다.** 목록에 선 사람이면 사용자가 아는 사람이므로
   * 「그 사람이 맞나요」를 물을 수 있다. 궁합만 보려고 만들어 둔 사람은 목록에 없어서
   * 물어도 **확인할 데가 없다** — 그때는 묻지 않고 그대로 쓴다(대상이 하나면 풀이권도
   * 하나다).
   */
  readonly listed: boolean;
};

/** 견줄 내 사람 한 줄 — 내 엣지에서 이 일에 쓰는 칸만 */
type EdgeToCompare = { readonly personId: string; readonly label: string; readonly listed: boolean };

/**
 * 읽어 온 내 사람들에서 같은 명식을 찾는다 — **웹의 서버와 앱이 같은 판정을 쓴다.** 읽는 일은 부르는 쪽이 한다.
 *
 * @param mine 저장하려는 입력의 지문(`chartFingerprint`)
 * @returns 못 읽는 입력은 없는 것으로 친다 — 「모른다」이지 「다르다」가 아니다.
 */
export function sameChartAmong(
  mine: string,
  edges: readonly EdgeToCompare[],
  byPerson: ReadonlyMap<string, StoredInput>,
  selfPersonId: string | null,
): SameChart | null {
  /**
   * **목록에 선 사람이 먼저다.**
   *
   * 같은 명식이 둘일 수 있다 — 사용자가 저장한 「어머니」와, 궁합만 보려고 만들어 둔
   * 숨은 사람. 그때 숨은 쪽을 돌려주면 화면은 **묻지 않고** 그 사람을 쓰고, 사용자가
   * 아는 그 사람은 목록에 남은 채 두 번째 대상이 된다(풀이권도 둘이다). 그래서 목록에
   * 선 쪽을 먼저 찾고, 없을 때만 숨은 쪽을 쓴다.
   */
  let hidden: SameChart | null = null;

  for (const edge of edges) {
    const stored = byPerson.get(edge.personId);
    if (stored === undefined) continue;

    const stood = storedChartOf(stored, edge.label);
    // 못 읽는 입력은 **견주지 않는다** — 「모른다」이지 「다르다」가 아니다.
    if (!stood.ok) continue;

    if (chartFingerprint(stood.saju) !== mine) continue;

    const found: SameChart = {
      personId: edge.personId,
      label: edge.label,
      isSelfPerson: edge.personId === selfPersonId,
      listed: edge.listed,
    };

    if (found.listed) return found;
    hidden ??= found;
  }

  return hidden;
}
