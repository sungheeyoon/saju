'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { readingCreditsLabel } from '@/src/lib/reading';

import { supabaseInBrowser } from './auth/browser-client';
import { READING_CREDITS_MOVED } from './me/reading/credits-signal';
import { isSharePath } from './share/path';

/**
 * 로그인하지 않은 사람의 메뉴 — **비어 있다.**
 *
 * 「궁합 보기」가 먼저 빠졌다. `/compat` 은 로그인해야 열리는 자리라, 메뉴에서 그것을
 * 누른 사람은 로그인 화면을 만난다 — **메뉴는 지금 갈 수 있는 곳의 목록이지 제품
 * 기능의 목록이 아니다.** 그 길은 사주 화면의 머리에 「로그인 필요」를 달고 서 있다
 * (`compat-entry.tsx`).
 *
 * 남은 「사주 보기」 하나도 뺀다. 로그인하지 않은 사람이 볼 수 있는 화면은 `/` 뿐이라
 * **그 탭은 언제나 지금 보고 있는 화면을 가리켰다** — 눌러도 아무 데도 안 가는 줄은
 * 길이 아니라 라벨이다. 돌아오는 길은 로고가 든다(같은 `/` 로 간다).
 *
 * 회원 메뉴에는 그 이름이 그대로 남는다. 거기서는 여러 화면 사이에서 **고르는 자리**라
 * 이름이 일을 한다.
 */
const PUBLIC_LINKS = [] as const;

/**
 * 로그인한 사람의 메뉴 — **「내 사주」가 홈이고, 계산기는 메뉴 안에 있다.**
 *
 * 로고는 이미 `/me` 로 가고 로그인도 거기로 떨어진다(`safeReturnPath`). 그런데 회원
 * 메뉴에는 `/` 로 가는 길이 한 줄도 없었다 — 저장하지 않은 남의 생년월일시로 한 번
 * 계산해 보는 자리를, 로그인하고 나면 주소를 직접 쳐야만 열 수 있었다.
 *
 * 사주 계산과 궁합은 한 흐름이다. 궁합은 사주 화면 안의 「궁합 보기」로도 시작하고
 * 별도 `/compat` 메뉴도 같은 곳으로 가므로, 회원 메뉴에서는 `사주·궁합` 한 이름으로
 * 묶는다. 실제 화면 주소는 그대로라 직접 입력과 저장한 사람 흐름을 잃지 않는다.
 */
const MEMBER_LINKS = [
  { href: '/me', label: '내 사주' },
  { href: '/', label: '사주·궁합' },
  { href: '/me/people', label: '사람' },
  /**
   * **만든 글이 사는 자리는 메뉴에 있다**(ADR 0033).
   *
   * 풀이가 네 화면에 흩어져 있어서, 만든 글에 닿으려면 그것이 어느 화면의 것인지를
   * 먼저 기억해야 했다. 저장돼 있는데 닿을 수 없는 것은 사용자에게 없는 것과 같다.
   */
  { href: '/me/readings', label: '풀이' },
  { href: '/me/requests', label: '소식' },
  /**
   * **서비스 설문은 늘 열려 있다**(ADR 0062).
   *
   * 잔액이 0이 된 사람이나 종료 3일 전에 띠를 세우는 안이 있었는데, 그러면 답할 사람을
   * 우리가 고르는 것이 되고 표본이 「다 써 본 사람」 쪽으로 기운다. 길을 하나 두고 할
   * 사람이 자기 때에 하게 한다 — **메뉴는 지금 갈 수 있는 곳의 목록**이고, 이 자리는
   * 언제나 갈 수 있다.
   */
  { href: '/me/survey', label: '서비스 설문' },
] as const;

/** 모바일에서 늘 보이는 다섯 길 — 나머지 둘은 전체 메뉴에 둔다. */
const MOBILE_LINKS = [
  { href: '/me', label: '내 사주', icon: 'home' },
  { href: '/', label: '사주·궁합', icon: 'compat' },
  { href: '/me/people', label: '사람', icon: 'people' },
  { href: '/me/readings', label: '풀이', icon: 'reading' },
  { href: '/me/requests', label: '소식', icon: 'news' },
] as const;

/** 헤더 오른쪽 끝에 서는 것 — 셋이 같은 자리를 쓰므로 크기가 흔들리지 않는다 */
const TRAILING =
  'shrink-0 rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent';

export function isNavigationActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname === '/compat' || pathname === '/me/compat';
  if (href === '/me') return pathname === href;
  if (href === '/me/readings' && pathname.startsWith('/me/match/')) return true;
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
   * **끝난 뒤에는 길을 안 세운다.**
   *
   * 베타가 끝나면 모든 화면이 `/closed` 로 되돌려진다(`proxy.ts`). 그런데 헤더는 그대로
   * 일곱 길과 풀이권 배지를 이고 있었다 — 누르면 전부 이 화면으로 되돌아오는 죽은 길
   * 일곱 개다. 남는 것은 **아직 할 수 있는 일**뿐이다: 계정 메뉴(계정 관리·로그아웃).
   */
  const ended = pathname === '/closed';
  /**
   * **공유본 화면에서는 헤더가 접힌다.**
   *
   * `/closed` 와 같은 자리에 같은 까닭으로 선다 — 거기서는 길이 죽어서 걷었고,
   * 여기서는 **이 화면의 것이 아니어서** 걷는다. 링크를 받고 들어온 사람에게 남의
   * 회원 메뉴와 풀이권 잔액은 길이 아니다. 그리고 보낸 사람이 자기 링크를 열어
   * 확인할 때도 같아야 한다 — 받는 사람이 볼 화면을 보러 온 것이기 때문이다.
   *
   * 화면 자신이 이름과 시작하는 길을 이미 세우므로(`share/readings/[token]`),
   * 여기서는 로고 한 줄만 남는다.
   */
  const shared = isSharePath(pathname);
  const memberNavigation = !shared && (protectedPath || session === 'in');
  const links = ended || shared ? [] : memberNavigation ? MEMBER_LINKS : PUBLIC_LINKS;
  /* 남은 풀이권은 끝난 뒤에 셀 것이 아니다 — 쓸 자리가 없다 */
  const creditsLabel = useReadingCredits(session === 'in' && !ended);
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

    // 계정 메뉴나 계정 관리 화면에서 로그아웃하면 헤더도 바로 공개 메뉴로 돌아간다.
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
      <header className="sticky top-0 z-40 border-b border-border bg-background/88 backdrop-blur-xl">
        <div className="app-shell flex h-16 items-center gap-5">
          <Link
            href={memberNavigation ? '/me' : '/'}
            className="flex shrink-0 items-center gap-2.5"
            aria-label="만세력 홈"
          >
            <span className="grid size-8 place-items-center rounded-xl bg-accent text-sm font-bold text-on-accent shadow-sm">
              命
            </span>
            <span className="hidden text-sm font-bold tracking-[-0.03em] sm:inline">만세력</span>
          </Link>
          {/*
          **줄이 하나도 없으면 `<nav>` 를 안 세운다.** 빈 길잡이는 보조기기에 「메뉴가
          있다」고 알리고 열어 보면 아무것도 없다. 자리는 남긴다 — 오른쪽 끝이 헤더
          바깥으로 붙어 서지 않게.
          */}
          {links.length === 0 ? (
            <div className="min-w-0 flex-1" />
          ) : (
            <>
              <div aria-hidden="true" className="min-w-0 flex-1 sm:hidden" />
              <nav
                aria-label={memberNavigation ? '내 메뉴' : '주요 메뉴'}
                className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:flex"
              >
                {links.map((link) => {
                  const active = isNavigationActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${active ? 'bg-accent-wash text-accent-strong' : 'text-secondary hover:bg-surface-soft hover:text-foreground'}`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </>
          )}
          {/*
          **익명 화면이라고 로그아웃된 것이 아니다.**

          로그인한 사람도 공개 사주 계산 화면으로 올 수 있다. 그런데 그 자리에
          「로그인」이 서 있으면 세션이 풀린 것처럼 보이고 내 메뉴로 돌아갈 길도 없다.

          아직 모르는 동안에는 **둘 다 안 보인다.** 「로그인」을 먼저 세우면 로그인한
          사람이 한 번 깜빡이는 거짓말을 보고, 계정 메뉴를 먼저 세우면 그 반대다.
          자리만 잡아 두면 글자가 늦게 오는 것으로 끝난다.
          */}
          {memberNavigation ? (
            <>
              {/*
              **세션을 확인한 뒤에만 세운다.** 아직 모르는 동안 세우면 로그인 없는
              질의가 한 번 나가고, 로그인 뒤에도 그 실패한 자리에 그대로 머문다.
              달렸다 떨어지는 것으로 그 둘을 가른다 — 붙어 있는 칸이 스스로 「지금은
              아니다」를 판정하면 그 판정이 또 한 자리가 된다.
              */}
              {creditsLabel !== null && <Credits label={creditsLabel} />}
              <AccountMenu email={email} variant="mobile" ended={ended} />
              <AccountMenu email={email} variant="desktop" ended={ended} />
            </>
          ) : (
            session === 'unknown' || onAuthScreen || shared ? (
              <span aria-hidden="true" className={`${TRAILING} invisible`}>
                로그인
              </span>
            ) : (
              <Link href="/auth" className={TRAILING}>
                로그인
              </Link>
            )
          )}
        </div>
      </header>
      {memberNavigation && !ended && <MobileNavigation pathname={pathname} />}
    </>
  );
}

/**
 * 남은 풀이권 — **화면 크기와 관계없이 계정 메뉴 옆에 선다.**
 *
 * 한동안 만드는 버튼 아래에 있었다. 「누를지 정할 때 눈이 가 있는 곳」이라는 이유였고
 * 그건 지금도 맞다. 그런데 풀이권은 **이 글의 성질이 아니라 계정의 성질**이다. 화면마다
 * 세우면 넷에 같은 숫자가 네 번 서고, 그중 하나를 안 고치는 날이 온다. 계정에 딸린 것은
 * 계정이 사는 자리에 둔다.
 *
 * ## 서버에 안 묻는다
 *
 * 이 파일이 세션을 브라우저에서 읽는 것과 같은 까닭이다. 헤더는 `/` 와 `/compat` 에도
 * 서는데 그 둘은 정적으로 미리 그려진다 — 서버에서 잔액을 읽으면 세션도 없는 방문마다
 * 화면이 요청마다 도는 것이 된다.
 *
 * ## 그래서 `router.refresh()` 로는 안 바뀐다
 *
 * 서버가 다시 그리는 것은 서버 컴포넌트뿐이고 이 `useEffect` 는 다시 돌지 않는다.
 * 잔액이 움직이는 자리가 한 마디 외치고(`announceCreditsMoved`) 여기서 듣는다.
 *
 * ## 모르면 안 세운다
 *
 * 못 물었거나 아직 안 물은 동안에는 빈 자리다. 「—」이나 「불러오는 중」을 세우면
 * 사용자가 있지도 않은 숫자를 세어 보게 되고, 그 자리는 대부분의 시간 동안 거짓말이다.
 */
function useReadingCredits(enabled: boolean): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let watching = true;
    const read = async () => {
      const { data, error } = await supabaseInBrowser().rpc('my_reading_credits');
      if (!watching) return;

      const row = ((data ?? []) as Record<string, unknown>[])[0];
      if (error || row === undefined) {
        setLabel(null);
        return;
      }

      setLabel(
        readingCreditsLabel({
          limit: row.credit_limit as number,
          available: row.available as number,
        }),
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

function Credits({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-accent-wash px-2.5 py-1.5 text-xs font-semibold tabular-nums text-accent">
      {label}
    </span>
  );
}

function MobileNavigation({ pathname }: { pathname: string }) {
  return (
    <nav
      id="mobile-member-navigation"
      aria-label="모바일 내 메뉴"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl sm:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 px-1">
        {MOBILE_LINKS.map((link) => {
          const active = isNavigationActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold ${active ? 'text-accent' : 'text-muted hover:text-foreground'}`}
            >
              <MobileNavIcon name={link.icon} />
              <span className="truncate">{link.label}</span>
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function MobileNavIcon({ name }: { name: (typeof MOBILE_LINKS)[number]['icon'] }) {
  const paths = {
    home: <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4Z" />,
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.4-3.3 2.2-5 5.5-5s5.1 1.7 5.5 5M15 6.5a2.5 2.5 0 0 1 0 5M16 14c2.7.2 4.2 1.8 4.5 4.5" />
      </>
    ),
    compat: <path d="M12 20.5 4.6 13.4A4.8 4.8 0 0 1 11.4 6l.6.7.6-.7a4.8 4.8 0 0 1 6.8 7.4Z" />,
    reading: (
      <>
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 4H12v16H7.5A3.5 3.5 0 0 0 4 21.5ZM20 5.5A3.5 3.5 0 0 0 16.5 4H12v16h4.5a3.5 3.5 0 0 1 3.5 1.5Z" />
      </>
    ),
    news: (
      <>
        <path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 8H4c0-1 2-1 2-8Z" />
        <path d="M9.5 20h5" />
      </>
    ),
  } as const;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 fill-none stroke-current"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

/**
 * 계정 메뉴 — **모바일에서는 전체 메뉴, 데스크톱에서는 설정 메뉴다.**
 *
 * 모바일은 위 내비게이션에서 빠진 길까지 품으므로 삼선 아이콘을 쓰고, 데스크톱은
 * 내비게이션이 이미 모두 서 있으므로 계정 설정이라는 본래 역할의 톱니바퀴를 쓴다.
 *
 * `<details>` 는 안의 링크를 눌러도 스스로 안 닫힌다. 앱 안 이동은 화면만 갈아 끼우므로
 * 펼쳐진 판이 새 화면 위에 그대로 얹혀 있었다 — 사용자가 기어를 한 번 더 눌러야 치워졌다.
 *
 * 닫는 자리를 셋 둔다. **주소가 바뀌면**(다른 화면으로 갔다), **눌렀으면**(같은 화면으로
 * 가는 누름은 주소를 안 바꾼다 — 계정 관리에서 계정 관리를 누르는 경우), 그리고 **바깥을
 * 누르거나 Esc 를 누르면.** 마지막은 열어 두면 같은 불평이 한 걸음 뒤에 다시 온다 —
 * 펼친 판이 안 닫히는 것은 어느 쪽이든 같은 고장이다.
 */
function AccountMenu({
  email,
  variant,
  ended = false,
}: {
  email: string | null;
  variant: 'mobile' | 'desktop';
  /**
   * 베타가 끝난 화면인가 — 그때 **아직 열려 있는 길은 계정 관리 하나**다
   * (`gateFor`: 끝난 뒤 지나가는 것은 `/me/settings` 뿐이다). 프로필도 다른 설정도
   * 누르면 이 화면으로 되돌아온다.
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

  return (
    <details
      ref={panel}
      className={`group relative shrink-0 ${variant === 'mobile' ? 'sm:hidden' : 'hidden sm:block'}`}
    >
      <summary
        className="grid size-10 cursor-pointer list-none place-items-center rounded-full border border-border-strong bg-surface text-secondary hover:border-accent hover:text-accent [&::-webkit-details-marker]:hidden"
        aria-label={variant === 'mobile' ? '전체 메뉴' : '설정 메뉴'}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4.5 fill-none stroke-current" strokeWidth="1.8">
          {variant === 'mobile' ? (
            <path d="M4 6.5h16M4 12h16M4 17.5h16" strokeLinecap="round" />
          ) : (
            <>
              <path d="M12 8.25A3.75 3.75 0 1 0 12 15.75 3.75 3.75 0 0 0 12 8.25Z" />
              <path d="M19.2 13.1a7.7 7.7 0 0 0 0-2.2l2-1.55-2-3.45-2.48 1a8 8 0 0 0-1.9-1.1L14.45 3h-4.1l-.38 2.8a8 8 0 0 0-1.9 1.1l-2.48-1-2 3.45 2 1.55a7.7 7.7 0 0 0 0 2.2l-2 1.55 2 3.45 2.48-1a8 8 0 0 0 1.9 1.1l.38 2.8h4.1l.38-2.8a8 8 0 0 0 1.9-1.1l2.48 1 2-3.45-2.01-1.55Z" />
            </>
          )}
        </svg>
      </summary>
      <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-border bg-surface p-2 shadow-[var(--shadow-float)]">
        {email && <p className="truncate border-b border-border px-3 py-2 text-xs text-muted">{email}</p>}
        {/*
          **프로필로 가는 길은 여기다.** 가입할 때 한 번 짓고 나면 그 화면을 다시 찾을
          자리가 없었다 — 예전 인연 설정 안의 한 줄로만 닿았고, 인연에 참여하지 않는 사람은
          그 화면에 갈 이유가 없다. 이름은 앱 전체의 것이므로 길도 앱 전체의 자리에 선다.
        */}
        {!ended && (
          <Link
            href="/me/profile"
            onClick={close}
            className="mt-1 block rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-surface-soft"
          >
            프로필
          </Link>
        )}
        {/*
          **모바일에서는 이 판이 전체 메뉴다.** 하단 다섯 자리는 안 건드리고 나머지 길을
          여기 둔다는 규칙이 이미 있고, 서비스 설문도 그 나머지다. 데스크톱은 위 줄에
          이미 서 있으므로 여기 또 세우지 않는다 — 한 화면에 같은 길이 두 번 서면 어느
          쪽이 그 화면의 길인지 사용자가 정하게 된다.
        */}
        {!ended && variant === 'mobile' && (
          <Link
            href="/me/survey"
            onClick={close}
            className="block rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-surface-soft"
          >
            서비스 설문
          </Link>
        )}
        <Link
          href="/me/settings"
          onClick={close}
          className="block rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-surface-soft"
        >
          계정 관리
        </Link>
        <button
          type="button"
          onClick={signOut}
          disabled={leaving}
          className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-secondary hover:bg-surface-soft hover:text-foreground disabled:opacity-60"
        >
          {leaving ? '로그아웃하는 중…' : '로그아웃'}
        </button>
        {failure && <p role="alert" className="px-3 py-2 text-xs text-danger">{failure}</p>}
      </div>
    </details>
  );
}
