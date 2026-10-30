import { accountFailureOf, accountNoticeOf, accountStateOf } from '@account/index';
import { SUPPORT_EMAIL } from '@brand';
import { userFacingDbMessage } from '@db-error';
import type { Query } from '@input/query';
import { UNREADABLE_INPUT_NOTE, storedChartOf, type StoredInput } from '@input/stored';
import { focusOf, type PhotoFocus } from '@profile';
import type { Saju, Stem } from '@saju';
import { isFirstVisit } from '@web-home/first-visit';

import { supabase } from '@/auth/client';
import { NOT_READY } from '@/auth/signup';

const PERSON_INPUT_COLUMNS = 'calendar, original_date, solar_date, birth_time, gender, city, late_night_rule, time_basis';

export type ReadingRow = {
  kind: string;
  personA: string | null;
  personB: string | null;
  label: string | null;
  metaphor: string | null;
  score: number | null;
  createdAt: string;
  stale: boolean;
  stem: Stem | null;
};

export type HomePerson = {
  personId: string;
  label: string;
  note: string | null;
  chart: { ok: true; saju: Saju } | { ok: false; message: string };
  reading: ReadingRow | null;
  making: boolean;
  score: number | null;
};

/** 내 사진 — 꾸밈이라 못 읽으면 사진 없는 나로 선다(ADR 0078). 대표 한 장의 보일 자리까지 */
export type SelfFace = { userId: string; hasPhoto: boolean; focus: PhotoFocus | undefined };

export type SelfCardData =
  | { kind: 'failed'; message: string }
  | { kind: 'unreadable'; message: string; note: string }
  | { kind: 'ok'; personId: string; label: string; query: Query; saju: Saju; metaphor: string | null; hasReading: boolean; making: boolean; face: SelfFace | null };

export type Home =
  | { kind: 'failed'; message: string }
  | { kind: 'sign-in'; message: string }
  | { kind: 'notice'; title: string; detail: string }
  /** 내 사주가 아직 없다 */
  | { kind: 'no-self'; nickname: string }
  | {
      kind: 'home';
      self: SelfCardData;
      firstVisit: boolean;
      running: readonly { key: string; name: string }[];
      received: readonly ReadingRow[];
      people: readonly HomePerson[];
      slots: { limit: number; used: number; remaining: number } | null;
    };

const faceOf = (userId: string | undefined, photos: readonly { focus_x: number; focus_y: number }[]): SelfFace | null =>
  userId === undefined
    ? null
    : { userId, hasPhoto: photos.length > 0, focus: photos.length > 0 ? focusOf(photos[0].focus_x, photos[0].focus_y) : undefined };

const called = (label: string | null) => label ?? '이름 없음';

/** 웹의 `runningName` 과 같은 갈래다 — `scripts/mobile-shell-copy.test.ts` 가 글자를 잰다 */
function runningName(row: { kind: string; label_a: string | null; label_b: string | null }): string | null {
  switch (row.kind) {
    case 'self':
      return '내 사주풀이';
    case 'person':
      return row.label_a === null ? '사주풀이' : `${row.label_a} 사주풀이`;
    case 'private':
      return `${called(row.label_a)} × ${called(row.label_b)} 궁합풀이`;
    case 'match':
      return row.label_a === null ? '인연 궁합' : `${row.label_a} 님과의 인연 궁합`;
    default:
      return null;
  }
}

/** 읽기가 답 없이 던진 때 — 계정을 못 물은 때와 같은 글자로 다시 시도를 세운다 */
export function homeUnreachable(): Home {
  return { kind: 'failed', message: accountFailureOf({ kind: 'unreachable' })?.line ?? NOT_READY };
}

/**
 * 홈 — 웹의 `app/me/(home)/page.tsx` 와 같은 문을 같은 차례로 읽는다. 정책이 내 것만 내주므로 `user_id` 를 안 적는다.
 * 엣지 · 입력 · 목록은 본체라 못 읽으면 실패이고, 자리 수와 만드는 중인 풀이는 부속이라 빠진 채 선다.
 *
 * 웹이 홈을 열 때 함께 부르는 참여 열기는 화면이 앱의 문으로 따로 부른다(`openParticipation`, ADR 0211).
 */
export async function readHome(): Promise<Home> {
  if (supabase === null) return { kind: 'failed', message: NOT_READY };

  const account = await supabase.from('app_user').select('status, self_person_id, nickname').maybeSingle();
  if (account.error !== null) console.error('app_user', account.error.code);
  const suspension = account.data?.status === 'suspended' ? await supabase.rpc('my_suspension') : null;
  const found = suspension?.data?.[0];
  const state = accountStateOf(
    account.error !== null
      ? { ok: false, reason: 'unreachable' }
      : account.data === null
        ? { ok: false, reason: 'missing' }
        : {
            ok: true,
            account: {
              status: account.data.status,
              selfPersonId: account.data.self_person_id,
              suspension: account.data.status === 'suspended' ? (found === undefined ? null : { nickname: found.nickname, reason: found.reason }) : undefined,
            },
          },
  );

  const failure = accountFailureOf(state);
  if (failure !== null) return failure.next === 'signIn' ? { kind: 'sign-in', message: failure.line } : { kind: 'failed', message: failure.line };
  const notice = accountNoticeOf(state, SUPPORT_EMAIL);
  if (notice !== null) return { kind: 'notice', ...notice };
  if (state.kind !== 'active' || state.selfPersonId === null) return { kind: 'no-self', nickname: account.data?.nickname ?? '' };
  const selfPersonId = state.selfPersonId;

  const [edges, readings, running, slots, photos, session] = await Promise.all([
    supabase.from('user_person_access').select('person_id, local_label, note, listed').order('created_at', { ascending: true }),
    supabase.rpc('my_readings'),
    supabase.rpc('my_running_readings'),
    supabase.rpc('my_person_slots'),
    supabase.rpc('my_photos'),
    supabase.auth.getSession(),
  ]);
  if (edges.error !== null) return { kind: 'failed', message: userFacingDbMessage(edges.error, 'user_person_access.select') };
  if (readings.error !== null) return { kind: 'failed', message: userFacingDbMessage(readings.error, 'my_readings') };

  const selfEdge = (edges.data ?? []).find((edge) => edge.person_id === selfPersonId) ?? null;
  const listed = (edges.data ?? []).filter((edge) => edge.listed && edge.person_id !== selfPersonId);

  const persons = await supabase
    .from('person')
    .select(`id, ${PERSON_INPUT_COLUMNS}`)
    .in('id', [selfPersonId, ...listed.map((edge) => edge.person_id)]);
  if (persons.error !== null) return { kind: 'failed', message: userFacingDbMessage(persons.error, 'person.select.in') };
  /* 여덟 칸은 함께 차거나 함께 빈다 — 한 칸이 답을 든다(`app/me/person-input.ts`) */
  const inputs = new Map(
    ((persons.data ?? []) as unknown as (StoredInput & { id: string })[])
      .filter((row) => row.calendar !== null)
      .map((row) => [row.id, row as StoredInput]),
  );

  const rows: ReadingRow[] = (readings.data ?? []).map((row) => ({
    kind: row.kind,
    personA: row.person_a ?? null,
    personB: row.person_b ?? null,
    label: row.label_a ?? null,
    metaphor: row.metaphor ?? null,
    score: row.score ?? null,
    createdAt: row.created_at,
    stale: !row.from_current_chart,
    stem: (row.day_master_a ?? null) as Stem | null,
  }));
  const runningRows = running.error === null ? (running.data ?? []) : [];
  const selfReading = rows.find((row) => row.kind === 'self') ?? null;

  const selfInput = inputs.get(selfPersonId);
  const stood = selfInput !== undefined && selfEdge !== null ? storedChartOf(selfInput, selfEdge.local_label) : null;
  const self: SelfCardData =
    stood === null
      ? { kind: 'failed', message: '내 사주를 불러오지 못했어요.' }
      : !stood.ok
        ? { kind: 'unreadable', message: stood.message, note: UNREADABLE_INPUT_NOTE }
        : {
            kind: 'ok',
            personId: selfPersonId,
            label: stood.query.name,
            query: stood.query,
            saju: stood.saju,
            metaphor: selfReading?.metaphor ?? null,
            hasReading: selfReading !== null,
            making: runningRows.some((row) => row.kind === 'self'),
            face: faceOf(session.data.session?.user.id, photos.error === null ? (photos.data ?? []) : []),
          };

  const people: HomePerson[] = listed.map((edge) => {
    const stored = inputs.get(edge.person_id);
    const chart = stored === undefined ? ({ ok: false, message: '출생 정보를 불러오지 못했어요.' } as const) : storedChartOf(stored, edge.local_label);
    const pair = rows.find(
      (row) =>
        row.kind === 'private' &&
        ((row.personA === selfPersonId && row.personB === edge.person_id) || (row.personB === selfPersonId && row.personA === edge.person_id)),
    );
    return {
      personId: edge.person_id,
      label: edge.local_label,
      note: edge.note,
      chart: chart.ok ? { ok: true, saju: chart.saju } : { ok: false, message: chart.message },
      reading: rows.find((row) => row.kind === 'person' && row.personA === edge.person_id) ?? null,
      making: runningRows.some((row) => row.kind === 'person' && row.person_a === edge.person_id),
      score: pair?.score ?? null,
    };
  });

  const one = slots.error === null ? slots.data?.[0] : undefined;

  return {
    kind: 'home',
    self,
    firstVisit: isFirstVisit({ readings: rows, running: runningRows, people: listed.length }),
    running: runningRows.flatMap((row) => {
      const name = runningName({ kind: row.kind, label_a: row.label_a ?? null, label_b: row.label_b ?? null });
      return name === null ? [] : [{ key: `${row.kind}:${row.created_at}`, name }];
    }),
    received: rows.filter((row) => row.kind === 'person'),
    people,
    slots: one === undefined ? null : { limit: one.person_limit, used: one.used, remaining: one.remaining },
  };
}

/** 웹의 `readingDate` 와 같다 */
export const readingDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' });
