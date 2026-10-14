import { cache } from 'react';

import type { PersonSlots } from '@/src/lib/people';

import type { supabaseOnServer } from '../../auth/server-client';
import { dbFailure } from '../../db-error';
import { managedEdges, readPersonSlots } from '../../person-slots';

type ServerClient = Awaited<ReturnType<typeof supabaseOnServer>>;

/**
 * **내 사람 하나 — 내 엣지(`user_person_access`) 한 줄.** 이름과 메모는 **내가 붙인 것**이다(`local_label`).
 *
 * `listed` 가 거짓이면 궁합만 보려고 만든 사람이다 — 내 엣지이지만 사용자가 저장한 적 없어 목록에 안 선다.
 */
export type MyEdge = {
  readonly personId: string;
  readonly label: string;
  readonly note: string | null;
  readonly listed: boolean;
};

export type MyPeople = {
  /** 내 엣지 전부 — 나도, 목록에 안 선 사람도 든다. 저장한 차례대로 */
  readonly edges: readonly MyEdge[];
  /** 목록에 선 사람만(`listed`), 저장한 차례대로. 나도 목록에 서 있으면 든다 — 빼는 일은 부르는 쪽이 한다 */
  readonly listed: readonly MyEdge[];
  /** 몇 자리를 썼나 — 못 읽었으면 `null`(0 으로 눕히지 않는다, `personSlotsFrom`) */
  readonly slots: PersonSlots | null;
};

/** 홈에 서는 한 사람의 엣지 */
type CircleEdge = Pick<MyEdge, 'personId' | 'label' | 'note'>;

export type Circle = {
  /** 내 엣지 — 내 사주 카드의 이름. 못 찾으면 `null` 이고 화면이 「못 읽었다」고 말한다 */
  readonly self: CircleEdge | null;
  /** 저장한 사람 — 목록에 선 사람만(`listed`), 저장한 차례대로. 나는 빠진다 */
  readonly people: readonly CircleEdge[];
  /** 몇 자리를 썼나 — 못 읽었으면 `null`(0 으로 눕히지 않는다, `personSlotsFrom`) */
  readonly slots: PersonSlots | null;
};

/**
 * **한 그림 안에서 한 번** — 엣지와 자리 수를 붙든다.
 *
 * 키는 클라이언트가 아니다. 문마다 `supabaseOnServer()` 로 제 클라이언트를 짓고(`payloadForViewer` 가 궁합 화면에서 두 번),
 * 그 클라이언트들은 한 요청의 같은 쿠키 · 같은 JWT 라 정책이 같은 줄을 내준다. 그래서 그림 하나에 그릇 하나다.
 * 서버 컴포넌트 밖(서버 액션)에서는 부를 때마다 새것이라 읽기도 매번이다 — 액션이 엣지를 고친 뒤 옛 줄을 볼 일이 없다.
 */
const thisRender = cache(
  (): {
    edges: Promise<readonly MyEdge[]> | null;
    slots: Promise<PersonSlots | null> | null;
  } => ({ edges: null, slots: null }),
);

/**
 * **내 엣지 전부 — 「내 사람」을 읽는 문.**
 *
 * 홈 · 저장한 사람 · 궁합 탭 · 사람 하나의 화면 · 글 화면 · 매칭의 내 요약 · 저장 전 같은 명식 찾기가 저마다
 * 같은 표를 물었다(옛 자리 일곱, 그 가운데 둘은 `.tsx` 안). 한 그림 안에서 여럿이 불러도 읽기는 한 번이다(위 `thisRender`).
 *
 * **`listed` 로 거르지 않고 읽는다.** 내 엣지는 목록에 서든 안 서든 내 이름이고, 궁합만 보려고 만든 사람은 목록에서만
 * 빠진다. 거르는 일은 읽은 뒤에 한다. 행은 몇 줄이다 — 저장 자리 한도(`my_person_slots`) 안의 사람과 궁합만 본 사람.
 *
 * 못 읽은 것은 본체의 실패라 던진다(`dbFailure`, ADR 0078) — 빈 목록으로 두면 「저장한 사람이 없다」가 되어 사용자는
 * 자기 자료가 지워진 줄 안다.
 */
export function myEdges(supabase: ServerClient): Promise<readonly MyEdge[]> {
  const held = thisRender();
  held.edges ??= readEdges(supabase);
  return held.edges;
}

async function readEdges(supabase: ServerClient): Promise<readonly MyEdge[]> {
  /* 정책이 자기 엣지만 내준다 — `user_id` 를 여기서 또 적지 않는다(ADR 0004) */
  const { data, error } = await supabase
    .from('user_person_access')
    .select('person_id, local_label, note, listed')
    .order('created_at', { ascending: true });
  if (error) throw dbFailure(error, 'user_person_access.select');

  return (data ?? []).map((row) => ({
    personId: row.person_id,
    label: row.local_label,
    note: row.note,
    listed: row.listed,
  }));
}

/**
 * 내 엣지 가운데 그 사람 하나 — **없거나 못 보면 `null`.** 읽는 것은 `myEdges` 그대로다.
 *
 * 주소로 들어온 id 는 대문자일 수 있다. 앞서 DB 가 `uuid` 로 견주던 것과 같은 답이 되게 소문자로 견준다(DB 는 소문자로 낸다).
 */
export async function myEdge(supabase: ServerClient, personId: string): Promise<MyEdge | null> {
  const wanted = personId.toLowerCase();
  return (await myEdges(supabase)).find((edge) => edge.personId.toLowerCase() === wanted) ?? null;
}

/**
 * **화면이 그리는 내 사람들** — 엣지 전부 · 목록에 선 사람 · 자리 수.
 *
 * 자리 수는 부속이라 못 읽으면 `null` 로 비운다. 엣지만 쓰는 문(`myEdge`)은 자리 수를 안 부른다.
 */
export async function myPeople(supabase: ServerClient): Promise<MyPeople> {
  const held = thisRender();
  /* 몇 자리 남았는지는 **DB 가 센다** — 화면이 빼기를 하면 selfPerson 을 잊는 자리가 생긴다 */
  held.slots ??= readPersonSlots(supabase);
  const [edges, slots] = await Promise.all([myEdges(supabase), held.slots]);
  return { edges, listed: edges.filter((edge) => edge.listed), slots };
}

/**
 * **홈이 그리는 사람들 — 나와 내가 저장한 사람.** 읽는 것은 `myPeople` 그대로이고 여기서는 나와 목록을 가른다.
 */
export async function myCircle(supabase: ServerClient, selfPersonId: string): Promise<Circle> {
  const { edges, listed, slots } = await myPeople(supabase);
  const self = edges.find((edge) => edge.personId === selfPersonId);

  return {
    self: self === undefined ? null : circleEdgeOf(self),
    people: managedEdges(listed, selfPersonId).map(circleEdgeOf),
    slots,
  };
}

const circleEdgeOf = (edge: MyEdge): CircleEdge => ({ personId: edge.personId, label: edge.label, note: edge.note });
