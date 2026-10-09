'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { SERVICE_NAME } from '@/src/lib/brand';

import { Logo } from '../ui/logo';

/** 운영 화면 사이의 길 — 화면이 늘면 여기에 줄을 더한다 */
const OPERATOR_LINKS = [
  { href: '/ops/reports', label: '신고' },
  { href: '/ops/survey', label: '설문' },
] as const;

/**
 * **운영 화면의 얇은 머리** — 「운영」 표지와 운영 화면 사이의 길(G-24).
 *
 * 앞에는 회원의 머리글(풀이권 · 탭 넷 · 채팅 딱지)이 그대로 섰다. 운영자가 회원으로서 쓰는 길이라 이 화면에서는 길이
 * 아니었고, 정작 신고 · 설문 사이를 오가는 길은 주소창뿐이었다. 회원 머리글은 `/ops/**` 에서 비키고(`isOperatorPath`)
 * 이 머리가 선다. 로고는 회원 화면(`/me`)으로 돌아가는 길이다.
 *
 * **운영자인지 여기서 묻지 않는다.** 머리는 길만 보이고, 문은 각 화면이 자료를 청해 거절당하는 것으로 안다(ADR 0103) —
 * 운영자가 아니면 화면이 404 라 이 머리도 남의 눈에 설 일이 없다.
 */
export function OpsHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="app-shell flex h-14 items-center gap-3">
        <Link href="/me" aria-label={`${SERVICE_NAME} 홈`} className="flex min-h-11 shrink-0 items-center rounded-full">
          <Logo />
        </Link>
        <span className="shrink-0 rounded-full bg-foreground px-2.5 py-1 text-xs font-bold text-background">운영</span>
        <nav aria-label="운영 메뉴" className="min-w-0">
          <ul className="flex items-center gap-1">
            {OPERATOR_LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold ${
                      active ? 'bg-surface-sunken text-foreground' : 'text-secondary hover:text-foreground'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
