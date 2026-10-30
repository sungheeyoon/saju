import { accountStateOf, type AccountState, type Suspension } from '@account/index';
import { rpcArgs } from '@db';
import { userFacingDbMessage } from '@db-error';
import { chartFingerprint, chartOf } from '@input/chart';
import { managedPersonArgs, noteOrNull, unsupportedForSaving } from '@input/edit';
import { missingAnswer, type Query } from '@input/query';
import { sameChartAmong, type SameChart } from '@input/same-chart';
import { PERSON_INPUT_COLUMNS, storedChartOf, storedInputFilled, type StoredInput } from '@input/stored';
import { personSlotsFrom, type PersonSlots } from '@people';
import { listedPairSummary } from '@reading-display';
import type { Saju } from '@saju';

import { NOT_READY } from '@/auth/signup';
import { supabase } from '@/auth/client';

export type { SameChart };

export type MyEdge = { readonly personId: string; readonly label: string; readonly note: string | null; readonly listed: boolean };

/** 한 사람의 명식 — 못 읽는 입력이면 그 사실을 든다. 기본값으로 메우지 않는다(`app/me/people/page.tsx`) */
export type PersonChart = { ok: true; query: Query; saju: Saju } | { ok: false; message: string };

/** 목록에 서는 내 글 한 줄 — 사주풀이와 내 궁합만 쓴다 */
export type MyReading = {
  readonly kind: 'self' | 'person' | 'private';
  readonly personA: string | null;
  readonly personB: string | null;
  readonly labelA: string | null;
  readonly labelB: string | null;
  readonly score: number | null;
  readonly metaphor: string | null;
  readonly fromCurrentChart: boolean;
  readonly createdAt: string;
};

export type Read<T> = { kind: 'ok'; value: T } | { kind: 'signed-out' } | { kind: 'failed'; message: string };

const failed = (message: string) => ({ kind: 'failed', message }) as const;

/** 세션이 없으면 읽지 않는다 — 웹의 `redirectToSignIn` 자리다. 정책이 빈 목록으로 답해 「저장한 사람이 없다」로 서지 않게 */
export async function signedIn(): Promise<Read<true>> {
  if (supabase === null) return failed(NOT_READY);
  const { data } = await supabase.auth.getSession();
  return data.session === null ? { kind: 'signed-out' } : { kind: 'ok', value: true };
}

/** 계정 상태 — 판정은 웹과 같은 `accountStateOf` 다(`app/me/account.ts`) */
export async function readAccount(): Promise<{ state: AccountState; selfPersonId: string | null; nickname: string | null }> {
  const none = { selfPersonId: null, nickname: null };
  if (supabase === null) return { state: accountStateOf({ ok: false, reason: 'unreachable' }), ...none };

  const { data, error } = await supabase.from('app_user').select('status, self_person_id, nickname').maybeSingle();
  if (error !== null) return { state: accountStateOf({ ok: false, reason: 'unreachable' }), ...none };
  if (data === null) return { state: accountStateOf({ ok: false, reason: 'missing' }), ...none };

  let suspension: Suspension | null | undefined;
  if (data.status === 'suspended') {
    const reason = await supabase.rpc('my_suspension');
    const row = reason.error !== null ? undefined : (reason.data ?? [])[0];
    suspension = row === undefined ? null : { nickname: row.nickname ?? null, reason: row.reason ?? null };
  }
  return {
    state: accountStateOf({ ok: true, account: { status: data.status, selfPersonId: data.self_person_id, suspension } }),
    selfPersonId: data.self_person_id,
    nickname: data.nickname,
  };
}

/** 내 엣지 전부 — 정책이 내 것만 내준다. 못 읽은 것은 빈 목록이 아니다 */
export async function readEdges(): Promise<{ ok: true; edges: readonly MyEdge[] } | { ok: false; message: string }> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { data, error } = await supabase
    .from('user_person_access')
    .select('person_id, local_label, note, listed')
    .order('created_at', { ascending: true });
  if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'user_person_access.select') };
  return {
    ok: true,
    edges: (data ?? []).map((row) => ({ personId: row.person_id, label: row.local_label, note: row.note, listed: row.listed })),
  };
}

export async function readInputs(personIds: readonly string[]): Promise<{ ok: true; inputs: Map<string, StoredInput> } | { ok: false; message: string }> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  if (personIds.length === 0) return { ok: true, inputs: new Map() };
  const { data, error } = await supabase.from('person').select(`id, ${PERSON_INPUT_COLUMNS}`).in('id', personIds as string[]);
  if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'person.select.in') };
  const rows = (data ?? []) as unknown as (StoredInput & { id: string })[];
  return { ok: true, inputs: new Map(rows.filter((row) => storedInputFilled(row)).map((row) => [row.id, row])) };
}

/** 내 글 목록 — 사주풀이와 내 궁합만 추린다. 요약의 자리 호칭은 웹과 같은 함수로 바꾼다. 부속 정보라 못 읽으면 비운다 */
export async function readReadings(): Promise<readonly MyReading[]> {
  if (supabase === null) return [];
  const { data, error } = await supabase.rpc('my_readings');
  if (error !== null) return [];
  return (data ?? []).flatMap((row): MyReading[] => {
    if (row.kind !== 'self' && row.kind !== 'person' && row.kind !== 'private') return [];
    const labelA = row.label_a ?? null;
    const labelB = row.label_b ?? null;
    const summary = row.metaphor ?? null;
    return [
      {
        kind: row.kind,
        personA: row.person_a ?? null,
        personB: row.person_b ?? null,
        labelA,
        labelB,
        score: row.score ?? null,
        metaphor:
          row.kind === 'private'
            ? listedPairSummary(summary, labelA !== null && labelB !== null ? { first: labelA, second: labelB } : null)
            : summary,
        fromCurrentChart: row.from_current_chart,
        createdAt: row.created_at,
      },
    ];
  });
}

/** 사주풀이를 지금 만드는 중인 사람들 — 부속 정보다. 못 읽으면 단추는 「받기」로 선다 */
export async function readMaking(): Promise<ReadonlySet<string>> {
  if (supabase === null) return new Set();
  const { data, error } = await supabase.rpc('my_running_readings');
  if (error !== null) return new Set();
  return new Set((data ?? []).flatMap((row) => (row.kind === 'person' && row.person_a != null ? [row.person_a] : [])));
}

export async function readSlots(): Promise<PersonSlots | null> {
  if (supabase === null) return null;
  const { data, error } = await supabase.rpc('my_person_slots');
  return personSlotsFrom(error !== null ? null : data);
}

export type PersonRow = MyEdge & { readonly chart: PersonChart };

export type PeopleList = {
  readonly state: AccountState;
  readonly selfPersonId: string | null;
  readonly slots: PersonSlots | null;
  readonly people: readonly PersonRow[];
  readonly readings: readonly MyReading[];
  readonly making: ReadonlySet<string>;
};

export function chartOfStored(stored: StoredInput | undefined, label: string): PersonChart {
  /* 입력이 없는 사람 — 읽을 것이 없다는 말과 못 읽는다는 말을 여기서 합친다 */
  return stored === undefined ? { ok: false, message: '출생 정보를 불러오지 못했어요.' } : storedChartOf(stored, label);
}

/** 저장한 사람 화면이 읽는 것 — 차례와 갈래는 `app/me/people/page.tsx` 와 같다 */
export async function readPeopleList(): Promise<Read<PeopleList>> {
  const session = await signedIn();
  if (session.kind !== 'ok') return session;

  const [account, edges, slots, readings, making] = await Promise.all([readAccount(), readEdges(), readSlots(), readReadings(), readMaking()]);
  if (!edges.ok) return failed(edges.message);

  /* 목록에 선 사람만 — 궁합만 보려고 만든 사람은 저장한 적이 없다. 나는 빠진다 — 홈의 내 사주 카드가 그 자리다 */
  const managed = edges.edges.filter((edge) => edge.listed && edge.personId !== account.selfPersonId);
  const inputs = await readInputs(managed.map((edge) => edge.personId));
  if (!inputs.ok) return failed(inputs.message);

  return {
    kind: 'ok',
    value: {
      state: account.state,
      selfPersonId: account.selfPersonId,
      slots,
      readings,
      making,
      people: managed.map((edge) => ({ ...edge, chart: chartOfStored(inputs.inputs.get(edge.personId), edge.label) })),
    },
  };
}

export type PersonDetail = {
  readonly state: AccountState;
  readonly selfPersonId: string | null;
  readonly nickname: string | null;
  readonly readings: readonly MyReading[];
  /** 없거나 못 보면 `null` — 둘을 가르지 않는다 */
  readonly person: PersonRow | null;
};

/** 사람 하나 — 없는 사람과 못 보는 사람이 같은 답이다(`app/me/payload.ts`) */
export async function readPersonDetail(personId: string): Promise<Read<PersonDetail>> {
  const session = await signedIn();
  if (session.kind !== 'ok') return session;

  const [account, edges, readings] = await Promise.all([readAccount(), readEdges(), readReadings()]);
  if (!edges.ok) return failed(edges.message);

  const wanted = personId.toLowerCase();
  const edge = edges.edges.find((one) => one.personId.toLowerCase() === wanted) ?? null;
  const inputs = edge === null ? null : await readInputs([edge.personId]);
  if (inputs !== null && !inputs.ok) return failed(inputs.message);

  const stored = edge === null || inputs === null || !inputs.ok ? undefined : inputs.inputs.get(edge.personId);
  return {
    kind: 'ok',
    value: {
      state: account.state,
      selfPersonId: account.selfPersonId,
      nickname: account.nickname,
      readings,
      person: edge === null || stored === undefined ? null : { ...edge, chart: chartOfStored(stored, edge.label) },
    },
  };
}

/**
 * 내 목록에서 같은 명식을 찾는다 — 판정은 웹의 서버와 같은 `sameChartAmong` 이다.
 *
 * **못 읽었으면 값으로 멈춘다** — 묻지 못한 채 저장이 밀리면 풀이권이 두 번 나간다(ADR 0034 · 0078).
 */
export async function findSameChart(query: Query): Promise<{ ok: true; same: SameChart | null } | { ok: false; message: string }> {
  let mine: string;
  try {
    mine = chartFingerprint(chartOf(query));
  } catch {
    /* 계산이 안 되는 입력은 저장도 안 된다. 거절은 그쪽에서 한다 */
    return { ok: true, same: null };
  }
  if (supabase === null) return { ok: false, message: NOT_READY };

  const [account, edges] = await Promise.all([supabase.from('app_user').select('self_person_id').maybeSingle(), readEdges()]);
  if (account.error !== null) return { ok: false, message: userFacingDbMessage(account.error, 'app_user.self_person_id') };
  if (!edges.ok) return edges;
  const inputs = await readInputs(edges.edges.map((edge) => edge.personId));
  if (!inputs.ok) return inputs;

  return { ok: true, same: sameChartAmong(mine, edges.edges, inputs.inputs, account.data?.self_person_id ?? null) };
}

export type PersonSaved =
  | { ok: true; personId: string }
  | { ok: false; kind: 'failed'; message: string }
  | { ok: false; kind: 'same-chart'; same: SameChart };

/** 한 사람을 등록한다 — 차례와 거절은 `addManagedPerson` 과 같고, 한도와 자격은 DB 가 든다 */
export async function addPerson(query: Query, note: string, evenIfSameChart: boolean): Promise<PersonSaved> {
  const missing = missingAnswer(query);
  if (missing !== null) return { ok: false, kind: 'failed', message: missing };
  const unsupported = unsupportedForSaving(query);
  if (unsupported !== null) return { ok: false, kind: 'failed', message: unsupported };
  if (supabase === null) return { ok: false, kind: 'failed', message: NOT_READY };

  if (!evenIfSameChart) {
    const found = await findSameChart(query);
    if (!found.ok) return { ok: false, kind: 'failed', message: found.message };
    if (found.same !== null) return { ok: false, kind: 'same-chart', same: found.same };
  }

  const { data, error } = await supabase.rpc('create_managed_person', rpcArgs<'create_managed_person'>(managedPersonArgs(query, note)));
  if (error !== null) return { ok: false, kind: 'failed', message: userFacingDbMessage(error, 'create_managed_person') };
  if (typeof data !== 'string') {
    return { ok: false, kind: 'failed', message: '저장이 끝났는지 알 수 없어요. 저장한 사람 목록을 다시 열어 봐 주세요.' };
  }
  return { ok: true, personId: data };
}

type Saved = { ok: true } | { ok: false; message: string };

/** 메모만 고친다 — 정책이 내 엣지만 열어 준다 */
export async function updateNote(personId: string, note: string): Promise<Saved> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { error } = await supabase.from('user_person_access').update({ note: noteOrNull(note) }).eq('person_id', personId);
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'user_person_access.update') } : { ok: true };
}

/** 목록에서 뺀다 — 지우는 것은 엣지이지 Person 이 아니다. 나는 정책이 안 뺀다 */
export async function removeFromList(personId: string): Promise<Saved> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { error } = await supabase.from('user_person_access').delete().eq('person_id', personId);
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'user_person_access.delete') } : { ok: true };
}
