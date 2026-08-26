'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

export function isNavigationActive(pathname: string, href: string): boolean {
  if (href === '/' || href === '/me') return pathname === href;
  if (href === '/me/requests' && pathname.startsWith('/me/match/')) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const inMemberArea = pathname.startsWith('/me');
  const links = inMemberArea ? MEMBER_LINKS : PUBLIC_LINKS;

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
        {!inMemberArea && (
          <Link href="/auth" className="shrink-0 rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent">
            로그인
          </Link>
        )}
      </div>
    </header>
  );
}
