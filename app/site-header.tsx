'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

import { SERVICE_NAME } from '@/src/lib/brand';
import { CHAT_TAB_LABEL } from '@/src/lib/chat';
import { readingCreditsLabel } from '@/src/lib/reading/notes';
import { SURVEY_COPY } from '@/src/lib/survey';
import { SAJU_PATH, signInFrom } from '@/src/lib/consent';

import { supabaseInBrowser } from './auth/browser-client';
import { lightOf, placeOf, resultKindOf } from './came-from';
import { useBrowserSession } from './auth/browser-session';
import { useSignOut } from './auth/sign-out';
import { readUnreadChat } from './me/chat/unread';
import { CHAT_UNREAD_MOVED } from './me/chat/unread-signal';
import { readReadingCredits } from './me/reading/credits';
import { READING_CREDITS_MOVED } from './me/reading/credits-signal';
import { readRequestsToAnswer, readUnreadNotifications } from './me/requests/unread';
import { NOTIFICATIONS_UNREAD_MOVED, REQUESTS_TO_ANSWER_MOVED } from './me/requests/unread-signal';
import { isSharePath } from './share/path';
import { BUTTON_SECONDARY_SMALL, ICON_BUTTON, ICON_BUTTON_ACTIVE } from './ui/buttons';
import { useDetailsMenu } from './ui/details-menu';
import { Icon, type IconName } from './ui/icons';
import { BrandMark } from './ui/logo';
import { BADGE } from './ui/surfaces';

/**
 * 로그인한 사람의 탭 — **홈 · 궁합 · 인연 · 채팅 넷**(2026-09-29 운영자 결정, 시안 g · ADR 0126).
 *
 * 첫 탭의 이름은 「나」였다가 **「홈」으로 돌아왔고**, 궁합의 그림은 하트가 아니라 **첫 화면 입구의 태극**이다
 * (운영자 2026-09-29 — ADR 0126 덧붙임). 탭 막대 · 독의 생김새는 프로덕션(`a45e34e`)과 같은 한 벌이다.
 *
 * 앞 판(홈 · 매칭 · 풀이 · 채팅, ADR 0109)은 **만든 글**을 탭 하나에 모았다. 이제 글은 **누구의 것인가**로 갈라
 * 선다 — 내 사주풀이와 저장한 사람의 풀이는 홈, 두 사람을 고른 궁합은 궁합, 동의로 열린 궁합은 인연. 책장
 * (`/me/readings`)은 주소 그대로 홈 탭 안의 길이다. **주소는 하나도 안 바뀌었다** — 이름과 「어느 화면에서 어느
 * 탭이 켜지나」만 바뀐다. 궁합 탭의 첫 화면은 두 사람을 고르는 `/compat` 이다.
 *
 * 소식은 종, 프로필 · 계정 관리 · 서비스 설문은 톱니 안이다(ADR 0109 그대로). 받은 요청은 종이 아니라 인연 탭 맨 위에
 * 산다(ADR 0130). 대화방 목록도 탭이다(PRD 「앱 내 채팅」).
 */
const MEMBER_TABS = [
  { href: '/me', label: '홈', icon: 'home' },
  { href: '/compat', label: '궁합', icon: 'taiji' },
  { href: '/me/matching', label: '인연', icon: 'people' },
  { href: '/me/chat', label: CHAT_TAB_LABEL, icon: 'chat' },
] as const satisfies readonly { href: string; label: string; icon: IconName }[];

/** 운영 화면인가 — `/ops` 와 그 아래 */
export function isOperatorPath(pathname: string): boolean {
  return within(pathname, '/ops');
}

/** `base` 그 자리이거나 그 아래인가 — `/me/peoplex` 는 `/me/people` 아래가 아니다 */
function within(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * 지금 보고 있는 화면이 **어느 탭의 것인가**(ADR 0126 · 0134).
 *
 * - **결과 화면**(사주풀이 · 직접 궁합)은 **온 곳**(`?from=`)의 탭을 켠다 — 궁합 탭에서 연 궁합은 궁합, 소식에서 연 글은
 *   종이다. 온 곳이 없거나 모르는 값이면 결과 종류의 탭이다(사주 → 홈, 궁합 → 궁합). **인연 궁합은 어디서 와도 인연이다**
 *   (화면 점검 C14, ADR 0109 추기 2026-10-10). 표는 `came-from.ts` 한 벌이다(ADR 0134).
 * - **홈**은 `/me` 와 한 사람의 사주 쪽이다 — 저장한 사람(`/me/people/*`), **풀이 보관함 목록(`/me/readings`)**, 그리고
 *   로그인한 사람의 사주 계산(`/saju`, ADR 0144). 보관함은 궁합 탭의 「모두 보기」로 와도 홈이다(ADR 0134).
 * - **궁합**은 두 사람을 고르는 자리(`/compat`)다. **인연**은 오늘의 인연과 그 아래(`/me/matching/*`)다.
 * - 채팅 · 종(`/me/requests`)은 제 주소와 그 아래다. 톱니 안의 화면은 어느 탭도 안 켠다.
 */
export function isNavigationActive(pathname: string, href: string, from: string | null = null): boolean {
  const result = resultKindOf(pathname);
  if (result !== null) return lightOf(result, placeOf({ from }, pathname).from) === href;
  if (href === '/me') {
    return pathname === '/me' || within(pathname, '/me/people') || pathname === '/me/readings' || pathname === SAJU_PATH;
  }
  if (href === '/compat') return pathname === '/compat';
  return within(pathname, href);
}

/**
 * 폰의 하단 독이 서는 화면인가 — **대화방 하나(`/me/chat/[matchId]`)에서는 안 선다**(화면 점검 2026-10-10 C5).
 *
 * 방은 화면 높이의 판이고 대화 칸만 스크롤한다. 독이 늘 떠 있으면 그 6rem 을 비워 두느라 390×844 에서 말풍선이 쓰는 높이가 약
 * 400px 이었고, 대화 중에는 탭을 옮길 일이 드물다 — 방 머리의 ← 가 목록으로 간다. 목록(`/me/chat`)에서는 그대로 선다.
 * 독이 안 서면 `globals.css` 가 그 판의 `id` 를 보고 비우던 아래 여백도 함께 사라지고, 방의 높이(`room.module.css`)가 그만큼 는다.
 */
export function dockStandsOn(pathname: string): boolean {
  return !/^\/me\/chat\/[^/]+\/?$/.test(pathname);
}

/**
 * **주소의 `?from=` 을 읽는 자리는 `Suspense` 안에만 둔다**(ADR 0134).
 *
 * `useSearchParams` 는 미리 그려지는 화면(`/` 등)에서 가장 가까운 `Suspense` 까지를 브라우저로 미룬다. 경계 없이
 * 머리글에서 부르면 루트 레이아웃 전체가 미뤄지거나 빌드가 그 화면을 요청마다 그리는 쪽으로 돈다. 그래서 탭 불을
 * 그리는 조각만 감싸고, **미리 그릴 때는 `from` 없이(`null`) 그린다** — 미리 그려지는 화면은 결과 화면이 아니라
 * `from` 이 불을 안 바꾼다. 요청마다 그려지는 결과 화면(`/me/**`)에서는 서버가 쿼리를 알아 첫 HTML 부터 맞는 불이다.
 */
function WithCameFrom({ render }: { render: (from: string | null) => ReactNode }) {
  return (
    <Suspense fallback={render(null)}>
      <ReadCameFrom render={render} />
    </Suspense>
  );
}

function ReadCameFrom({ render }: { render: (from: string | null) => ReactNode }) {
  return render(useSearchParams().get('from'));
}

/*
  로그인했는지는 `useBrowserSession` 이 읽는다 — 서버에서 읽지 않는다. `/` · `/saju` 는 **정적으로 미리 그려지고**
  화면 요청은 proxy 를 일부러 안 지나간다. 헤더 하나 때문에 그 화면이 요청마다 도는 화면이 되면, 세션도 없는 방문마다
  Supabase 를 두드리게 된다. `/compat` 은 다르다 — proxy 의 matcher 안이고 요청마다 그려진다(2026-09-28 빌드).
*/
export function SiteHeader() {
  const pathname = usePathname();
  const protectedPath = pathname.startsWith('/me') || pathname === '/compat';
  const { session, email } = useBrowserSession();
  /**
   * **관문이 되돌리는 자리에서는 길을 안 세운다.** 베타가 끝나면 모든 화면이 `/closed` 로, 가입을 마치지 않은
   * 사람은 `/signup` 으로 되돌려진다(`proxy.ts`). 탭 · 종 · 풀이권은 누르면 전부 그 화면으로 되돌아오는 죽은
   * 길이라 걷고, **아직 할 수 있는 일** — 톱니 안의 계정 관리 · 로그아웃 — 만 남는다.
   */
  const ended = pathname === '/closed' || pathname === '/signup';
  /**
   * **공유본 화면에서는 머리글이 접힌다** — 링크를 받고 들어온 사람에게 남의 회원 메뉴와 풀이권 잔액은
   * 길이 아니다. 보낸 사람이 자기 링크를 열어 확인할 때도 같아야 한다. 로고 한 줄만 남는다.
   */
  const shared = isSharePath(pathname);
  /**
   * **운영 화면(`/ops/**`)에는 이 머리글이 안 선다** — 운영자에게 회원의 탭 · 풀이권 · 채팅 딱지는 길이 아니다. 운영 화면은
   * 제 머리(`ops/ops-header.tsx`)를 단다. 읽는 문도 안 부른다 — 안 그릴 수를 셀 까닭이 없다.
   */
  const operator = isOperatorPath(pathname);
  const memberNavigation = !shared && !operator && (protectedPath || session === 'in');
  const live = memberNavigation && !ended;
  /* 남은 풀이권은 끝난 뒤에 셀 것이 아니다 — 쓸 자리가 없다 */
  const creditsLabel = useReadingCredits(session === 'in' && !ended && !operator);
  const unreadChat = useUnreadCount(live, pathname, readUnreadChat, CHAT_UNREAD_MOVED);
  const unreadNews = useUnreadCount(live, pathname, readUnreadNotifications, NOTIFICATIONS_UNREAD_MOVED);
  const toAnswer = useUnreadCount(live, pathname, readRequestsToAnswer, REQUESTS_TO_ANSWER_MOVED);
  /** 탭마다 선 딱지 — 채팅은 안 읽은 메시지, 인연은 답할 요청(ADR 0130) */
  const tabBadges: Partial<Record<(typeof MEMBER_TABS)[number]['href'], number>> = {
    '/me/chat': unreadChat,
    '/me/matching': toAnswer,
  };
  /** 로그인 화면에서 「로그인」은 지금 보고 있는 화면으로 가는 버튼이다 */
  const onAuthScreen = pathname.startsWith('/auth');

  if (operator) return null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="app-shell flex h-16 items-center gap-2 md:gap-5">
          <Link
            href={memberNavigation ? '/me' : '/'}
            className="flex min-h-11 shrink-0 items-center rounded-full pr-1"
            aria-label={`${SERVICE_NAME} 홈`}
          >
            {/* 폰 폭에서는 풀이권 · 종 · 톱니가 자리를 먼저 쓴다 — 이름은 로고가 대신한다. 네 글자 「만날지도」는 그 셋과
                393px 에 함께 못 서서(11px 넘쳤다) 회원 머리글은 430px 부터, 그 셋이 없는 머리글은 380px 부터 이름을 세운다.
                가입 · 종료 화면(`ended`)은 톱니 하나만 남으므로 380px 쪽이다 — 430 을 따르면 390 폰에서 이름이 빠졌다 */}
            <BrandMark nameClassName={live ? 'hidden min-[430px]:inline' : 'hidden min-[380px]:inline'} />
          </Link>

          {/*
            **탭이 없으면 `<nav>` 를 안 세운다.** 빈 길잡이는 보조기기에 「메뉴가 있다」고 알리고 열어 보면
            아무것도 없다. 자리는 남긴다 — 오른쪽 끝이 머리글 바깥으로 붙어 서지 않게.
          */}
          {live ? (
            <nav aria-label="내 메뉴" className="hidden min-w-0 flex-1 justify-center md:flex">
              <WithCameFrom
                render={(from) => (
                  <ul className="flex items-center gap-1 rounded-full bg-surface p-1 ring-1 ring-border">
                    {MEMBER_TABS.map((tab) => {
                      const active = isNavigationActive(pathname, tab.href, from);
                      return (
                        <li key={tab.href}>
                          {/*
                            **눌리는 자리는 알약보다 위아래로 2px 씩 넓다**(`after:`). 알약은 40px 이고 손가락
                            과녁은 44px 이다. 알약을 키우면 고른 탭의 색 바탕도 커지므로, 모양은 두고 투명한
                            덮개만 판의 안쪽 여백(`p-1`)으로 내민다.
                          */}
                          <Link
                            href={tab.href}
                            aria-current={active ? 'page' : undefined}
                            className={`relative inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[15px] font-semibold active:scale-[0.97] after:absolute after:inset-x-0 after:-inset-y-0.5 ${
                              active ? 'bg-accent text-on-accent' : 'text-secondary hover:bg-surface-soft hover:text-foreground'
                            }`}
                          >
                            <Icon name={tab.icon} className="hidden size-[18px] lg:block" />
                            {tab.label}
                            <UnreadBadge count={tabBadges[tab.href] ?? 0} words={BADGE_WORDS[tab.href]} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              />
            </nav>
          ) : null}
          <div aria-hidden="true" className={`min-w-0 flex-1 ${live ? 'md:hidden' : ''}`} />

          {/*
            **미리 그려진 화면이라고 로그아웃된 것이 아니다.** 로그인한 사람도 `/saju` · 공개 화면으로 온다.
            아직 모르는 동안에는 **둘 다 안 보인다** — 「로그인」을 먼저 세우면 로그인한 사람이 한 번 깜빡이는
            거짓말을 보고, 톱니를 먼저 세우면 그 반대다. 자리만 잡아 두면 글자가 늦게 오는 것으로 끝난다.
          */}
          {memberNavigation ? (
            <div className="flex shrink-0 items-center gap-2">
              {/*
                **세션을 확인한 뒤에만 세운다.** 풀이권은 이 글의 성질이 아니라 **계정의 성질**이라 계정이
                사는 자리(톱니 옆)에 선다. 못 물었거나 아직 안 물은 동안에는 빈 자리다.
              */}
              {creditsLabel !== null && <Credits label={creditsLabel} />}
              {live && (
                <WithCameFrom
                  render={(from) => (
                    <NewsBell count={unreadNews} active={isNavigationActive(pathname, '/me/requests', from)} />
                  )}
                />
              )}
              <SettingsMenu email={email} ended={ended} />
            </div>
          ) : session === 'unknown' || onAuthScreen || shared ? (
            <span aria-hidden="true" className={`${BUTTON_SECONDARY_SMALL} invisible`}>
              로그인
            </span>
          ) : (
            <Link href={signInFrom(pathname)} className={BUTTON_SECONDARY_SMALL}>
              로그인
            </Link>
          )}
        </div>
      </header>
      {live && dockStandsOn(pathname) && <WithCameFrom render={(from) => <Dock pathname={pathname} from={from} badges={tabBadges} />} />}
    </>
  );
}

/**
 * 남은 풀이권 — **화면 크기와 관계없이 톱니 옆에 선다.**
 *
 * ## 서버에 안 묻는다
 *
 * 머리글은 `/` 와 `/compat` 에도 서는데 그 둘은 정적으로 미리 그려진다 — 서버에서 잔액을 읽으면 세션도
 * 없는 방문마다 화면이 요청마다 도는 것이 된다. 그래서 `router.refresh()` 로는 안 바뀐다 — 잔액이 움직이는
 * 자리가 한 마디 외치고(`announceCreditsMoved`) 여기서 듣는다.
 *
 * ## 모르면 안 세운다
 *
 * 「—」이나 「불러오는 중」을 세우면 사용자가 있지도 않은 숫자를 세어 보게 된다.
 */
function useReadingCredits(enabled: boolean): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let watching = true;
    const read = async () => {
      /* **서버 쪽 풀이권과 같은 문이다**(ADR 0078) — 칸 이름을 여기서 다시 안 적는다 */
      const credits = await readReadingCredits(supabaseInBrowser());
      if (!watching) return;

      setLabel(
        credits.ok && credits.value !== null
          ? readingCreditsLabel({
              limit: credits.value.limit,
              available: credits.value.available,
            })
          : null,
      );
    };

    void read();
    window.addEventListener(READING_CREDITS_MOVED, read);

    return () => {
      watching = false;
      window.removeEventListener(READING_CREDITS_MOVED, read);
    };
  }, [enabled]);

  return enabled ? label : null;
}

/**
 * 안 읽은 수 — 채팅 탭의 메시지 수, 인연 탭의 답할 요청 수, 종의 소식 수. **셋은 섞지 않는다**(PRD 「앱 내 채팅」: 새
 * 메시지는 소식이 아니다). 요청이 왔다는 소식은 종이 안 센다 — 그 요청은 인연 탭이 센다(ADR 0130).
 *
 * 문은 각각 하나다(`me/chat/unread.ts` · `me/requests/unread.ts`, ADR 0078). 못 읽었거나 0 이면 안 세운다 —
 * 모르는 수를 세어 보게 하지 않는다. 화면을 옮길 때마다, 그리고 창 신호(`*_UNREAD_MOVED`)가 올 때 다시 센다 —
 * 그 신호는 화면의 읽음 처리와 계정 채널의 「바뀌었다」(라이브 층, ADR 0155)가 낸다.
 */
function useUnreadCount(
  enabled: boolean,
  pathname: string,
  door: typeof readUnreadChat,
  signal: string,
): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let watching = true;
    const read = async () => {
      const unread = await door(supabaseInBrowser());
      if (watching) setCount(unread.ok ? unread.value : 0);
    };

    void read();
    window.addEventListener(signal, read);

    return () => {
      watching = false;
      window.removeEventListener(signal, read);
    };
  }, [enabled, pathname, door, signal]);

  return enabled ? count : 0;
}

/** 딱지 뒤의 보이지 않는 말 — 수만으로는 무엇을 센 것인지 모른다 */
const BADGE_WORDS: Partial<Record<(typeof MEMBER_TABS)[number]['href'], string>> = { '/me/matching': '건 답할 요청' };

function UnreadBadge({ count, words = '건 안 읽음' }: { count: number; words?: string }) {
  if (count === 0) return null;
  return (
    <span className={BADGE}>
      {count}
      <span className="sr-only">{words}</span>
    </span>
  );
}

function Credits({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-cream px-3 text-[12px] font-semibold tabular-nums text-cream-ink ring-1 ring-border">
      <Icon name="ticket" className="hidden size-4 md:block" />
      <span>{label}</span>
    </span>
  );
}

/**
 * 소식 — **종 하나와 안 읽은 수.** 탭에서 빠졌지만 1클릭은 그대로다. 수는 딱지로, 이름은 보조기기에게
 * 「소식」으로 선다(글자는 안 보이고 그림이 말한다).
 */
function NewsBell({ count, active }: { count: number; active: boolean }) {
  return (
    <Link
      href="/me/requests"
      aria-current={active ? 'page' : undefined}
      title="소식"
      className={active ? ICON_BUTTON_ACTIVE : ICON_BUTTON}
    >
      <Icon name="bell" />
      <span className="sr-only">소식</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1">
          <UnreadBadge count={count} />
        </span>
      )}
    </Link>
  );
}

/**
 * 폰의 하단 독 — **탭 넷, 둥근 판.** 화면 가장자리에서 조금 떠 있고, 켜진 탭은 아이콘 뒤에 파스텔 알약이
 * 깔린다. 아래 여백은 `globals.css` 가 이 판의 `id` 를 보고 비운다.
 */
function Dock({
  pathname,
  from,
  badges,
}: {
  pathname: string;
  /** 결과 화면이 온 곳(`?from=`) — 불을 온 곳에 켠다(ADR 0134) */
  from: string | null;
  badges: Partial<Record<(typeof MEMBER_TABS)[number]['href'], number>>;
}) {
  return (
    <nav
      id="mobile-member-navigation"
      aria-label="모바일 내 메뉴"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4 rounded-[1.75rem] bg-surface/95 p-1.5 shadow-raise ring-1 ring-border backdrop-blur-xl">
        {MEMBER_TABS.map((tab) => {
          const active = isNavigationActive(pathname, tab.href, from);
          return (
            <li key={tab.href} className="min-w-0">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.25rem] text-[12px] font-semibold active:scale-95 ${
                  active ? 'text-foreground' : 'text-secondary hover:text-foreground'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-8 w-14 place-items-center rounded-full ${active ? 'bg-wood-soft text-wood' : ''}`}
                >
                  <Icon name={tab.icon} />
                </span>
                {tab.label}
                {(badges[tab.href] ?? 0) > 0 && (
                  <span className="absolute right-[calc(50%-1.75rem)] top-0.5">
                    <UnreadBadge count={badges[tab.href] ?? 0} words={BADGE_WORDS[tab.href]} />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * 톱니 — **프로필 · 계정 관리 · 서비스 설문 · 로그아웃.** 폰과 넓은 화면이 같은 판이다.
 *
 * 서비스 설문은 탭에서 빠졌지만 주소와 기능은 그대로고 늘 열려 있다(ADR 0062) — 답할 사람이 자기 때에
 * 하게 길을 하나 둔다.
 *
 * `<details>` 는 안의 링크를 눌러도 스스로 안 닫힌다. 닫는 자리를 셋 둔다. **주소가 바뀌면**, **눌렀으면**
 * (같은 화면으로 가는 누름은 주소를 안 바꾼다), 그리고 **바깥을 누르거나 Esc 를 누르면**(`useDetailsMenu`).
 */
function SettingsMenu({
  email,
  ended = false,
}: {
  email: string | null;
  /**
   * 베타가 끝난 화면인가 — 그때 **아직 열려 있는 길은 계정 관리 하나**다(`gateFor`: 끝난 뒤 지나가는 것은
   * `/me/settings` 뿐이다). 프로필도 설문도 누르면 이 화면으로 되돌아온다.
   */
  ended?: boolean;
}) {
  const pathname = usePathname();
  const { menu: panel, close } = useDetailsMenu();
  /*
    판은 누른 뒤에도 열어 둔다 — 「로그아웃하는 중…」과 실패 문장이 이 판 안에 선다. 먼저 닫으면 실패가 닫힌 판 안에
    서서 아무에게도 안 보였다. 되면 주소가 바뀌며 닫힌다(아래 `useEffect`).
  */
  const { leaving, failure, signOut } = useSignOut();

  /*
    **주소가 바뀔 때만** 닫는다 — 처음 붙을 때는 안 닫는다. 서버 HTML 의 `<details>` 는 하이드레이션 전에도 눌려
    열리는데, 붙자마자 닫으면 막 연 판이 저절로 닫혔다(느린 폰 · CI 에서 톱니 시험 넷이 흔들림, 2026-09-26).
  */
  const shownAt = useRef(pathname);
  useEffect(() => {
    if (shownAt.current === pathname) return;
    shownAt.current = pathname;
    close();
  }, [pathname, close]);

  const links = ended
    ? [{ href: '/me/settings', label: '계정 관리' }]
    : [
        /* 이름은 앱 전체의 것이라 길도 앱 전체의 자리(톱니)에 선다 */
        { href: '/me/profile', label: '프로필' },
        { href: '/me/settings', label: '계정 관리' },
        { href: '/me/survey', label: SURVEY_COPY.tab },
      ];

  return (
    <details ref={panel} className="group relative shrink-0">
      <summary
        className={`${ICON_BUTTON} list-none [&::-webkit-details-marker]:hidden`}
        aria-label="설정 메뉴"
      >
        <Icon name="gear" />
      </summary>
      {/*
        **주소는 자르지 않는다** — 첫 줄은 「어느 계정으로 들어와 있나」를 말하는 자리라 끝이 잘리면 그 말을 못 한다
        (2026-10-09 화면 갤러리 감사, 「…@example.c…」). 판을 조금 넓히고 넘치는 주소는 다음 줄로 꺾는다.
      */}
      <div className="absolute right-0 top-13 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-[1.25rem] bg-surface p-2 shadow-float ring-1 ring-border">
        {email && <p className="break-all border-b border-border px-3 pb-2 pt-1 text-[13px] leading-5 text-muted">{email}</p>}
        <ul className="mt-1 flex flex-col">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={close}
                aria-current={pathname === link.href ? 'page' : undefined}
                className="flex min-h-11 items-center rounded-xl px-3 text-[15px] font-semibold hover:bg-surface-soft active:bg-surface-sunken aria-[current=page]:bg-accent-wash"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={signOut}
          disabled={leaving}
          className="mt-1 flex min-h-11 w-full items-center rounded-xl border-t border-border px-3 text-left text-[15px] text-secondary hover:bg-surface-soft hover:text-foreground disabled:opacity-60"
        >
          {leaving ? '로그아웃하는 중…' : '로그아웃'}
        </button>
        {failure && (
          <p role="alert" className="px-3 py-2 text-[13px] text-danger">
            {failure}
          </p>
        )}
      </div>
    </details>
  );
}
