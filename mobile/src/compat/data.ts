import { isBlocked, type AccountState } from '@account/index';
import { rpcArgs } from '@db';
import { userFacingDbMessage } from '@db-error';
import { pairSeatArgs, unsupportedForSaving } from '@input/edit';
import { missingAnswer, type Query } from '@input/query';
import { storedChartOf } from '@input/stored';
import { relationOf, type Relation } from '@people';
import { listedPairSummary, pairSeatsOf } from '@reading-display';
import { STEM_INFO, type Element, type Saju, type Stem } from '@saju';

import { supabase } from '@/auth/client';
import { NOT_READY } from '@/auth/signup';
import { findSameChart, readAccount, readEdges, readInputs, readReadings, signedIn, type MyReading, type Read, type SameChart } from '@/people/data';

/** 고를 수 있는 사람 — 그 사람의 얼굴에 쓸 일간까지만 */
export type Choosable = {
  readonly personId: string;
  readonly label: string;
  readonly isSelfPerson: boolean;
  readonly stem: Stem | null;
  readonly element: Element | null;
};

export type PickerData = {
  readonly state: AccountState;
  readonly people: readonly Choosable[];
  readonly compats: readonly MyReading[];
};

/** 궁합의 첫 걸음이 읽는 것 — 목록에 선 사람만 고르고 맨 위는 「나」다(`app/compat/page.tsx`) */
export async function readPicker(): Promise<Read<PickerData>> {
  const session = await signedIn();
  if (session.kind !== 'ok') return session;

  const [account, edges, readings] = await Promise.all([readAccount(), readEdges(), readReadings()]);
  if (!edges.ok) return { kind: 'failed', message: edges.message };

  const listed = edges.edges.filter((edge) => edge.listed);
  const inputs = await readInputs(listed.map((edge) => edge.personId));
  if (!inputs.ok) return { kind: 'failed', message: inputs.message };

  const people = listed
    .map((edge): Choosable => {
      const stored = inputs.inputs.get(edge.personId);
      const chart = stored === undefined ? null : storedChartOf(stored, edge.label);
      const stem = chart !== null && chart.ok ? chart.saju.pillars.dayMaster : null;
      return {
        personId: edge.personId,
        label: edge.label,
        isSelfPerson: edge.personId === account.selfPersonId,
        stem,
        element: stem === null ? null : STEM_INFO[stem].element,
      };
    })
    .toSorted((x, y) => Number(y.isSelfPerson) - Number(x.isSelfPerson));

  return { kind: 'ok', value: { state: account.state, people, compats: readings.filter((one) => one.kind === 'private') } };
}

/** 못 읽은 것과 「모른다」를 한 값으로 내지 않는다 — 합치면 다음 누름이 멀쩡한 값을 지운다(`pairRelationFor`) */
export type RelationRead = { ok: true; relation: Relation | null } | { ok: false };

export async function readPairRelation(personA: string, personB: string): Promise<RelationRead> {
  if (supabase === null) return { ok: false };
  const { data, error } = await supabase.rpc('pair_relation_of', { p_person_a: personA, p_person_b: personB });
  return error !== null ? { ok: false } : { ok: true, relation: relationOf(data) };
}

export type PairSide = { readonly from: 'saved'; readonly personId: string } | { readonly from: 'typed'; readonly query: Query };
export type PairAnswers = { readonly a?: string | null; readonly b?: string | null };
export type PairOpened =
  | { ok: true; personA: string; personB: string }
  | { ok: false; kind: 'failed'; message: string }
  | { ok: false; kind: 'same-chart'; side: 'a' | 'b'; same: SameChart };

/**
 * 고른 두 사람으로 **궁합 화면을 연다** — 저장하지 않고. 차례와 거절은 `openPairScreen` 과 같고, 자격 · 판본은 DB 가 든다.
 *
 * @param relation `undefined` 는 「안 건드렸다」다 — 「모른다」(`null`)와 가른다. 안 건드린 것을 답으로 읽으면 적어 둔 답이 지워진다.
 */
export async function openPair(a: PairSide, b: PairSide, relation: Relation | null | undefined, answered: PairAnswers = {}): Promise<PairOpened> {
  if (supabase === null) return { ok: false, kind: 'failed', message: NOT_READY };

  const sides = [
    ['a', a],
    ['b', b],
  ] as const;
  for (const [, side] of sides) {
    if (side.from !== 'typed') continue;
    const refused = missingAnswer(side.query) ?? unsupportedForSaving(side.query);
    if (refused !== null) return { ok: false, kind: 'failed', message: refused };
  }

  const use: { a?: string | null; b?: string | null } = { ...answered };
  for (const [key, side] of sides) {
    if (side.from === 'saved') {
      use[key] = side.personId;
      continue;
    }
    if (use[key] !== undefined) continue;

    /* 못 물었으면 궁합을 열지 않는다. 목록에 선 사람일 때만 묻고, 궁합만 보려고 만든 사람은 그대로 쓴다 */
    const found = await findSameChart(side.query);
    if (!found.ok) return { ok: false, kind: 'failed', message: found.message };
    if (found.same === null) continue;
    if (found.same.listed) return { ok: false, kind: 'same-chart', side: key, same: found.same };
    use[key] = found.same.personId;
  }

  const { data, error } = await supabase.rpc(
    'create_pair_for_reading',
    rpcArgs<'create_pair_for_reading'>({
      ...pairSeatArgs(a.from === 'typed' ? a.query : null, 'a'),
      ...pairSeatArgs(b.from === 'typed' ? b.query : null, 'b'),
      p_relation: relation === undefined ? null : relationOf(relation),
      p_a_person: use.a ?? null,
      p_b_person: use.b ?? null,
      /* 목록에 안 세운다 — 이 누름은 궁합을 보려는 것이지 사람을 저장하려는 것이 아니다 */
      p_listed: false,
    }),
  );
  if (error !== null) return { ok: false, kind: 'failed', message: userFacingDbMessage(error, 'create_pair_for_reading') };

  const pair = ((data ?? []) as { person_a: string; person_b: string }[])[0];
  if (pair === undefined) return { ok: false, kind: 'failed', message: '두 사람의 궁합을 열지 못했어요. 잠시 뒤 다시 시도해 주세요.' };

  /* 「모른다」로 되돌리는 것도 답이다 — 문은 사이를 적기만 하므로 여기서 지운다 */
  if (relation === null) {
    const cleared = await supabase.rpc(
      'set_pair_relation',
      rpcArgs<'set_pair_relation'>({ p_person_a: pair.person_a, p_person_b: pair.person_b, p_relation: null }),
    );
    if (cleared.error !== null) return { ok: false, kind: 'failed', message: userFacingDbMessage(cleared.error, 'set_pair_relation') };
  }

  return { ok: true, personA: pair.person_a, personB: pair.person_b };
}

/** 이 쌍에 이미 난 궁합풀이 — 글 본문은 풀이 화면이 읽는다. 여기는 지표의 눈금 · 점수 · 한 줄만 쓴다 */
export type PairReading = {
  readonly score: number | null;
  readonly metaphor: string | null;
  readonly fromCurrentChart: boolean;
  readonly scoreScale: { readonly baseline: number | null; readonly version: string | null; readonly relation: string | null };
};

export type PairOutcome =
  | { kind: 'same' }
  | { kind: 'not-found' }
  | { kind: 'blocked'; state: AccountState }
  | { kind: 'unreadable'; message: string }
  | {
      kind: 'ok';
      personA: string;
      personB: string;
      names: { a: string; b: string };
      charts: { a: Saju; b: Saju };
      relation: RelationRead;
      reading: PairReading | null;
    };

/** 궁합 결과가 읽는 것 — 없는 사람과 못 보는 사람이 같은 답이고, 못 읽는 입력은 메우지 않는다(`app/me/compat/screen.tsx`) */
export async function readPair(a: string, b: string): Promise<Read<PairOutcome>> {
  const session = await signedIn();
  if (session.kind !== 'ok') return session;
  if (supabase === null) return { kind: 'failed', message: NOT_READY };
  if (a === b) return { kind: 'ok', value: { kind: 'same' } };

  const [account, edges] = await Promise.all([readAccount(), readEdges()]);
  if (!edges.ok) return { kind: 'failed', message: edges.message };
  if (isBlocked(account.state)) return { kind: 'ok', value: { kind: 'blocked', state: account.state } };

  const edgeOf = (id: string) => edges.edges.find((edge) => edge.personId.toLowerCase() === id.toLowerCase());
  const first = edgeOf(a);
  const second = edgeOf(b);
  if (first === undefined || second === undefined) return { kind: 'ok', value: { kind: 'not-found' } };

  const inputs = await readInputs([first.personId, second.personId]);
  if (!inputs.ok) return { kind: 'failed', message: inputs.message };
  const storedA = inputs.inputs.get(first.personId);
  const storedB = inputs.inputs.get(second.personId);
  if (storedA === undefined || storedB === undefined) return { kind: 'ok', value: { kind: 'not-found' } };

  const chartA = storedChartOf(storedA, first.label);
  const chartB = storedChartOf(storedB, second.label);
  if (!chartA.ok) return { kind: 'ok', value: { kind: 'unreadable', message: chartA.message } };
  if (!chartB.ok) return { kind: 'ok', value: { kind: 'unreadable', message: chartB.message } };

  const [relation, written] = await Promise.all([
    readPairRelation(first.personId, second.personId),
    supabase.rpc('my_reading', rpcArgs<'my_reading'>({ p_kind: 'private', p_person_a: first.personId, p_person_b: second.personId, p_match_id: null })),
  ]);
  if (written.error !== null) return { kind: 'failed', message: userFacingDbMessage(written.error, 'my_reading') };

  const row = (written.data ?? [])[0];
  return {
    kind: 'ok',
    value: {
      kind: 'ok',
      personA: first.personId,
      personB: second.personId,
      names: { a: first.label, b: second.label },
      charts: { a: chartA.saju, b: chartB.saju },
      relation,
      reading:
        row === undefined
          ? null
          : {
              score: row.score ?? null,
              /* 글은 자리 호칭으로 온다 — 두 사람에게 붙인 지금의 이름으로 바꿔 세운다(`app/me/compat/screen.tsx`) */
              metaphor: listedPairSummary(
                row.metaphor ?? null,
                pairSeatsOf({ personId: first.personId, name: first.label }, { personId: second.personId, name: second.label }),
              ),
              fromCurrentChart: row.from_current_chart,
              scoreScale: { baseline: row.score_baseline ?? null, version: row.score_version ?? null, relation: row.score_relation ?? null },
            },
    },
  };
}
