import Link from 'next/link';
import { redirect } from 'next/navigation';

import { isBlocked, selfPersonIdOf } from '@/src/lib/account';

import { CALENDAR_KO, GENDER_KO, STEM_INFO, type Saju } from '@/src/lib/saju';

import { supabaseOnServer } from '../../auth/server-client';
import { dbFailure } from '../../db-error';
import { isoOf, solarDateOf } from '@/src/lib/input/chart';
import { HOUR_UNKNOWN_LABEL, type Query } from '@/src/lib/input/query';
import { UNREADABLE_INPUT_NOTE, storedChartOf } from '@/src/lib/input/stored';
import { READING_STALE_LABEL } from '@/src/lib/reading/notes';
import { storedInputsOf } from '../person-input';
import { managedEdges, personSlotsFrom } from '../../person-slots';
import { myReadings, type ReadingEntry } from '../reading/current';
import { readingHref } from '../reading/line';
import { AccountNotice } from '../account-notice';
import { readAccount } from '../account';
import { AddPerson } from './manage';
import { PeopleFinder } from './finder';
import { PersonActions } from './person-menu';
import { DayMasterChip, PillarStrip } from './chart-bits';
import { compatHrefFor } from './compat-href';
import { elementScope } from '../../element-tone';
import { BUTTON_ON_TILE, BUTTON_ON_TILE_PRIMARY, BUTTON_SECONDARY_SMALL } from '../../ui/buttons';
import { ElementSymbol } from '../../ui/element-symbol';
import { Icon } from '../../ui/icons';
import { EMPTY_SLOT, STALE_CHIP, TILE, TYPE_META, TYPE_NAME, TYPE_TITLE } from '../../ui/surfaces';

/*
  **이 화면의 이름은 「저장한 사람」 하나다.**

  탭 제목은 「등록한 사람」, h1 은 「저장한 사람」, 궁합 탭에서는 「내 사람」이라 한
  화면을 세 이름으로 부르고 있었다. 「등록」은 관리·DB 쪽 말이고 「내 사람」은 관계의
  뜻이 너무 세다 — 여기 있는 것은 내가 **저장해 둔** 사람들이다(ADR 0027).

  「등록하다」는 동사로 남는다(「사람 등록하기」·「등록할 수 있는 자리」). 목록의
  이름과 그 목록에 넣는 동작은 다른 말이라 같은 낱말일 이유가 없다.
*/
export const metadata = {
  title: '저장한 사람',
  description: '가족·친구의 사주를 한 계정에서 관리합니다.',
};

/**
 * 가족·친구 Person 을 관리하는 자리.
 *
 * selfPerson 은 여기 없다. 「내가 관리하는 사람」의 목록이고 나는 `/me` 에 있다 —
 * 저장 자리 한도가 세는 것도 정확히 이 목록이다(`enforce_person_limit`).
 *
 * **여기서 「전체 명식 보기」로 넘기지 않는다.** 그 링크는 입력을 주소의 `#` 뒤에
 * 싣는데(`/me` 가 자기 것에 그렇게 한다), 남이 등록해 준 가족의 생년월일시가
 * 주소창에 실리는 것은 ADR 0007 이 익명 링크에서 막으려던 것과 같은 일이다.
 * 여덟 글자는 서버가 계산해 여기 놓고, 두 사람을 함께 보는 것은 `/me/compat` 이다.
 * 궁합으로 넘기는 링크도 **person id 만** 싣는다(`compatHrefFor`).
 */
export default async function PeoplePage() {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  /** 몇 자리 남았는지는 **DB 가 센다** — 화면이 빼기를 하면 selfPerson 을 잊는 자리가 생긴다 */
  const [slotRow, { state }, { data: edges, error: edgesError }, made] = await Promise.all([
    // eslint-disable-next-line no-restricted-syntax -- 옛 자리(ADR 0085): 문으로 옮기면 지운다
    supabase.rpc('my_person_slots'),
    readAccount(supabase),
    /*
      정책이 자기 목록만 내준다 — `user_id` 를 여기서 또 적지 않는다.

      **목록에 서는 사람만 읽는다**(`listed`). 궁합만 보려고 만든 사람도 내 엣지이지만
      사용자가 저장한 적 없는 사람이고, 그 사람이 여기 서면 「내가 등록한 적 없는 것이
      목록에 있다」가 된다. 그 궁합은 풀이 목록에 선다.
    */
    // eslint-disable-next-line no-restricted-syntax -- 옛 자리(ADR 0085): 문으로 옮기면 지운다
    supabase
      .from('user_person_access')
      .select('person_id, local_label, note')
      .eq('listed', true)
      .order('created_at', { ascending: true }),
    /*
      **풀이는 카드마다 묻지 않는다.** 사람 열이면 열 번 묻게 되고, 그 열 번이 같은
      한 표를 본다. 목록 화면이 이미 쓰는 한 번(`my_readings`)으로 전부 덮는다 —
      차례도 좁힘도 거기서 정해진 그대로 쓰고 여기서 다시 판정하지 않는다.
    */
    myReadings(),
  ]);
  /* 목록이 이 화면의 본체다 — 못 읽은 것을 빈 목록으로 세우면 내 사람들이 지워진 것으로 읽힌다(ADR 0078) */
  if (edgesError) throw dbFailure(edgesError, 'user_person_access.listed');

  const selfPersonId = selfPersonIdOf(state);

  const readings = new Map(
    made
      .filter((one) => one.kind === 'person' && one.personA !== null)
      .map((one) => [one.personA as string, one]),
  );

  /**
   * 나 × 그 사람의 궁합풀이 — 최근 것이 앞이라 **처음 만난 것이 가장 최근이다.** 있으면 타일의 궁합 단추가
   * 점수를 달고 그 글로 곧장 간다. 같은 한 번(`my_readings`)에서 꺼낸다.
   */
  const pairs = new Map<string, ReadingEntry>();
  if (selfPersonId !== null) {
    for (const one of made) {
      if (one.kind !== 'private') continue;
      const other =
        one.personA === selfPersonId ? one.personB : one.personB === selfPersonId ? one.personA : null;
      if (other !== null && !pairs.has(other)) pairs.set(other, one);
    }
  }

  /**
   * 중지된 계정에는 목록이 **비어서** 온다(정책이 막는다). 빈 목록과 「등록한 사람이
   * 없다」가 같은 화면이면 사용자는 자기 자료가 지워진 줄 안다. 그래서 여기서 한 번 더
   * 말한다 — 막는 것은 정책이고, 화면은 그 사실을 옮기기만 한다.
   */
  const slots = personSlotsFrom(slotRow.data, slotRow.error);

  const blocked = isBlocked(state);

  /** 온보딩이면 `null` 이고, 그때는 뺄 자기 것이 없다 — 목록은 그대로 선다 */
  const managed = managedEdges(edges, selfPersonId ?? undefined);
  const people = blocked ? [] : await peopleWithCharts(managed);

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-6 py-8 sm:gap-8 sm:py-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className={TYPE_TITLE}>저장한 사람</h1>
          <p className="text-[15px] leading-6 text-secondary">
            가족이나 친구의 출생 정보를 저장하고 관리하세요.
            {slots !== null && (
              <span className="ml-2 whitespace-nowrap text-[13px] font-semibold tabular-nums">
                {slots.used}/{slots.limit}명
              </span>
            )}
          </p>
        </div>
        <Link href="/compat" className={`${BUTTON_SECONDARY_SMALL} self-start sm:self-auto`}>
          <Icon name="heart" className="size-4" />
          궁합 보러 가기
        </Link>
      </header>

      {blocked ? (
        <AccountNotice state={state} />
      ) : (
        <>
          <AddPerson slots={slots} />
          <PeopleList people={people} readings={readings} pairs={pairs} selfPersonId={selfPersonId} />
        </>
      )}
    </main>
  );
}

function PeopleList({
  people,
  readings,
  pairs,
  selfPersonId,
}: {
  people: Person[];
  /** 사람 하나에 지금 글 하나 — 대상별로 묶어 두고 카드마다 한 번 꺼낸다 */
  readings: ReadonlyMap<string, ReadingEntry>;
  pairs: ReadonlyMap<string, ReadingEntry>;
  selfPersonId: string | null;
}) {
  if (people.length === 0) {
    return (
      <p className={`${EMPTY_SLOT} text-[15px] leading-6 text-secondary`}>
        아직 저장한 사람이 없습니다. 이름과 출생 정보를 입력해 사람을 추가해 보세요.
      </p>
    );
  }

  /* 여섯부터 목록 위에 찾는 칸이 선다 — 카드는 여기서 그리고 칸은 숨기기만 한다(`finder.tsx`) */
  return (
    <PeopleFinder
      people={people.map((person) => ({
        personId: person.personId,
        label: person.local_label,
        card: (
          <PersonCard
            person={person}
            reading={readings.get(person.personId) ?? null}
            pair={pairs.get(person.personId) ?? null}
            selfPersonId={selfPersonId}
          />
        ),
      }))}
    />
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
  chart: { ok: true; query: Query; saju: Saju } | { ok: false; message: string };
};

/**
 * 목록에 설 사람들 — **명식까지 여기서 세운다.**
 *
 * 카드가 다시 `chartOf` 를 부르지 않는 것이 요점이다. 부르면 같은 입력을 두 번 세는
 * 자리가 생기고, 그 둘은 엔진을 고치는 날 갈릴 수 있다.
 */
async function peopleWithCharts(edges: Edge[]): Promise<Person[]> {
  if (edges.length === 0) return [];

  const supabase = await supabaseOnServer();
  const byPerson = await storedInputsOf(
    supabase,
    edges.map((edge) => edge.person_id),
  );

  return edges.map((edge) => {
    const stored = byPerson.get(edge.person_id);

    return {
      ...edge,
      personId: edge.person_id,
      /* 입력이 없는 사람 — 읽을 것이 없다는 말과 못 읽는다는 말을 여기서 합친다 */
      chart:
        stored === undefined
          ? ({ ok: false, message: '저장된 출생 정보를 읽지 못했습니다.' } as const)
          : storedChartOf(stored, edge.local_label),
    };
  });
}

/**
 * 한 사람 = **그 사람의 일간 오행 색을 입은 한 장의 타일**(부드러움, 홈의 사람 타일과 같은 말투).
 *
 * 열 명이 모이면 색의 배열만으로 누가 어느 기운인지 갈린다. 그래도 색 혼자 말하지 않게 딱지에 상징 · 일간 글자 ·
 * 오행 이름을 함께 둔다(`DayMasterChip`).
 *
 * **타일이 곧 상세로 가는 길이다** — 이름 링크의 `after:` 가 타일 전체를 덮는다. 그 위로 뜨는 것은 셋이다:
 * 풀이 · 궁합 단추 줄, 오른쪽 위 구석의 관리 메뉴, 메뉴가 연 칸. 손대는 것(수정 · 메모 · 빼기)은 여전히 그
 * 구석 하나로 물러나 읽는 자리 위에 얹히지 않는다.
 *
 * 홈의 타일보다 한 겹 더 든다 — 이 화면은 관리하는 자리라 **태어난 날과 곳 · 메모**를 타일이 직접 보인다.
 * 적어 둔 메모를 여는 버튼 이름으로만 말하면 접힌 것이 빈 것으로 읽힌다.
 */
function PersonCard({
  person,
  reading,
  pair,
  selfPersonId,
}: {
  person: Person;
  reading: ReadingEntry | null;
  /** 나 × 이 사람의 궁합풀이 — 있으면 궁합 단추가 점수를 달고 그 글로 간다 */
  pair: ReadingEntry | null;
  selfPersonId: string | null;
}) {
  const note = person.note?.trim() ?? '';
  const element = person.chart.ok ? STEM_INFO[person.chart.saju.pillars.dayMaster].element : null;

  return (
    <section className={`${elementScope(element)} ${TILE} relative flex h-full flex-col gap-3 sm:p-5`}>
      {/* 큰 상징 하나가 모서리에 옅게 번진다 — 장식이라 누름도 보조기기도 지나간다 */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.5rem]">
        <ElementSymbol element={element} className="absolute -bottom-6 -right-6 size-32 opacity-[0.14]" />
      </div>

      <div className="flex min-h-11 items-center pr-14">
        {person.chart.ok ? (
          <DayMasterChip stem={person.chart.saju.pillars.dayMaster} />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-[color-mix(in_srgb,var(--surface)_72%,transparent)]">
            <ElementSymbol element={null} className="size-5" />
          </span>
        )}
      </div>

      <div className="min-w-0">
        <h2 className={`${TYPE_NAME} truncate`}>
          <Link
            href={`/me/people/${person.personId}`}
            className="after:absolute after:inset-0 after:rounded-[1.5rem] after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-[3px] focus-visible:after:outline-[color-mix(in_srgb,var(--accent)_45%,transparent)]"
          >
            {person.local_label}
          </Link>
        </h2>
        {person.chart.ok && <BirthLines query={person.chart.query} />}
      </div>

      {note !== '' && (
        <p className="rounded-2xl bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] px-3 py-2 text-[13px] leading-5 text-foreground">
          <span className="mr-1.5 text-[12px] font-semibold text-[var(--ink)]">메모</span>
          {note}
        </p>
      )}

      {person.chart.ok ? (
        <>
          <PillarStrip pillars={person.chart.saju.pillars} name={person.local_label} />
          {reading !== null && (
            <p className="line-clamp-2 text-[13px] leading-5">
              {!reading.fromCurrentChart && (
                <span className={`mr-1 ${STALE_CHIP}`}>{READING_STALE_LABEL}</span>
              )}
              {reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}
            </p>
          )}
          <div className="relative z-10 mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-2 pt-1">
            <Link
              href={`/me/readings/${person.personId}`}
              className={`${reading === null ? BUTTON_ON_TILE_PRIMARY : BUTTON_ON_TILE} min-w-0`}
            >
              <Icon name="reading" className="size-4 shrink-0" />
              <span className="truncate">{reading === null ? '사주풀이 받기' : '사주풀이 보기'}</span>
            </Link>
            <Link
              href={pair !== null ? readingHref(pair) : compatHrefFor(selfPersonId, person.personId)}
              className={`${BUTTON_ON_TILE} px-3.5`}
              aria-label={pair?.score != null ? `나와 궁합 ${pair.score}점` : '나와 궁합'}
            >
              <Icon name="heart" className="size-4" />
              {pair?.score != null ? <span className="tabular-nums">{pair.score}점</span> : '궁합'}
            </Link>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-sm">{person.chart.message}</p>
          <p className={TYPE_META}>{UNREADABLE_INPUT_NOTE}</p>
        </div>
      )}

      {/* 못 읽는 판본은 고치는 폼도 못 채운다 — 빈 폼을 주면 그 값이 새 판본으로 굳는다 */}
      <PersonActions
        personId={person.personId}
        label={person.local_label}
        note={person.note ?? ''}
        current={person.chart.ok ? person.chart.query : null}
      />
    </section>
  );
}

/** 태어난 날 · 시각, 그리고 성별 · 곳 — 관리하는 화면이라 그 사람을 다시 알아보는 단서를 타일이 든다 */
function BirthLines({ query }: { query: Query }) {
  return (
    <>
      <p className={`${TYPE_META} mt-0.5 tabular-nums`}>
        {query.calendar === 'solar' ? query.date : `${CALENDAR_KO[query.calendar]} ${query.date}`}
        {query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` · ${query.time}`}
      </p>
      <p className={TYPE_META}>
        {GENDER_KO[query.gender]} · {query.city}
      </p>
      {query.calendar !== 'solar' && (
        <p className={`${TYPE_META} tabular-nums`}>계산에 쓴 양력 날짜 · {isoOf(solarDateOf(query))}</p>
      )}
    </>
  );
}
