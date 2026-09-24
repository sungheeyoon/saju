'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { SERVICE_NAME } from '@/src/lib/brand';
import { CHAT_TAB_LABEL } from '@/src/lib/chat';
import { readingCreditsLabel } from '@/src/lib/reading';
import { SURVEY_COPY } from '@/src/lib/survey';

import { supabaseInBrowser } from './auth/browser-client';
import { readUnreadChat } from './me/chat/unread';
import { CHAT_UNREAD_MOVED } from './me/chat/unread-signal';
import { readReadingCredits } from './me/reading/credits';
import { READING_CREDITS_MOVED } from './me/reading/credits-signal';
import { readUnreadNotifications } from './me/requests/unread';
import { NOTIFICATIONS_UNREAD_MOVED } from './me/requests/unread-signal';
import { isSharePath } from './share/path';
import { BUTTON_SECONDARY_SMALL, ICON_BUTTON } from './ui/buttons';
import { Icon, type IconName } from './ui/icons';
import { BrandMark } from './ui/logo';
import { BADGE } from './ui/surfaces';

/**
 * 로그인한 사람의 탭 — **홈 · 매칭 · 풀이 · 채팅 넷**(2026-09-24 사용자 결정, 5차).
 *
 * 일곱 줄(내 사주 · 매칭 · 사주·궁합 · 사람 · 풀이 · 채팅 · 소식 · 서비스 설문)이 폰에서 여섯 칸과 전체 메뉴로
 * 갈라져 있었다. 이제 **홈이 사람 · 다른 사람 사주 · 궁합으로 가는 길을 품고**, 소식은 종으로, 프로필 · 계정
 * 관리 · 서비스 설문은 톱니 안으로 들어간다. 주소는 그대로다 — 홈은 `/me` 이고 이름만 바뀌었다(관문 ·
 * 동의 · 경고 안내 · 로그인 복귀가 전부 `/me` 기준이다).
 *
 * **만든 글이 사는 자리는 메뉴에 있다**(ADR 0033) — 「풀이」. 대화방 목록도 탭이다(PRD §7.1 · §7.4.1).
 */
const MEMBER_TABS = [
  { href: '/me', label: '홈', icon: 'home' },
  { href: '/me/matching', label: '매칭', icon: 'people' },
  { href: '/me/readings', label: '풀이', icon: 'reading' },
  { href: '/me/chat', label: CHAT_TAB_LABEL, icon: 'chat' },
] as const satisfies readonly { href: string; label: string; icon: IconName }[];

/**
 * 지금 보고 있는 화면이 **어느 탭의 것인가.**
 *
 * - **홈**은 `/me` 와 거기서 뻗는 길이다 — 저장한 사람(`/me/people/*`),
 *   궁합(`/compat` · `/me/compat`), 그리고 로그인한 사람이 보는 사주 계산(`/`). 사람 · 사주·궁합 탭이 빠지며
 *   그 길이 홈 안에 섰다 — 거기 있는 동안 불은 홈에 있어야 사용자가 어디서 왔는지 안다.
 * - **풀이**는 만든 글의 목록과 그 목록에서 열리는 글(`/me/readings/*` — 내 사주풀이도 목록 옆에서 열린다, 함께 보는 궁합 `/me/match/*`)이다.
 *   내 사주풀이는 목록에도 서지만 닿는 길이 대개 홈이라 홈 쪽이다(탭 안에서 움직이면 메뉴는 안 움직인다).
 * - 채팅 · 매칭 · 종(`/me/requests`)은 제 주소와 그 아래다.
 */
export function isNavigationActive(pathname: string, href: string): boolean {
  if (href === '/me') {
    return (
      pathname === '/me' ||
      pathname === '/me/people' ||
      pathname.startsWith('/me/people/') ||
      pathname === '/compat' ||
      pathname === '/me/compat' ||
      pathname === '/'
    );
  }
  if (href === '/me/readings') {
    return pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith('/me/match/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * 로그인했는지 — **문을 지키는 값이 아니라 길을 가리키는 값이다.**
 *
 * 쿠키를 브라우저에서 그냥 읽는다(`getSession`). 서버에 물어 JWT 를 검증하지 않는
 * 것은 이 값으로 무엇을 열고 닫지 않기 때문이다 — 무엇을 볼 수 있는지는 DB 정책이
 * 정하고, `/me` 는 자기 자리에서 다시 묻는다(`proxy.ts` 와 같은 규율: 판정하는
 * 자리를 둘로 만들지 않는다). 여기서 정하는 것은 「어느 쪽으로 가는 길을 보일까」뿐이다.
 *
 * 서버에서 읽지 않는 이유는 더 단순하다. `/` 와 `/compat` 은 **정적으로 미리 그려지고**
 * proxy 도 일부러 안 지나간다. 헤더 하나 때문에 그 두 화면이 요청마다 도는 화면이 되면,
 * 세션도 없는 방문마다 Supabase 를 두드리게 된다.
 */
type Session = 'unknown' | 'in' | 'out';

export function SiteHeader() {
  const pathname = usePathname();
  const protectedPath = pathname.startsWith('/me') || pathname === '/compat';
  const [session, setSession] = useState<Session>('unknown');
  const [email, setEmail] = useState<string | null>(null);
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
  const memberNavigation = !shared && (protectedPath || session === 'in');
  const live = memberNavigation && !ended;
  /* 남은 풀이권은 끝난 뒤에 셀 것이 아니다 — 쓸 자리가 없다 */
  const creditsLabel = useReadingCredits(session === 'in' && !ended);
  const unreadChat = useUnreadCount(live, pathname, readUnreadChat, CHAT_UNREAD_MOVED);
  const unreadNews = useUnreadCount(live, pathname, readUnreadNotifications, NOTIFICATIONS_UNREAD_MOVED);
  /** 로그인 화면에서 「로그인」은 지금 보고 있는 화면으로 가는 버튼이다 */
  const onAuthScreen = pathname.startsWith('/auth');

  useEffect(() => {
    const supabase = supabaseInBrowser();
    let watching = true;

    supabase.auth.getSession().then(({ data }) => {
      if (watching) {
        setSession(data.session === null ? 'out' : 'in');
        setEmail(data.session?.user.email ?? null);
      }
    });

    // 톱니 메뉴나 계정 관리 화면에서 로그아웃하면 머리글도 바로 공개 모양으로 돌아간다.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next === null ? 'out' : 'in');
      setEmail(next?.user.email ?? null);
    });

    return () => {
      watching = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="app-shell flex h-16 items-center gap-2 md:gap-5">
          <Link
            href={memberNavigation ? '/me' : '/'}
            className="flex min-h-11 shrink-0 items-center rounded-full pr-1"
            aria-label={`${SERVICE_NAME} 홈`}
          >
            {/* 폰 폭 360px 에서는 풀이권 · 종 · 톱니가 자리를 먼저 쓴다 — 이름은 로고가 대신한다 */}
            <BrandMark nameClassName="hidden min-[380px]:inline" />
          </Link>

          {/*
            **탭이 없으면 `<nav>` 를 안 세운다.** 빈 길잡이는 보조기기에 「메뉴가 있다」고 알리고 열어 보면
            아무것도 없다. 자리는 남긴다 — 오른쪽 끝이 머리글 바깥으로 붙어 서지 않게.
          */}
          {live ? (
            <nav aria-label="내 메뉴" className="hidden min-w-0 flex-1 justify-center md:flex">
              <ul className="flex items-center gap-1 rounded-full bg-surface p-1 ring-1 ring-border">
                {MEMBER_TABS.map((tab) => {
                  const active = isNavigationActive(pathname, tab.href);
                  return (
                    <li key={tab.href}>
                      <Link
                        href={tab.href}
                        aria-current={active ? 'page' : undefined}
                        className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[15px] font-semibold active:scale-[0.97] ${
                          active ? 'bg-accent text-on-accent' : 'text-secondary hover:bg-surface-soft hover:text-foreground'
                        }`}
                      >
                        <Icon name={tab.icon} className="hidden size-[18px] lg:block" />
                        {tab.label}
                        {tab.href === '/me/chat' && <UnreadBadge count={unreadChat} />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ) : null}
          <div aria-hidden="true" className={`min-w-0 flex-1 ${live ? 'md:hidden' : ''}`} />

          {/*
            **익명 화면이라고 로그아웃된 것이 아니다.** 로그인한 사람도 공개 사주 계산 화면으로 올 수 있다.
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
              {live && <NewsBell count={unreadNews} active={isNavigationActive(pathname, '/me/requests')} />}
              <SettingsMenu email={email} ended={ended} />
            </div>
          ) : session === 'unknown' || onAuthScreen || shared ? (
            <span aria-hidden="true" className={`${BUTTON_SECONDARY_SMALL} invisible`}>
              로그인
            </span>
          ) : (
            <Link href="/auth" className={BUTTON_SECONDARY_SMALL}>
              로그인
            </Link>
          )}
        </div>
      </header>
      {live && <Dock pathname={pathname} unreadChat={unreadChat} />}
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
 * 안 읽은 수 — 채팅 탭의 메시지 수와 종의 소식 수, **둘은 섞지 않는다**(PRD §7.1: 새 메시지는 소식이 아니다).
 *
 * 문은 각각 하나다(`me/chat/unread.ts` · `me/requests/unread.ts`, ADR 0078). 못 읽었거나 0 이면 안 세운다 —
 * 모르는 수를 세어 보게 하지 않는다. 화면을 옮길 때마다, 그리고 그 화면이 읽음 처리가 끝났다고 창에
 * 알릴 때(`*_UNREAD_MOVED`) 다시 센다 — 실시간은 아니다.
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

function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className={BADGE}>
      {count}
      <span className="sr-only">건 안 읽음</span>
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
      className={`${ICON_BUTTON} ${active ? 'bg-accent text-on-accent ring-accent' : ''}`}
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
function Dock({ pathname, unreadChat }: { pathname: string; unreadChat: number }) {
  return (
    <nav
      id="mobile-member-navigation"
      aria-label="모바일 내 메뉴"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4 rounded-[1.75rem] bg-surface/95 p-1.5 shadow-[0_10px_30px_-12px_rgba(60,48,30,0.45)] ring-1 ring-border backdrop-blur-xl">
        {MEMBER_TABS.map((tab) => {
          const active = isNavigationActive(pathname, tab.href);
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
                {tab.href === '/me/chat' && unreadChat > 0 && (
                  <span className="absolute right-[calc(50%-1.75rem)] top-0.5">
                    <UnreadBadge count={unreadChat} />
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
 * (같은 화면으로 가는 누름은 주소를 안 바꾼다), 그리고 **바깥을 누르거나 Esc 를 누르면.**
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
  const router = useRouter();
  const pathname = usePathname();
  const panel = useRef<HTMLDetailsElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const close = () => {
    if (panel.current !== null) panel.current.open = false;
  };

  useEffect(close, [pathname]);

  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (panel.current !== null && !panel.current.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  const signOut = async () => {
    setLeaving(true);
    setFailure(null);
    close();
    const { error } = await supabaseInBrowser().auth.signOut();
    if (error) {
      setLeaving(false);
      setFailure('로그아웃하지 못했습니다. 다시 시도해 주세요.');
      return;
    }
    router.replace('/');
    router.refresh();
  };

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
      <div className="absolute right-0 top-13 z-50 w-60 rounded-[1.25rem] bg-surface p-2 shadow-[var(--shadow-float)] ring-1 ring-border">
        {email && <p className="truncate border-b border-border px-3 pb-2 pt-1 text-[13px] text-muted">{email}</p>}
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
