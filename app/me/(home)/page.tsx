import Link from 'next/link';

import { isBlocked } from '@/src/lib/account';
import { UNREADABLE_INPUT_NOTE, storedChartOf } from '@/src/lib/input/stored';
import type { Element } from '@/src/lib/saju';

import { supabaseOnServer } from '../../auth/server-client';
import { signedInUser } from '../../auth/signed-in';
import { redirectToSignIn } from '../../auth/sign-in-redirect';
import { elementScope } from '../../ui/element-tone';
import { BUTTON_SECONDARY } from '../../ui/buttons';
import { Icon, type IconName } from '../../ui/icons';
import { BADGE, TYPE_DISPLAY, TYPE_META } from '../../ui/surfaces';
import { readAccount } from '../account';
import { AccountNotice } from '../account-notice';
import { openDiscoveryParticipation } from '../discovery/participation';
import { myCircle } from '../home/circle';
import { DayFlowCard } from '../home/day-flow-card';
import { selfReadingOf } from '../home/map/model';
import { ReceivedReadings } from '../home/received-readings';
import { SelfCard } from '../home/self-card';
import { Onboarding } from '../onboarding';
import { storedInputOf } from '../person-input';
import { myReadings } from '../reading/current';
import { unreadCount } from '../requests/inbox';

/**
 * 로그인한 사람이 도착하는 자리 — **홈.**
 *
 * 인사 → 내 사주와 이번 달 흐름 → 내가 받은 사주풀이 → 다른 사람 사주 → 바로가기 차례로 내려온다(ADR 0129).
 * 관계 지도와 저장한 사람은 궁합 탭(`/compat`)에 선다.
 *
 * 저장된 입력으로 **서버에서 계산한다.** 익명 화면은 브라우저에서 계산하지만 부르는 함수는 같다(`chartOf`)
 * — 저장하기 전에 본 사주와 저장한 뒤에 보는 사주가 다를 자리를 만들지 않으려는 것이다.
 */
export default async function MePage() {
  const supabase = await supabaseOnServer();

  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  // 정책이 자기 행만 내주므로 `where` 를 적지 않는다. 적으면 판정하는 자리가 둘이 된다.
  const { state, row: account } = await readAccount<{
    status: string;
    self_person_id: string | null;
    nickname: string | null;
  }>(supabase, 'status, self_person_id, nickname');
  const selfPersonId = state.kind === 'active' ? state.selfPersonId : null;
  const nickname = account?.nickname?.trim() ?? '';

  return (
    <main className="app-shell flex min-w-0 flex-1 flex-col gap-6 py-5 sm:gap-12 sm:py-12">
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

/**
 * 인사 한 줄 — 넓은 화면에서 가장 먼저 읽히는 글자. 날짜는 한국 시각이다(서버의 시계는 UTC 다).
 *
 * **폰에서는 눈에 안 보이고 제목으로만 남는다**(2026-09-25). 폰의 첫 화면은 카드 한 장이 다 들어야 하는데
 * 인사가 그 앞에서 100px 가까이 썼고, 매일 오는 사람에게 인사는 이틀째부터 안 읽힌다. 내 사주 카드의 이름
 * 줄이 그 자리를 맡는다. 지우지 않는 것은 이 줄이 화면의 하나뿐인 `h1` 이라서다.
 */
function Greeting({ name }: { name: string }) {
  const today = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Seoul',
  });
  return (
    <header className="sr-only flex flex-col gap-1 sm:not-sr-only">
      <p className={TYPE_META}>{today}</p>
      <h1 className={TYPE_DISPLAY}>{name === '' ? '반가워요' : `${name}님, 오늘도 반가워요`}</h1>
    </header>
  );
}

/**
 * 홈의 본체 — 내 사주 카드와 이번 달 흐름, 그 아래 내가 받은 사주풀이(ADR 0129).
 *
 * 관계 지도와 저장한 사람은 궁합 탭(`/compat`)으로 옮겼다 — 지도가 긋는 선이 궁합이라서다. 나 탭은 **나**를 본다:
 * 내 사주 · 오늘 · 내가 받은 풀이. 읽는 것은 내 엣지(이름) · 내 입력 · 만든 풀이 목록 셋이고 한 번에 겹쳐 돈다.
 */
async function Home({ selfPersonId }: { selfPersonId: string }) {
  const supabase = await supabaseOnServer();

  const [circle, self, readings] = await Promise.all([
    myCircle(supabase, selfPersonId),
    storedInputOf(supabase, selfPersonId),
    myReadings(),
  ]);

  /**
   * **못 읽는 입력은 메우지 않는다.** 모르는 출생지를 서울로 치면 저장할 때 본 사주와 다른 사주가 이
   * 화면에 나온다. 값은 남아 있고 읽는 쪽이 못 읽는 것이므로 그렇게 말하고 멈춘다 — 풀이 목록은 그대로 선다.
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
          **내 사주가 먼저 선다**(2026-09-25) — 이 앱의 첫 얼굴은 나다. 폰에서는 위, 넓은 화면에서는 왼쪽의 넓은
          칸(7)이고 오른쪽(5)에 이번 달 흐름이 선다. 두 카드는 **같은 높이로 늘어난다**(`items-stretch`).
        */
        <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-stretch lg:gap-6">
          <SelfCard
            personId={selfPersonId}
            label={stood.query.name}
            query={stood.query}
            saju={stood.saju}
            reading={selfReadingOf(readings)}
          />
          <DayFlowCard dayMaster={stood.saju.pillars.dayMaster} now={new Date()} />
        </div>
      )}

      <ReceivedReadings readings={readings} />

      <div className="-mt-2 sm:-mt-6">
        <Link href="/" className={BUTTON_SECONDARY}>
          <Icon name="search" className="size-[18px]" />
          다른 사람 사주 보기
        </Link>
      </div>

      <MoreWays />
    </>
  );
}

/**
 * 나 탭 홈의 바로가기 셋 — 인연, 궁합, 그리고 만든 풀이의 책장. 다른 사람 사주는 받은 사주풀이 바로 아래
 * 단추 하나로 섰다(ADR 0129) — 한 사람 풀이를 보는 자리 옆이다.
 *
 * 인연과 궁합은 머리글의 탭에도 있지만 이 줄이 **무엇을 하는 곳인가**를 한 줄로 말한다 — 탭 이름만으로는
 * 처음 온 사람이 「인연」에서 무엇을 하는지 모른다. 책장(`/me/readings`)은 탭에서 빠지며(ADR 0126) 나 탭 안의
 * 길이 됐다 — 넓은 화면은 글을 열면 옆에 서지만, 폰에서 책장 자체로 가는 길은 여기뿐이다.
 */
const MORE_WAYS: readonly { href: string; label: string; note?: string; icon: IconName; element: Element }[] = [
  {
    href: '/me/matching',
    label: '오늘의 인연 만나기',
    note: '예측 궁합과 보완하는 기운으로, 나의 귀인을 찾아보세요.',
    icon: 'people',
    element: '木',
  },
  { href: '/compat', label: '궁합 보러 가기', icon: 'heart', element: '火' },
  { href: '/me/readings', label: '만든 풀이 다시 보기', icon: 'reading', element: '金' },
];

function MoreWays() {
  return (
    <nav aria-label="바로가기" className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
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
      className="flex min-h-14 items-center gap-3 rounded-[1.25rem] border border-border bg-surface px-4 py-3 text-[15px] font-semibold text-foreground hover:border-border-strong active:scale-[0.99] sm:-mt-6"
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
