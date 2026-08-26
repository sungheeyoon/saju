'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { supabaseInBrowser } from './auth/browser-client';

const PUBLIC_LINKS = [
  { href: '/', label: '내 명식' },
  { href: '/compat', label: '두 사람 궁합' },
] as const;

const MEMBER_LINKS = [
  { href: '/me', label: '홈' },
  { href: '/me/people', label: '사람' },
  { href: '/me/compat', label: '궁합' },
  { href: '/me/discovery', label: '발견' },
  { href: '/me/requests', label: '알림' },
] as const;

/** 헤더 오른쪽 끝에 서는 것 — 셋이 같은 자리를 쓰므로 크기가 흔들리지 않는다 */
const TRAILING =
  'shrink-0 rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent';

export function isNavigationActive(pathname: string, href: string): boolean {
  if (href === '/' || href === '/me') return pathname === href;
  if (href === '/me/requests' && pathname.startsWith('/me/match/')) return true;
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
  const inMemberArea = pathname.startsWith('/me');
  const links = inMemberArea ? MEMBER_LINKS : PUBLIC_LINKS;
  const [session, setSession] = useState<Session>('unknown');

  useEffect(() => {
    const supabase = supabaseInBrowser();
    let watching = true;

    supabase.auth.getSession().then(({ data }) => {
      if (watching) setSession(data.session === null ? 'out' : 'in');
    });

    // 로그아웃은 다른 화면에서 일어난다(`/me` 의 발치). 그때 이 헤더도 따라가야 한다.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next === null ? 'out' : 'in');
    });

    return () => {
      watching = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/88 backdrop-blur-xl">
      <div className="app-shell flex h-16 items-center gap-5">
        <Link href={inMemberArea ? '/me' : '/'} className="flex shrink-0 items-center gap-2.5" aria-label="만세력 홈">
          <span className="grid size-8 place-items-center rounded-xl bg-accent text-sm font-bold text-on-accent shadow-sm">命</span>
          <span className="hidden text-sm font-bold tracking-[-0.03em] sm:inline">만세력</span>
        </Link>
        <nav aria-label={inMemberArea ? '회원 메뉴' : '주요 메뉴'} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
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
        {/*
          **익명 화면이라고 로그아웃된 것이 아니다.**

          로그인한 사람도 여기로 온다 — 전체 명식은 익명 화면이 그리기 때문이다
          (`/me` 의 「전체 명식 자세히 보기」). 그런데 그 자리에 「로그인」이 서 있으면
          화면이 **세션이 풀렸다고 말하는 것**이 되고, 회원 메뉴까지 사라져서 돌아갈
          길도 없다. 세션은 그대로인데 화면만 거짓말을 하고 있었다.

          아직 모르는 동안에는 **둘 다 안 보인다.** 「로그인」을 먼저 세우면 로그인한
          사람이 한 번 깜빡이는 거짓말을 보고, 「내 자리」를 먼저 세우면 그 반대다.
          자리만 잡아 두면 글자가 늦게 오는 것으로 끝난다.
        */}
        {!inMemberArea &&
          (session === 'unknown' ? (
            <span aria-hidden="true" className={`${TRAILING} invisible`}>
              로그인
            </span>
          ) : session === 'in' ? (
            <Link href="/me" className={TRAILING}>
              내 자리
            </Link>
          ) : (
            <Link href="/auth" className={TRAILING}>
              로그인
            </Link>
          ))}
      </div>
    </header>
  );
}
