import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CALENDAR_KO, ELEMENT_KO, GENDER_KO, STEM_INFO } from '@/src/lib/saju';

import { supabaseOnServer } from '../../auth/server-client';
import { chartOf, solarDateOf } from '../../chart';
import { HOUR_UNKNOWN_LABEL, type Query } from '../../query';
import {
  UNREADABLE_REVISION_NOTE,
  UnreadableRevisionError,
  queryFromRevision,
  type StoredRevision,
} from '../../revision';
import { managedEdges, personSlotsFrom } from '../../person-slots';
import { ReviseChart } from '../revise';
import { Halted } from '../halted';
import { AddPerson, NoteForm, RemoveFromList } from './manage';

/*
  **이 화면의 이름은 「저장한 사람」 하나다.**

  탭 제목은 「등록한 사람」, h1 은 「저장한 사람」, 궁합 탭에서는 「내 사람」이라 한
  화면을 세 이름으로 부르고 있었다. 「등록」은 관리·DB 쪽 말이고 「내 사람」은 관계의
  뜻이 너무 세다 — 여기 있는 것은 내가 **저장해 둔** 사람들이다(ADR 0027).

  「등록하다」는 동사로 남는다(「사람 등록하기」·「등록할 수 있는 스무 명」). 목록의
  이름과 그 목록에 넣는 동작은 다른 말이라 같은 낱말일 이유가 없다.
*/
export const metadata = {
  title: '저장한 사람 — 만세력',
  description: '가족·친구의 사주를 한 계정에서 관리합니다.',
};

/**
 * 가족·친구 Person 을 관리하는 자리.
 *
 * selfPerson 은 여기 없다. 「내가 관리하는 사람」의 목록이고 나는 `/me` 에 있다 —
 * 스무 명 한도가 세는 것도 정확히 이 목록이다(`enforce_person_limit`).
 *
 * **여기서 「전체 명식 보기」로 넘기지 않는다.** 그 링크는 입력을 주소의 `#` 뒤에
 * 싣는데(`/me` 가 자기 것에 그렇게 한다), 남이 등록해 준 가족의 생년월일시가
 * 주소창에 실리는 것은 ADR 0007 이 익명 링크에서 막으려던 것과 같은 일이다.
 * 여덟 글자는 서버가 계산해 여기 놓고, 두 사람을 함께 보는 것은 `/me/compat` 이다.
 */
export default async function PeoplePage() {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  /** 몇 자리 남았는지는 **DB 가 센다** — 화면이 빼기를 하면 selfPerson 을 잊는 자리가 생긴다 */
  const [slotRow, { data: account }, { data: edges }] = await Promise.all([
    supabase.rpc('my_person_slots'),
    supabase.from('app_user').select('status, self_person_id').maybeSingle(),
    // 정책이 자기 목록만 내준다 — `user_id` 를 여기서 또 적지 않는다.
    supabase
      .from('user_person_access')
      .select('person_id, local_label, note')
      .order('created_at', { ascending: true }),
  ]);

  /**
   * 중지된 계정에는 목록이 **비어서** 온다(정책이 막는다). 빈 목록과 「등록한 사람이
   * 없다」가 같은 화면이면 사용자는 자기 자료가 지워진 줄 안다. 그래서 여기서 한 번 더
   * 말한다 — 막는 것은 정책이고, 화면은 그 사실을 옮기기만 한다.
   */
  const slots = personSlotsFrom(slotRow.data, slotRow.error);

  const suspended = account !== null && account.status !== 'active';

  const managed = managedEdges(edges, account?.self_person_id);
  const people = suspended ? [] : await peopleWithCharts(managed);

  return (
    <main className="app-shell flex w-full max-w-4xl flex-1 flex-col gap-7 py-9 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">사람</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">저장한 사람</h1>
          <p className="mt-1 text-sm text-secondary">
            가족과 친구의 출생 정보를 저장하고, 각 사람의 사주나 두 사람의 궁합을 확인하세요.
            {slots !== null && (
              <span className="ml-2 text-muted">
                {slots.used}/{slots.limit}명
              </span>
            )}
          </p>
        </div>
        <Link
          href="/me/compat"
          className="rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
        >
          저장한 사람으로 궁합 보기
        </Link>
      </header>

      {suspended ? (
        <Halted status={account?.status ?? 'suspended'} />
      ) : (
        <>
          <AddPerson remaining={slots?.remaining ?? null} />
          <PeopleList people={people} />
        </>
      )}
    </main>
  );
}

function PeopleList({ people }: { people: Person[] }) {
  return (
    <>
      {people.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface-sunken p-4 text-sm text-muted">
          아직 저장한 사람이 없습니다. 부를 이름과 생년월일시를 넣으면 여기에 쌓입니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {people.map((person) => (
            <li key={person.personId}>
              <PersonCard person={person} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

type Edge = { person_id: string; local_label: string; note: string | null };

/**
 * 목록 한 사람이 든 것 — 못 읽는 판본이면 **명식 대신 그 사실을 든다.**
 *
 * 「없다」와 「못 읽었다」를 값 옆에 둔다. 기본값으로 메우면 저장할 때 본 사주와
 * 다른 사주가 이 목록에 조용히 선다.
 */
type Person = Edge & {
  personId: string;
  chart: { ok: true; query: Query } | { ok: false; message: string };
};

async function peopleWithCharts(edges: Edge[]): Promise<Person[]> {
  if (edges.length === 0) return [];

  const supabase = await supabaseOnServer();
  const personIds = edges.map((edge) => edge.person_id);

  const { data: persons } = await supabase
    .from('person')
    .select('id, current_revision_id')
    .in('id', personIds);

  const currentIds = (persons ?? [])
    .map((person) => person.current_revision_id)
    .filter((id): id is string => id !== null);

  const { data: revisions } = await supabase
    .from('person_chart_revision')
    .select(
      'id, person_id, calendar, original_date, solar_date, birth_time, gender, city, late_night_rule, time_basis',
    )
    .in('id', currentIds);

  const byPerson = new Map((revisions ?? []).map((revision) => [revision.person_id, revision]));

  return edges.map((edge) => {
    const revision = byPerson.get(edge.person_id);

    return {
      ...edge,
      personId: edge.person_id,
      chart: readChart(revision, edge.local_label),
    };
  });
}

function readChart(
  revision: (StoredRevision & { id: string }) | undefined,
  localLabel: string,
): Person['chart'] {
  if (revision === undefined) {
    return { ok: false, message: '저장된 출생 정보를 읽지 못했습니다.' };
  }

  try {
    return { ok: true, query: queryFromRevision(revision, localLabel) };
  } catch (error) {
    // 못 읽는 판본은 메우지 않는다 — 저장된 값은 그대로 있고 읽는 쪽이 못 읽는 것이다.
    if (error instanceof UnreadableRevisionError) return { ok: false, message: error.message };
    throw error;
  }
}

function PersonCard({ person }: { person: Person }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      {person.chart.ok ? (
        <ChartSummary query={person.chart.query} />
      ) : (
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{person.local_label}</h2>
          <p className="text-sm">{person.chart.message}</p>
          <p className="text-xs text-muted">{UNREADABLE_REVISION_NOTE}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
        {person.chart.ok && (
          <Link
            href={`/me/people/${person.personId}`}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-strong"
          >
            사주 상세 보기
          </Link>
        )}
        {/* 못 읽는 판본은 고치는 폼도 못 채운다 — 빈 폼을 주면 그 값이 새 판본으로 굳는다 */}
        {person.chart.ok && <ReviseChart personId={person.personId} current={person.chart.query} />}
        <RemoveFromList personId={person.personId} label={person.local_label} />
        {/* 메모는 마지막에 선다 — 열리는 칸이 `w-full` 이라 이 줄 아래로 내려간다 */}
        <NoteForm personId={person.personId} note={person.note ?? ''} />
      </div>
    </section>
  );
}

/** 여덟 글자와 넣은 값 — `/me` 의 자기 사주와 같은 것을 보여준다 */
function ChartSummary({ query }: { query: Query }) {
  const { pillars } = chartOf(query);
  const columns = [
    ['시', pillars.hour],
    ['일', pillars.day],
    ['월', pillars.month],
    ['년', pillars.year],
  ] as const;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">{query.name}</h2>
        <span className="text-xs text-muted">
          일간 <span className="glyph">{pillars.dayMaster}</span> {STEM_INFO[pillars.dayMaster].ko}{' '}
          · {ELEMENT_KO[STEM_INFO[pillars.dayMaster].element]}
        </span>
      </div>

      <table className="w-full table-fixed text-center">
        <thead>
          <tr className="text-xs text-muted">
            {columns.map(([label]) => (
              <th key={label} className="pb-1 font-normal">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {columns.map(([label, pillar]) => (
              <td key={label} className="text-2xl">
                {/* 시각을 모르면 시주가 아예 없다. 정오로 메워 午시를 내지 않는다 */}
                {pillar === null ? <span className="text-sm text-muted">{HOUR_UNKNOWN_LABEL}</span> : pillar.name}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/*
        음력으로 넣었으면 **적은 그대로와 바뀐 양력을 함께** 보여준다. 양력만 보이면
        사용자가 자기 입력을 못 알아보고, 원본만 보이면 우리가 무엇으로 계산했는지
        모른다(ADR 0002). 변환은 계산과 **같은 함수**가 한다.
      */}
      <p className="text-sm text-secondary">
        {query.calendar === 'solar'
          ? query.date
          : `${CALENDAR_KO[query.calendar]} ${query.date} · 양력 ${isoOf(solarDateOf(query))}`}
        {query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` ${query.time}`} · {GENDER_KO[query.gender]} ·{' '}
        {query.city}
      </p>
    </div>
  );
}

/** `CivilDate` 를 화면에 적을 `YYYY-MM-DD` 로 */
function isoOf({ year, month, day }: { year: number; month: number; day: number }): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}
