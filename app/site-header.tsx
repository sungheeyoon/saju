'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { readingCreditsLabel } from '@/src/lib/reading';

import { supabaseInBrowser } from './auth/browser-client';
import { READING_CREDITS_MOVED } from './me/reading/credits-signal';

const PUBLIC_LINKS = [
  { href: '/', label: '사주 보기' },
  { href: '/compat', label: '궁합 보기' },
] as const;

const MEMBER_LINKS = [
  { href: '/me', label: '내 사주' },
  { href: '/me/people', label: '사람' },
  { href: '/compat', label: '궁합' },
  { href: '/me/discovery', label: '인연 찾기' },
  { href: '/me/requests', label: '소식' },
] as const;

/** 헤더 오른쪽 끝에 서는 것 — 셋이 같은 자리를 쓰므로 크기가 흔들리지 않는다 */
const TRAILING =
  'shrink-0 rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent';

export function isNavigationActive(pathname: string, href: string): boolean {
  if (href === '/' || href === '/me') return pathname === href;
  if (href === '/compat') return pathname === '/compat' || pathname === '/me/compat';
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
  const protectedPath = pathname.startsWith('/me') || pathname === '/compat';
  const [session, setSession] = useState<Session>('unknown');
  const [email, setEmail] = useState<string | null>(null);
  const memberNavigation = protectedPath || session === 'in';
  const links = memberNavigation ? MEMBER_LINKS : PUBLIC_LINKS;

  useEffect(() => {
    const supabase = supabaseInBrowser();
    let watching = true;

    supabase.auth.getSession().then(({ data }) => {
      if (watching) {
        setSession(data.session === null ? 'out' : 'in');
        setEmail(data.session?.user.email ?? null);
      }
    });

    // 설정 메뉴나 계정 관리 화면에서 로그아웃하면 헤더도 바로 공개 메뉴로 돌아간다.
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
    <header className="sticky top-0 z-40 border-b border-border bg-background/88 backdrop-blur-xl">
      <div className="app-shell flex h-16 items-center gap-5">
        <Link href={memberNavigation ? '/me' : '/'} className="flex shrink-0 items-center gap-2.5" aria-label="만세력 홈">
          <span className="grid size-8 place-items-center rounded-xl bg-accent text-sm font-bold text-on-accent shadow-sm">命</span>
          <span className="hidden text-sm font-bold tracking-[-0.03em] sm:inline">만세력</span>
        </Link>
        <nav aria-label={memberNavigation ? '내 메뉴' : '주요 메뉴'} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
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

          로그인한 사람도 공개 사주 계산 화면으로 올 수 있다. 그런데 그 자리에
          「로그인」이 서 있으면 세션이 풀린 것처럼 보이고 내 메뉴로 돌아갈 길도 없다.

          아직 모르는 동안에는 **둘 다 안 보인다.** 「로그인」을 먼저 세우면 로그인한
          사람이 한 번 깜빡이는 거짓말을 보고, 설정 메뉴를 먼저 세우면 그 반대다.
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
            {session === 'in' && <Credits />}
            <AccountMenu email={email} />
          </>
        ) : (
          session === 'unknown' ? (
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
  );
}

/**
 * 남은 풀이권 — **설정 옆에 선다.**
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
function Credits() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  if (label === null) return null;

  return (
    /*
      **폰에서도 보인다.** 처음에는 `sm:` 아래에서 숨겼는데, 그러면 폰으로 쓰는 사람은
      자기 잔액을 한 번도 못 본다 — 이 제품은 데스크톱과 모바일 둘 다를 약속한다(PRD).
      좁아지는 것은 옆의 메뉴이고, 그 줄은 이미 가로로 흐르게 되어 있다.
    */
    <span className="shrink-0 rounded-full bg-accent-wash px-2.5 py-1.5 text-xs font-semibold tabular-nums text-accent">
      {label}
    </span>
  );
}

function AccountMenu({ email }: { email: string | null }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const signOut = async () => {
    setLeaving(true);
    setFailure(null);
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
    <details className="group relative shrink-0">
      <summary
        className="grid size-10 cursor-pointer list-none place-items-center rounded-full border border-border-strong bg-surface text-secondary hover:border-accent hover:text-accent [&::-webkit-details-marker]:hidden"
        aria-label="설정 메뉴"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4.5 fill-none stroke-current" strokeWidth="1.8">
          <path d="M12 8.25A3.75 3.75 0 1 0 12 15.75 3.75 3.75 0 0 0 12 8.25Z" />
          <path d="M19.2 13.1a7.7 7.7 0 0 0 0-2.2l2-1.55-2-3.45-2.48 1a8 8 0 0 0-1.9-1.1L14.45 3h-4.1l-.38 2.8a8 8 0 0 0-1.9 1.1l-2.48-1-2 3.45 2 1.55a7.7 7.7 0 0 0 0 2.2l-2 1.55 2 3.45 2.48-1a8 8 0 0 0 1.9 1.1l.38 2.8h4.1l.38-2.8a8 8 0 0 0 1.9-1.1l2.48 1 2-3.45-2.01-1.55Z" />
        </svg>
      </summary>
      <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-border bg-surface p-2 shadow-[var(--shadow-float)]">
        {email && <p className="truncate border-b border-border px-3 py-2 text-xs text-muted">{email}</p>}
        <Link href="/me/settings" className="mt-1 block rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-surface-soft">
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
