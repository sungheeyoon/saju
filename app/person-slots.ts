import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, RpcRow } from '@/src/lib/db';
import type { PersonSlots } from '@/src/lib/people';

/**
 * **한도가 세는 것은 「내가 관리하는 사람」이지 내 계정에 묶인 Person 수가 아니다.**
 *
 * selfPerson 은 빠진다. 목록을 이미 들고 있는 화면이 그 목록을 거를 때 쓴다 — 세는
 * 일 자체는 DB 가 한다(`my_person_slots`).
 */
export const managedEdges = <T extends { personId: string }>(
  edges: readonly T[] | null | undefined,
  selfPersonId: string | null | undefined,
): T[] => (edges ?? []).filter((edge) => edge.personId !== selfPersonId);

/**
 * **저장 자리 수를 읽는 문** — 홈의 「내 사람」(`app/me/home/circle.ts`, 서버)과 사주 이어 보기(`app/save-for-reading.tsx`, 브라우저)가 부른다.
 *
 * 클라이언트를 **받기만** 한다 — 서버 화면은 서버 클라이언트를, 브라우저 화면은 브라우저 클라이언트를 넣는다. 클라이언트를 이 모듈이
 * 들면 서버 전용 코드가 클라이언트 묶음으로 딸려 들어간다(`self-person-state.ts` 와 같은 결). 브라우저 화면이 `.rpc` 를 직접 부르던 옛 자리는
 * 2026-10-14 에 여기로 옮겼다(G-109).
 */
export async function readPersonSlots(supabase: SupabaseClient<Database>): Promise<PersonSlots | null> {
  const { data, error } = await supabase.rpc('my_person_slots');
  return personSlotsFrom(data, error);
}

/**
 * `my_person_slots` 가 내주는 한 줄을 화면이 쓰는 값으로 — 모양을 옮기는 일은 여기 한 자리라, 필드 이름이 바뀌는 날 한쪽만 고쳐지지 않는다.
 *
 * @returns 못 읽었으면 `null` — **0 으로 눕히지 않는다.** 0 은 「다 찼다」이고, 그렇게
 *   눕히면 읽기가 한 번 실패한 사람에게 화면이 「자리를 다 채웠다」고 거짓을 말한다.
 */
function personSlotsFrom(
  data: readonly RpcRow<'my_person_slots'>[] | null,
  error: unknown | null,
): PersonSlots | null {
  if (error) return null;

  /* 칸 이름은 생성 타입이 든다 — `person_limit` 이 바뀌면 컴파일러가 여기를 가리킨다 */
  const one = data?.[0];

  return one === undefined ? null : { limit: one.person_limit, used: one.used, remaining: one.remaining };
}
