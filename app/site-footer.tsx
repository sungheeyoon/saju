'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { SERVICE_NAME, SERVICE_TAGLINE } from '@/src/lib/brand';
import { businessInfoLines } from '@/src/lib/brand/business';

import { GUIDE_LINKS } from './site-links';

/**
 * 바닥글 — **앱 밖의 화면(첫 화면 · 로그인 · 가입 · 공유 · 안내 셋)에만 선다.**
 *
 * 앞 판에는 바닥글이 없었다. 첫 화면은 입력 폼에서 끝났고, 처리방침으로 가는 길은 가입 폼과 계정 관리 안에만 있었다 —
 * 처음 온 사람이 「이게 무엇을 하는 서비스이고 내 생년월일시를 어떻게 다루나」를 가입 전에 찾을 자리가 없었다.
 *
 * 앱 안(`/me/**` · `/compat` · `/ops/**`)에는 안 세운다. 거기는 하단 독과 톱니가 길이고, 인연 탭은 문서를 한 화면 높이에
 * 묶는다(`globals.css` 의 `data-deck-fit`) — 바닥글이 끼면 그 묶음이 깨진다.
 *
 * 맨 아래 줄은 **사업자 정보**다(전자상거래법의 표시 · PG 심사, 운영자 2026-10-07, ADR 0149). 값은
 * `src/lib/brand/business.ts` 한 곳이고, 값을 모르는 줄은 그리지 않는다 — 자리표시를 화면에 내지 않는다.
 */
export function SiteFooter() {
  const pathname = usePathname();
  const inApp = pathname.startsWith('/me') || pathname.startsWith('/ops') || pathname === '/compat';
  if (inApp) return null;

  return (
    <footer className="mt-auto border-t border-border">
      <div className="app-shell flex flex-col gap-4 pt-8 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-rounded text-[17px] text-foreground">{SERVICE_NAME}</p>
          <p className="text-[13px] leading-5 text-secondary">{SERVICE_TAGLINE} · 비공개 베타</p>
        </div>
        <nav aria-label="안내">
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {GUIDE_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? 'page' : undefined}
                  className="inline-flex min-h-11 items-center text-[13px] font-semibold text-secondary hover:text-foreground aria-[current=page]:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="app-shell pb-8">
        <dl aria-label="사업자 정보" className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] leading-5 text-secondary">
          {businessInfoLines().map((line) => (
            <div key={line.label} className="flex gap-1.5">
              <dt>{line.label}</dt>
              <dd className="text-foreground/80">{line.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </footer>
  );
}
