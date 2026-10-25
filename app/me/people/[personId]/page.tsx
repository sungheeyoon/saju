import Link from 'next/link';
import { notFound } from 'next/navigation';

import { isBlocked, selfPersonIdOf } from '@/src/lib/account';
import { STEM_INFO } from '@/src/lib/saju';

import { supabaseOnServer } from '../../../auth/server-client';
import { signedInUser } from '../../../auth/signed-in';
import { redirectToSignIn } from '../../../auth/sign-in-redirect';
import { SajuResult } from '../../../saju/view';
import { UNREADABLE_INPUT_NOTE } from '@/src/lib/input/stored';
import { AccountNotice } from '../../account-notice';
import { readAccount } from '../../account';
import { payloadForViewer } from '../../payload';
import { ReadingTabs } from '../../reading-tabs';
import { elementScope } from '../../../ui/element-tone';
import { BUTTON_PRIMARY_FACE, BUTTON_SECONDARY_FACE, BUTTON_TERTIARY } from '../../../ui/buttons';
import { Icon } from '../../../ui/icons';
import { COLUMN, TYPE_META, TYPE_SECTION, TYPE_TITLE } from '../../../ui/surfaces';
import { DayMasterChip } from '../chart-bits';
import { StemSymbol } from '../../../ui/stem-symbol';
import { compatHrefFor } from '../compat-href';
import { COMPAT_ENTRY_LABEL } from '../../../service-features';
import type { ReadingEntry } from '@/src/lib/reading';
import { myReadings } from '../../reading/current';
import { compatHrefOf, pairWithSelf, readingOf, selfReadingOf } from '../../home/map/model';
import { HOME_LIST, HOME_ROW, HOME_ROW_LINK, HOME_ROW_VALUE } from '../../home/home-list';

export const metadata = {
  title: '사주 상세',
  description: '저장한 사람의 사주와 운의 흐름을 자세히 봅니다.',
};

export default async function PersonSajuPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ from?: string | string[]; tab?: string | string[] }>;
}) {
  const supabase = await supabaseOnServer();
  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  /**
   * **못 읽은 것을 중지로 말하지 않는다**(ADR 0048).
   *
   * 여기는 `account?.status !== 'active'` 로 물어서, 계정을 못 읽었을 때도 「중지된
   * 계정입니다」를 세우고 있었다. `app_user` 의 select 정책은 `id = auth.uid()` 하나이고
   * `status` 를 안 보므로 — 정지된 계정도 자기 행을 읽는다 — 그 말은 참일 수가 없었다.
   */
  const { state } = await readAccount(supabase);
  if (isBlocked(state)) {
    return (
      <main className={`app-shell flex ${COLUMN} flex-1 flex-col gap-6 py-8 sm:py-12`}>
        <AccountNotice state={state} />
      </main>
    );
  }

  const { personId } = await params;
  const view = await payloadForViewer(personId);
  if (view === null) notFound();

  /**
   * 못 읽는 입력은 **메우지 않는다** — 저장된 값은 그대로 있고 읽는 쪽이 못 읽는 것이다.
   *
   * 앞서는 이 자리가 `instanceof` 로 예외를 받았다. 받는 것을 잊으면 500 이 되는 모양이라
   * 문이 값으로 내주는 쪽으로 옮겼다(`PersonView`).
   */
  if (view.kind === 'unreadable-input') {
    return (
      <main className={`app-shell flex ${COLUMN} flex-1 flex-col gap-6 py-8 sm:py-12`}>
        <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5 sm:p-6">
          <p className="text-body">{view.message}</p>
          <p className={TYPE_META}>{UNREADABLE_INPUT_NOTE}</p>
        </section>
      </main>
    );
  }

  const person = view.payload;

  /**
   * 내 명식이면 풀이 칸은 `/me` 의 것이다 — 두 자리에 세우면 글이 둘 선다.
   *
   * **주소에 적힌 글자가 아니라 `person.personId` 로 견준다.** uuid 비교는 대소문자를
   * 안 가려서 대문자로 적은 주소도 조회를 지나가는데, 문자열 비교는 가린다. 그 둘이
   * 갈리는 순간 이 값이 거짓이 되고 화면은 못 만드는 버튼을 세운다 — DB 는 거절하므로
   * 안전은 지켜지지만, 「못 만드는 버튼을 안 보여 준다」는 약속이 깨진다.
   */
  const selfPersonId = selfPersonIdOf(state);
  const mine = selfPersonId === person.personId;
  const element = STEM_INFO[person.saju.pillars.dayMaster].element;
  const query = await searchParams;
  /* 홈의 줄(`?from=me`)이나 내 사주에서 왔으면 ← 홈, 저장한 사람 목록에서 왔으면 ← 저장한 사람 */
  const fromHome = mine || query.from === 'me';
  /* 사주풀이 탭을 이 화면 안에 모은 안(시안) — `?tab=reading`. 기본 탭 링크는 아직 풀이 화면(`/me/readings/…`)이다 */
  const gathered = query.tab === 'reading';

  /*
    **단추 둘의 상태**(2026-10-26 운영자) — 이 사람의 사주풀이와 나와의 궁합을 이미 받았나. 목록 문(`my_readings`)이 홈과 같은 값을
    준다. 못 읽으면 「받기 · 보러 가기」로 선다 — 그 화면이 다시 읽어 맞는 글을 세운다(부속 정보, ADR 0078)
  */
  const readings = await myReadings().catch(() => [] as const);
  const own = mine ? selfReadingOf(readings) : readingOf(readings, person.personId);
  const pair = mine ? null : pairWithSelf(readings, selfPersonId, person.personId);
  const readingHref = mine ? '/me/readings/self' : `/me/readings/${person.personId}`;
  const compatHref = pair !== null ? compatHrefOf(pair, selfPersonId, person.personId) : compatHrefFor(selfPersonId, person.personId);

  const readingButton = (primary: boolean) => (
    <Link href={readingHref} className={`${primary ? BUTTON_PRIMARY_FACE : BUTTON_SECONDARY_FACE} whitespace-nowrap px-3 sm:px-5`}>
      <Icon name={own === null ? 'spark' : 'reading'} className="size-[18px]" />
      {own === null ? '사주풀이 받기' : '사주풀이 보기'}
    </Link>
  );
  const compatButton = (primary: boolean) => (
    <Link href={compatHref} className={`${primary ? BUTTON_PRIMARY_FACE : BUTTON_SECONDARY_FACE} whitespace-nowrap px-3 sm:px-5`}>
      <Icon name="taiji" className="size-[18px]" />
      {pair === null ? (
        COMPAT_ENTRY_LABEL
      ) : (
        <>
          궁합 보기
          <span className="rounded-full bg-[color-mix(in_srgb,currentColor_12%,transparent)] px-2 py-0.5 text-small font-semibold tabular-nums">
            {pair.score}점
          </span>
        </>
      )}
    </Link>
  );

  return (
    /* 저장한 사람 목록(`../page.tsx`)과 같은 기둥에 선다(`COLUMN`) — 목록에서 들어와도 제목 자리가 안 옮긴다 */
    <main className={`app-shell flex ${COLUMN} flex-1 flex-col gap-5 py-6 sm:gap-6 sm:py-12`}>
      {/*
        **뒤로 가기는 판 밖 위의 작은 글자 하나**(2026-10-26 운영자 「너무 크다」) — 사주풀이 화면의 「← 홈」(`ReadingBack`)과 같은 꼴 ·
        같은 자리. 글자는 돌아갈 화면의 이름이다(토스 · 카카오톡 상세의 ← 는 이름 없이 화살표뿐이고, 이 앱은 화면 이름을 단다).
      */}
      <Link href={fromHome ? '/me' : '/me/people'} className={`${BUTTON_TERTIARY} self-start`}>
        <Icon name="back" className="size-4" />
        {fromHome ? '홈' : '저장한 사람'}
      </Link>

      {/*
        **머리는 홈의 내 사주 카드 꼴이다**(2026-10-26 운영자) — 그 사람의 일간 색 판, 동그란 일간 그림 + 이름, 오른쪽 위 일간 딱지,
        아래 주 단추 + 보조 단추. 아직 풀이를 안 받았으면 「사주풀이 받기」가 주 단추, 받았으면 「궁합」이 주 단추다 — 다음에 할 일이 진하다.
      */}
      <header className={`${elementScope(element)} relative flex flex-col gap-4 overflow-hidden rounded-card bg-[var(--tile)] p-4 sm:gap-6 sm:p-8`}>
        <StemSymbol
          stem={person.saju.pillars.dayMaster}
          className="pointer-events-none absolute -bottom-10 -right-8 size-40 opacity-15 sm:size-56"
        />
        <div className="absolute right-4 top-4 sm:right-5 sm:top-5">
          <DayMasterChip stem={person.saju.pillars.dayMaster} />
        </div>
        <div className="relative flex min-w-0 items-center gap-3 pr-20">
          <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-surface text-[var(--ink)]">
            <StemSymbol stem={person.saju.pillars.dayMaster} className="size-8" />
          </span>
          <h1 className={`min-w-0 break-keep [overflow-wrap:anywhere] ${TYPE_TITLE}`}>{person.name}</h1>
        </div>
        <div className="relative grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center">
          {mine ? readingButton(true) : own === null ? <>{readingButton(true)}{compatButton(false)}</> : <>{compatButton(true)}{readingButton(false)}</>}
        </div>
      </header>

      <ReadingTabs
        current={gathered ? 'reading' : 'chart'}
        chartHref={`/me/people/${person.personId}${fromHome && !mine ? '?from=me' : ''}`}
        readingHref={readingHref}
        label={mine ? '내 사주' : person.name}
      />

      {gathered ? (
        <GatheredReadings name={person.name} own={own} ownHref={readingHref} pair={mine ? undefined : pair} compatHref={compatHref} />
      ) : (
        <SajuResult saju={person.saju} />
      )}
    </main>
  );
}

/**
 * **사주풀이 탭에 이 사람의 풀이를 모은 안(시안, `?tab=reading`)** — 운영자 물음(2026-10-26): 이 사람의 사주풀이와 나와의 궁합풀이를
 * 두 구역으로 세운다. 받은 것은 줄을 누르면 그 글, 없는 것은 그 구역에 받기 · 보러 가기 줄 하나. 지금 구조(사주풀이 탭 = 개인 풀이
 * 화면 `/me/readings/[id]`)와 나란히 견주려고 둔다.
 */
function GatheredReadings({
  name,
  own,
  ownHref,
  pair,
  compatHref,
}: {
  name: string;
  own: ReadingEntry | null;
  ownHref: string;
  pair: ReadingEntry | null | undefined;
  compatHref: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="gathered-own" className="flex flex-col gap-2">
        <h2 id="gathered-own" className={TYPE_SECTION}>사주풀이</h2>
        <ul className={HOME_LIST}>
          <li className={HOME_ROW}>
            <Link href={ownHref} className={HOME_ROW_LINK}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body font-semibold">{own === null ? '사주풀이 받기' : `${name}의 사주풀이`}</span>
                {own?.metaphor != null && <span className="truncate text-small leading-5 text-secondary">{own.metaphor}</span>}
              </span>
              <Icon name="chevron" className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        </ul>
      </section>
      {pair !== undefined && (
        <section aria-labelledby="gathered-pair" className="flex flex-col gap-2">
          <h2 id="gathered-pair" className={TYPE_SECTION}>나와의 궁합</h2>
          <ul className={HOME_LIST}>
            <li className={HOME_ROW}>
              <Link href={compatHref} className={HOME_ROW_LINK}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body font-semibold">{pair === null ? COMPAT_ENTRY_LABEL : '궁합풀이'}</span>
                  {pair?.metaphor != null && <span className="truncate text-small leading-5 text-secondary">{pair.metaphor}</span>}
                </span>
                {pair !== null && (
                  <span className={HOME_ROW_VALUE}>
                    {pair.score}점
                    <Icon name="taiji" className="size-4 text-secondary" />
                  </span>
                )}
                <Icon name="chevron" className="size-4 shrink-0 text-muted" />
              </Link>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}
