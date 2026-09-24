import type { PersonSlots } from '@/src/lib/people';

import type { supabaseOnServer } from '../../auth/server-client';
import { dbFailure } from '../../db-error';
import { managedEdges, personSlotsFrom } from '../../person-slots';

type ServerClient = Awaited<ReturnType<typeof supabaseOnServer>>;

/** 홈에 서는 한 사람의 엣지 — 이름과 메모는 **내가 붙인 것**이다(`local_label`) */
export type CircleEdge = { readonly personId: string; readonly label: string; readonly note: string | null };

export type Circle = {
  /** 내 엣지 — 내 사주 카드의 이름. 못 찾으면 `null` 이고 화면이 「못 읽었다」고 말한다 */
  readonly self: CircleEdge | null;
  /** 저장한 사람 — 목록에 선 사람만(`listed`), 저장한 차례대로. 나는 빠진다 */
  readonly people: readonly CircleEdge[];
  /** 몇 자리를 썼나 — 못 읽었으면 `null`(0 으로 눕히지 않는다, `personSlotsFrom`) */
  readonly slots: PersonSlots | null;
};

/**
 * **홈이 그리는 사람들 — 나와 내가 저장한 사람을 한 번에 읽는 문.**
 *
 * 홈(`/me`)은 내 사주의 이름을 읽으려고 엣지 한 줄을, 저장한 사람 화면은 목록을 읽으려고 엣지
 * 여럿을 각자 `.tsx` 안에서 물었다(ADR 0085 의 옛 자리 둘). 홈이 관계 지도와 사람 타일을
 * 들이면서 셋째로 같은 표를 물을 뻔했다 — 여기서 한 번 묻고 나와 목록을 가른다.
 *
 * **`listed` 로 거르지 않고 읽는다.** 내 엣지는 목록에 서든 안 서든 내 이름이고, 궁합만 보려고
 * 만든 사람(`listed = false`)은 사용자가 저장한 적 없어 목록에서만 빠진다. 거르는 일은 한 번,
 * 여기서 한다.
 *
 * 엣지를 못 읽은 것은 본체의 실패라 던진다(`dbFailure`) — 빈 목록으로 두면 「저장한 사람이
 * 없다」가 되어 사용자는 자기 자료가 지워진 줄 안다. 자리 수는 부속이라 `null` 로 비운다.
 */
export async function myCircle(supabase: ServerClient, selfPersonId: string): Promise<Circle> {
  /* 정책이 자기 엣지만 내준다 — `user_id` 를 여기서 또 적지 않는다(ADR 0004) */
  const [edges, slots] = await Promise.all([
    supabase
      .from('user_person_access')
      .select('person_id, local_label, note, listed')
      .order('created_at', { ascending: true }),
    supabase.rpc('my_person_slots'),
  ]);

  if (edges.error) throw dbFailure(edges.error, 'user_person_access.select');

  const rows = edges.data ?? [];
  const self = rows.find((row) => row.person_id === selfPersonId);

  return {
    self: self === undefined ? null : edgeOf(self),
    people: managedEdges(
      rows.filter((row) => row.listed),
      selfPersonId,
    ).map(edgeOf),
    slots: personSlotsFrom(slots.data, slots.error),
  };
}

const edgeOf = (row: { person_id: string; local_label: string; note: string | null }): CircleEdge => ({
  personId: row.person_id,
  label: row.local_label,
  note: row.note,
});
