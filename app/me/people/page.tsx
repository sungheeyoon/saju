import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CALENDAR_KO, ELEMENT_KO, GENDER_KO, STEM_INFO } from '@/src/lib/saju';

import { supabaseOnServer } from '../../auth/server-client';
import { chartOf, solarDateOf } from '../../chart';
import type { Query } from '../../query';
import { UnreadableRevisionError, queryFromRevision, type StoredRevision } from '../../revision';
import { ReviseChart } from '../revise';
import { Halted } from '../halted';
import { AddPerson, NoteForm, RemoveFromList } from './manage';

export const metadata = {
  title: '등록한 사람 — 만세력',
  description: '가족·친구의 사주를 한 계정에서 관리합니다.',
};

/** 한도는 DB 가 든다. 여기 있는 수는 **남은 자리를 세어 보여주기 위한 것뿐**이다 */
const PERSON_LIMIT = 20;

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

  const [{ data: account }, { data: edges }] = await Promise.all([
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
  const suspended = account !== null && account.status !== 'active';

  const managed = (edges ?? []).filter((edge) => edge.person_id !== account?.self_person_id);
  const people = suspended ? [] : await peopleWithCharts(managed);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">등록한 사람</h1>
        <p className="text-sm text-secondary">
          가족·친구의 사주를 여기서 관리합니다. {people.length}/{PERSON_LIMIT}명.
        </p>
        <p className="flex flex-wrap gap-4 text-sm">
          <Link href="/me" className="text-accent underline underline-offset-2">
            내 사주
          </Link>
          <Link href="/me/compat" className="text-accent underline underline-offset-2">
            저장된 사람끼리 궁합
          </Link>
          <Link href="/me/discovery" className="text-accent underline underline-offset-2">
            후보
          </Link>
        </p>
      </header>

      {suspended ? (
        <Halted status={account?.status ?? 'suspended'} />
      ) : (
        <>
          <AddPerson remaining={PERSON_LIMIT - people.length} />
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
          아직 등록한 사람이 없습니다. 부를 이름과 생년월일시를 넣으면 여기에 쌓입니다.
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
    return { ok: false, message: '저장된 출생정보를 읽지 못했습니다.' };
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
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      {person.chart.ok ? (
        <ChartSummary query={person.chart.query} />
      ) : (
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{person.local_label}</h2>
          <p className="text-sm">{person.chart.message}</p>
          <p className="text-xs text-muted">
            저장된 값은 그대로 있습니다. 지금 화면이 그 값을 읽지 못하는 것입니다.
          </p>
        </div>
      )}

      <NoteForm personId={person.personId} note={person.note ?? ''} />

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
        {/* 못 읽는 판본은 고치는 폼도 못 채운다 — 빈 폼을 주면 그 값이 새 판본으로 굳는다 */}
        {person.chart.ok && <ReviseChart personId={person.personId} current={person.chart.query} />}
        <RemoveFromList personId={person.personId} label={person.local_label} />
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
                {pillar === null ? <span className="text-sm text-muted">시각 모름</span> : pillar.name}
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
        {query.hourKnown === false ? ' · 시각 모름' : ` ${query.time}`} · {GENDER_KO[query.gender]} ·{' '}
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
