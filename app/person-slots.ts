import type { PersonSlots } from '@/src/lib/people';

/**
 * **한도가 세는 것은 「내가 관리하는 사람」이지 내 계정에 묶인 Person 수가 아니다.**
 *
 * selfPerson 은 빠진다. 목록을 이미 들고 있는 화면이 그 목록을 거를 때 쓴다 — 세는
 * 일 자체는 DB 가 한다(`my_person_slots`).
 */
export const managedEdges = <T extends { person_id: string }>(
  edges: readonly T[] | null | undefined,
  selfPersonId: string | null | undefined,
): T[] => (edges ?? []).filter((edge) => edge.person_id !== selfPersonId);

/**
 * `my_person_slots` 가 내주는 한 줄을 화면이 쓰는 값으로.
 *
 * **부르는 일은 여기서 하지 않는다.** 서버 화면은 서버 클라이언트로, 브라우저 화면은
 * 브라우저 클라이언트로 부른다 — 둘을 한 모듈이 들고 있으면 서버 전용 코드가 클라이언트
 * 묶음으로 딸려 들어간다. 여기 남는 것은 **모양을 옮기는 일 하나**이고, 그것이 두 자리에
 * 있으면 필드 이름이 바뀌는 날 한쪽만 고쳐진다.
 *
 * @returns 못 읽었으면 `null` — **0 으로 눕히지 않는다.** 0 은 「다 찼다」이고, 그렇게
 *   눕히면 읽기가 한 번 실패한 사람에게 화면이 「스무 명을 채웠다」고 거짓을 말한다.
 */
export function personSlotsFrom(
  data: unknown,
  error: unknown | null,
): PersonSlots | null {
  if (error) return null;

  const one = (Array.isArray(data) ? data[0] : data) as
    | { person_limit: number; used: number; remaining: number }
    | undefined
    | null;

  return one == null
    ? null
    : { limit: one.person_limit, used: one.used, remaining: one.remaining };
}
