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
import { BUTTON_PRIMARY_FACE, BUTTON_TERTIARY } from '../../../ui/buttons';
import { Icon } from '../../../ui/icons';
import { CARD_FRAME, COLUMN, TYPE_META, TYPE_SECTION, TYPE_TITLE } from '../../../ui/surfaces';
import { readingNoneNote } from '@/src/lib/reading/notes';
import { DayMasterChip } from '../chart-bits';
import { StemSymbol } from '../../../ui/stem-symbol';
import { COMPAT_ENTRY_LABEL } from '../../../service-features';
import type { ReadingEntry } from '@/src/lib/reading';
import { myReadings } from '../../reading/current';
import { compatHrefOf, readingOf, selfReadingOf } from '../../home/map/model';
import { HOME_HEAD_COUNT, HOME_LIST, HOME_ROW, HOME_ROW_LINK, HOME_ROW_VALUE } from '../../home/home-list';

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
  const { state, row: account } = await readAccount(supabase, ['status', 'self_person_id', 'nickname']);
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
  /* **사주풀이 탭이 기본**이다(운영자 2026-10-26) — 만세력은 `?tab=chart` */
  const gathered = query.tab !== 'chart';
  const here = `/me/people/${person.personId}`;
  const keepFrom = fromHome && !mine ? 'from=me' : '';
  const withQuery = (...parts: string[]) => {
    const joined = parts.filter((part) => part !== '').join('&');
    return joined === '' ? here : `${here}?${joined}`;
  };

  /*
    **이 사람에게서 받은 것** — 이 사람의 사주풀이와 이 사람이 들어간 궁합풀이. 목록 문(`my_readings`)이 홈과 같은 값을 준다. 못 읽으면
    「받기 · 보러 가기」로 선다 — 그 화면이 다시 읽어 맞는 글을 세운다(부속 정보, ADR 0078)
  */
  const readings = await myReadings().catch(() => [] as const);
  const own = mine ? selfReadingOf(readings) : readingOf(readings, person.personId);
  const readingHref = mine ? '/me/readings/self' : `/me/readings/${person.personId}`;
  /*
    **「궁합 보러 가기」는 이 사람만 앉힌다**(운영자 2026-10-26) — 다른 칸은 비워 두고 사용자가 고른다(고르는 목록 맨 위가 「나」). 나와의
    궁합으로 미리 정하지 않는다 — 이 사람과 다른 저장한 사람의 궁합도 이 길이다. 다른 진입(홈 · 궁합 탭)은 그대로다
  */
  const compatHref = `/compat#a.person=${person.personId}`;
  /*
    **이 사람이 들어간 궁합풀이 전부**(2026-10-26 운영자) — 나와의 것만이 아니다. 저장한 다른 사람과 본 궁합도 이 사람의 것이다. 최근 순.
    줄 제목은 두 사람 이름을 나란히(내 자리는 닉네임) — 누구의 눈으로 본 것인지 말하지 않는다
  */
  const nickname = account?.nickname?.trim() || '나';
  const pairs = mine
    ? []
    : readings
        .filter((entry) => entry.kind === 'private' && (entry.personA === person.personId || entry.personB === person.personId))
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((entry) => ({
          key: `${entry.personA}:${entry.personB}`,
          /* 이 사람이 늘 앞 — 「하은 · 엄마」, 「하은 · 도윤」(내 자리는 닉네임) */
          names: [
            person.name,
            entry.personA === person.personId
              ? entry.personB === selfPersonId
                ? nickname
                : (entry.labelB ?? '')
              : entry.personA === selfPersonId
                ? nickname
                : (entry.labelA ?? ''),
          ].join(' · '),
          score: entry.score,
          metaphor: entry.metaphor,
          href: compatHrefOf(entry, selfPersonId, person.personId),
        }));

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
        **머리는 이름과 일간 딱지뿐이다**(2026-10-26 운영자) — 그 사람의 일간 색 판에 큰 이름, 오른쪽 위 일간 딱지(일간은 이 딱지가 말한다 —
        이름 옆 그림은 걷었다). 단추는 없다 — 받는 일 · 보러 가는 일은 아래 사주풀이 탭의 카드 · 줄이 든다.
      */}
      <header className={`${elementScope(element)} relative flex flex-col overflow-hidden rounded-card bg-[var(--tile)] p-5 sm:p-8`}>
        <StemSymbol
          stem={person.saju.pillars.dayMaster}
          className="pointer-events-none absolute -bottom-10 -right-8 size-40 opacity-15 sm:size-56"
        />
        <div className="absolute right-4 top-4 sm:right-5 sm:top-5">
          <DayMasterChip stem={person.saju.pillars.dayMaster} />
        </div>
        <h1 className={`relative min-w-0 break-keep pr-20 [overflow-wrap:anywhere] ${TYPE_TITLE}`}>{person.name}</h1>
      </header>

      <ReadingTabs
        current={gathered ? 'reading' : 'chart'}
        chartHref={withQuery(keepFrom, 'tab=chart')}
        readingHref={withQuery(keepFrom)}
        label={mine ? '내 사주' : person.name}
      />

      {gathered ? (
        <GatheredReadings name={person.name} own={own} ownHref={readingHref} pairs={mine ? undefined : pairs} compatHref={compatHref} />
      ) : (
        <SajuResult saju={person.saju} />
      )}
    </main>
  );
}

/**
 * **사주풀이 탭 — 이 사람의 풀이를 모은다**(기본 탭, 운영자 확정 2026-10-26). 두 구역:
 *
 * - 「사주풀이」 — 받았으면 그 풀이 카드(누르면 글), 안 받았으면 「사주풀이 받기」 카드(설명 한 줄 + 주 단추 — 이 화면에서 유일한 진한 것).
 *   설명은 풀이 화면의 빈 칸 안내와 같은 글(`readingNoneNote`, 대장 15)
 * - 「궁합」 — 이 사람이 들어간 궁합풀이 전부(나와 · 저장한 다른 사람과, 최근 순 — 이 사람 이름이 앞 · 점수 ☯ · 한 줄 평 · ›), 그리고 맨 끝에
 *   늘 「궁합 보러 가기 ›」 줄(궁합이 있어도 다른 사람과 더 볼 수 있다 — 누르면 이 사람만 앉은 궁합 화면)
 */
function GatheredReadings({
  name,
  own,
  ownHref,
  pairs,
  compatHref,
}: {
  name: string;
  own: ReadingEntry | null;
  ownHref: string;
  pairs: readonly { key: string; names: string; score: number | null; metaphor: string | null; href: string }[] | undefined;
  compatHref: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="gathered-own" className="flex flex-col gap-2">
        <h2 id="gathered-own" className={TYPE_SECTION}>사주풀이</h2>
        {own === null ? (
          <div className={`${CARD_FRAME} flex flex-col gap-4 p-5`}>
            <p className="break-keep text-body leading-6 text-secondary">{readingNoneNote('사주풀이')}</p>
            <Link href={ownHref} className={`${BUTTON_PRIMARY_FACE} px-5`}>
              <Icon name="spark" className="size-[18px]" />
              사주풀이 받기
            </Link>
          </div>
        ) : (
          <ul className={HOME_LIST}>
            <li className={HOME_ROW}>
              <Link href={ownHref} className={HOME_ROW_LINK}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body font-semibold">{`${name}의 사주풀이`}</span>
                  {own.metaphor != null && <span className="truncate text-small leading-5 text-secondary">{own.metaphor}</span>}
                </span>
                <Icon name="chevron" className="size-4 shrink-0 text-muted" />
              </Link>
            </li>
          </ul>
        )}
      </section>
      {pairs !== undefined && (
        <section aria-labelledby="gathered-pairs" className="flex flex-col gap-2">
          <h2 id="gathered-pairs" className={`${TYPE_SECTION} flex items-baseline gap-1.5`}>
            궁합
            {pairs.length > 0 && <span className={HOME_HEAD_COUNT}>{pairs.length}개</span>}
          </h2>
          <ul className={HOME_LIST}>
            {pairs.map((pair) => (
              <li key={pair.key} className={HOME_ROW}>
                <Link href={pair.href} className={HOME_ROW_LINK}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body font-semibold">{pair.names}</span>
                    {pair.metaphor !== null && <span className="truncate text-small leading-5 text-secondary">{pair.metaphor}</span>}
                  </span>
                  {pair.score !== null && (
                    <span className={HOME_ROW_VALUE}>
                      {pair.score}점
                      <Icon name="taiji" className="size-4 text-secondary" />
                    </span>
                  )}
                  <Icon name="chevron" className="size-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
            <li className={HOME_ROW}>
              <Link href={compatHref} className={HOME_ROW_LINK}>
                <span className="min-w-0 flex-1 truncate text-body font-semibold">{COMPAT_ENTRY_LABEL}</span>
                <Icon name="chevron" className="size-4 shrink-0 text-muted" />
              </Link>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}
