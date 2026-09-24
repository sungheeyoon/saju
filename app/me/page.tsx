import Link from 'next/link';
import { redirect } from 'next/navigation';

import { isBlocked } from '@/src/lib/account';
import { UNREADABLE_INPUT_NOTE, storedChartOf } from '@/src/lib/input/stored';
import type { PersonSlots } from '@/src/lib/people';
import type { Element } from '@/src/lib/saju';

import { supabaseOnServer } from '../auth/server-client';
import { elementScope } from '../element-tone';
import { BUTTON_PRIMARY, BUTTON_TERTIARY } from '../ui/buttons';
import { Icon, type IconName } from '../ui/icons';
import { BADGE, EMPTY_SLOT, TYPE_DISPLAY, TYPE_META, TYPE_SECTION } from '../ui/surfaces';
import { readAccount } from './account';
import { AccountNotice } from './account-notice';
import { openDiscoveryParticipation } from './discovery/participation';
import { myCircle } from './home/circle';
import { compatHrefOf, mapModelOf, pairWithSelf, readingOf, selfReadingOf, type HomePerson } from './home/map/model';
import { RelationMap } from './home/map/relation-map';
import { PersonTile } from './home/person-tile';
import { SelfCard } from './home/self-card';
import { Onboarding } from './onboarding';
import { storedInputOf, storedInputsOf } from './person-input';
import { myReadings } from './reading/current';
import { unreadCount } from './requests/inbox';

/**
 * 로그인한 사람이 도착하는 자리 — **홈.**
 *
 * 인사 → 관계 지도와 내 사주 → 저장한 사람 → 다른 길 셋 차례로 내려온다(2026-09-24, 부드러움 5차).
 * 머리글에서 「사주·궁합」 · 「사람」 탭이 빠졌으므로 그 길(다른 사람 사주 · 궁합 · 사람 전체 관리)은 여기 선다.
 *
 * 저장된 입력으로 **서버에서 계산한다.** 익명 화면은 브라우저에서 계산하지만 부르는 함수는 같다(`chartOf`)
 * — 저장하기 전에 본 사주와 저장한 뒤에 보는 사주가 다를 자리를 만들지 않으려는 것이다.
 */
export default async function MePage() {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  // 정책이 자기 행만 내주므로 `where` 를 적지 않는다. 적으면 판정하는 자리가 둘이 된다.
  const { state, row: account } = await readAccount<{
    status: string;
    self_person_id: string | null;
    nickname: string | null;
  }>(supabase, 'status, self_person_id, nickname');
  const selfPersonId = state.kind === 'active' ? state.selfPersonId : null;
  const nickname = account?.nickname?.trim() ?? '';

  return (
    <main className="app-shell flex min-w-0 flex-1 flex-col gap-8 py-8 sm:gap-12 sm:py-12">
      {isBlocked(state) ? (
        <AccountNotice state={state} />
      ) : (
        <>
          <Greeting name={nickname} />
          {selfPersonId === null ? (
            <Onboarding nickname={account?.nickname ?? ''} />
          ) : (
            <>
              <Unread />
              <Home selfPersonId={selfPersonId} />
              <DiscoveryDoor />
            </>
          )}
        </>
      )}
    </main>
  );
}

/**
 * 참여를 여는 문 — **아무것도 안 그린다.**
 *
 * 후보 탐색은 매칭에서만 하고, 참여를 여는 일은 홈에도 남는다(ADR 0070·0076).
 *
 * **형제로 둔다.** 페이지 본문에서 `await` 하면 이 왕복이 끝날 때까지 `Unread` 도 `Home` 도 시작을 못
 * 한다. 아무것도 안 그리는 것과 아무 때나 돌아도 되는 것은 다르다.
 */
async function DiscoveryDoor() {
  await openDiscoveryParticipation();
  return null;
}

/** 인사 한 줄 — 이 화면에서 가장 먼저 읽히는 글자. 날짜는 한국 시각이다(서버의 시계는 UTC 다) */
function Greeting({ name }: { name: string }) {
  const today = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Seoul',
  });
  return (
    <header className="flex flex-col gap-1">
      <p className={TYPE_META}>{today}</p>
      <h1 className={TYPE_DISPLAY}>{name === '' ? '반가워요' : `${name}님, 오늘도 반가워요`}</h1>
    </header>
  );
}

/**
 * 홈의 본체 — 내 사주 · 저장한 사람 · 만든 풀이를 **한 번에** 읽는다.
 *
 * 옛 홈은 내 사주 하나만 읽었다. 관계 지도와 사람 타일이 들어오며 읽을 것이 셋 늘었다(엣지 · 자리 수 ·
 * 풀이 목록) — 넷을 한 `Promise.all` 로 겹쳐 돌리고, 사람들의 입력만 엣지를 알아야 하므로 뒤에 한 번 더
 * 묶어 읽는다. 왕복은 둘이다.
 */
async function Home({ selfPersonId }: { selfPersonId: string }) {
  const supabase = await supabaseOnServer();

  const [circle, self, readings] = await Promise.all([
    myCircle(supabase, selfPersonId),
    storedInputOf(supabase, selfPersonId),
    myReadings(),
  ]);
  const inputs = await storedInputsOf(
    supabase,
    circle.people.map((person) => person.personId),
  );

  const people: HomePerson[] = circle.people.map((edge) => {
    const stored = inputs.get(edge.personId);
    /* 입력이 없는 사람 — 읽을 것이 없다는 말과 못 읽는다는 말을 여기서 합친다(저장한 사람 화면과 같다) */
    const stood =
      stored === undefined
        ? ({ ok: false, message: '저장된 출생 정보를 읽지 못했습니다.' } as const)
        : storedChartOf(stored, edge.label);
    return {
      personId: edge.personId,
      label: edge.label,
      note: edge.note,
      chart: stood.ok ? { ok: true, saju: stood.saju } : { ok: false, message: stood.message },
    };
  });

  /**
   * **못 읽는 입력은 메우지 않는다.** 모르는 출생지를 서울로 치면 저장할 때 본 사주와 다른 사주가 이
   * 화면에 나온다. 값은 남아 있고 읽는 쪽이 못 읽는 것이므로 그렇게 말하고 멈춘다 — 사람들은 그대로 선다.
   */
  const stood = self !== null && circle.self !== null ? storedChartOf(self.input, circle.self.label) : null;

  return (
    <>
      {stood === null ? (
        <p className="text-sm text-muted">저장된 사주를 읽지 못했습니다.</p>
      ) : !stood.ok ? (
        <section className="flex flex-col gap-2 rounded-[2rem] border border-border bg-surface p-5 sm:p-6">
          <p className="text-sm">{stood.message}</p>
          <p className="text-[13px] text-muted">{UNREADABLE_INPUT_NOTE}</p>
        </section>
      ) : (
        /*
          넓은 화면에서 지도(5)와 내 카드(7)가 한 줄에 서고 **같은 높이로 늘어난다**(`items-stretch`) — 두
          카드가 저마다 단추 · 범례 띠를 바닥에 붙여 아랫선까지 맞는다.
        */
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-stretch lg:gap-6">
          <RelationMap
            model={mapModelOf({ self: { personId: selfPersonId, label: stood.query.name, saju: stood.saju }, people, readings })}
            addHref="/me/people"
            canAdd={circle.slots === null || circle.slots.remaining > 0}
          />
          <SelfCard
            personId={selfPersonId}
            label={stood.query.name}
            query={stood.query}
            saju={stood.saju}
            reading={selfReadingOf(readings)}
          />
        </div>
      )}

      <SavedPeople
        people={people}
        slots={circle.slots}
        tileOf={(person) => {
          const pair = pairWithSelf(readings, selfPersonId, person.personId);
          return {
            reading: readingOf(readings, person.personId),
            compat: { href: compatHrefOf(pair, selfPersonId, person.personId), score: pair?.score ?? null },
          };
        }}
      />

      <MoreWays />
    </>
  );
}

/**
 * 저장한 사람 — 사람마다 제 일간 색의 타일 한 장. 폰 2열 · 태블릿 3열 · 넓은 화면 4열.
 *
 * 몇 자리를 썼는지는 **DB 가 센다**(`my_person_slots`) — 못 읽었으면 수를 안 세운다. 빼기를 화면이 하면
 * 내 사주를 잊는 자리가 생긴다.
 */
function SavedPeople({
  people,
  slots,
  tileOf,
}: {
  people: readonly HomePerson[];
  slots: PersonSlots | null;
  tileOf: (person: HomePerson) => Omit<Parameters<typeof PersonTile>[0], 'person'>;
}) {
  const full = slots !== null && slots.remaining <= 0;

  return (
    <section aria-labelledby="home-people" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 id="home-people" className={`${TYPE_SECTION} flex items-baseline gap-2`}>
          저장한 사람
          {slots !== null && (
            <span className="font-sans text-[13px] font-semibold tabular-nums text-secondary">
              {slots.used}/{slots.limit}명
            </span>
          )}
        </h2>
        {people.length > 0 && (
          <Link href="/me/people" className={BUTTON_TERTIARY}>
            전체 관리
            <Icon name="arrow" className="size-4" />
          </Link>
        )}
      </div>

      {people.length === 0 ? (
        <div className={`${EMPTY_SLOT} flex flex-col items-start gap-4`}>
          <p className="text-[15px] leading-6 text-secondary">가족이나 친구의 출생 정보를 저장하고 관리하세요.</p>
          <Link href="/me/people" className={BUTTON_PRIMARY}>
            <Icon name="plus" className="size-[18px]" />
            사람 추가
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {people.map((person) => (
            <PersonTile key={person.personId} person={person} {...tileOf(person)} />
          ))}
          {!full && <AddTile slots={slots} />}
        </ul>
      )}
      {slots !== null && full && <p className="text-[13px] text-secondary">등록할 수 있는 {slots.limit}명을 다 채웠습니다.</p>}
    </section>
  );
}

/** 목록 끝의 빈 타일 — 다른 타일과 같은 크기라 「한 자리 더」로 읽힌다 */
function AddTile({ slots }: { slots: PersonSlots | null }) {
  return (
    <li>
      <Link
        href="/me/people"
        className="flex h-full min-h-44 flex-col items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-border-strong p-4 text-center text-foreground hover:bg-surface active:scale-[0.98]"
      >
        <span className="grid size-12 place-items-center rounded-full bg-accent text-on-accent">
          <Icon name="plus" />
        </span>
        <span className="text-[15px] font-semibold">사람 추가</span>
        {slots !== null && (
          <span className="text-[13px] tabular-nums text-secondary">
            {slots.used}/{slots.limit}명
          </span>
        )}
      </Link>
    </li>
  );
}

/**
 * 홈에서 떠나는 길 셋 — 머리글의 탭에서 빠진 「사주·궁합」의 두 길과 매칭.
 *
 * 매칭은 머리글의 탭에도 있지만 홈의 이 줄이 **무엇을 하는 곳인가**를 한 줄로 말한다 — 탭 이름만으로는
 * 처음 온 사람이 「매칭」에서 무엇을 하는지 모른다.
 */
const MORE_WAYS: readonly { href: string; label: string; note?: string; icon: IconName; element: Element }[] = [
  {
    href: '/me/matching',
    label: '매칭에서 오늘의 인연 만나기',
    note: '예측 궁합과 보완하는 기운으로, 나의 귀인을 찾아보세요.',
    icon: 'people',
    element: '木',
  },
  { href: '/', label: '다른 사람 사주 보기', icon: 'search', element: '水' },
  { href: '/compat', label: '궁합 보러 가기', icon: 'heart', element: '火' },
];

function MoreWays() {
  return (
    <nav aria-label="더 해 보기" className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      {MORE_WAYS.map((way) => (
        <Link
          key={way.href}
          href={way.href}
          className={`${elementScope(way.element)} group flex min-h-16 items-center gap-3 rounded-[1.25rem] border border-border bg-surface px-4 py-3 text-foreground hover:border-[color-mix(in_srgb,var(--ink)_40%,transparent)] active:scale-[0.98] ${
            way.note === undefined ? '' : 'sm:col-span-2 lg:col-span-1'
          }`}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--tile)] text-[var(--ink)]">
            <Icon name={way.icon} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">{way.label}</span>
            {way.note !== undefined && <span className="mt-0.5 block text-[13px] leading-5 text-secondary">{way.note}</span>}
          </span>
          <Icon name="arrow" className="size-4 shrink-0 text-secondary transition group-hover:translate-x-0.5" />
        </Link>
      ))}
    </nav>
  );
}

/**
 * 안 읽은 알림 — **있을 때만 선다.**
 *
 * 알림은 앱 안에서만 온다(용어집). 그러니 들어왔을 때 **여기서** 눈에 띄어야 한다 — 로그인한 사람이
 * 도착하는 자리가 이 화면이라 더 그렇다. 길은 머리글의 종에 늘 있고, **띠는 알림이 실제로 있을 때만**
 * 세운다. 늘 서 있는 줄은 곧 안 읽히고, 그때 정작 무언가 왔을 때도 안 읽힌다.
 *
 * 목록 전체를 읽지 않고 개수만 묻는다. 이 화면은 알림의 내용을 그리지 않는다.
 */
async function Unread() {
  const unread = await unreadCount();
  /* 못 읽었으면 띠를 안 세운다 — 「0 건」과 「못 읽음」을 가른 값이 온다(ADR 0078) */
  if (!unread.ok || unread.value === 0) return null;

  return (
    <Link
      href="/me/requests"
      className="-mt-4 flex min-h-14 items-center gap-3 rounded-[1.25rem] border border-border bg-surface px-4 py-3 text-[15px] font-semibold text-foreground hover:border-border-strong active:scale-[0.99] sm:-mt-6"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-fire-soft text-fire">
        <Icon name="bell" className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">아직 확인하지 않은 새 소식이 있습니다.</span>
      {/*
        수만 그리면 화면 밖에서는 **아무 뜻이 없다.** 보이지 않는 말을 붙여 배지가 스스로 무엇인지 말하게
        한다. 밖에서 이 배지를 재는 검사도 같은 말을 짚는다(`scripts/check-match.mjs`).
      */}
      <span className={BADGE}>
        {unread.value}
        <span className="sr-only">건 안 읽음</span>
      </span>
      <Icon name="arrow" className="size-4 shrink-0 text-secondary" />
    </Link>
  );
}
