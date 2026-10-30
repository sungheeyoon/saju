'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { SERVICE_NAME, SERVICE_TAGLINE } from '@/src/lib/brand';
import { BUSINESS_DISCLOSURE_LINK, type BusinessInfo, businessInfoLines } from '@/src/lib/brand/business';

import { GUIDE_LINKS, POLICY_LINKS } from '@/src/lib/brand/links';

/**
 * 바닥글 — **운영 화면(`/ops/**`) 밖의 모든 화면에 선다.**
 *
 * 앞 판에는 바닥글이 없었다. 첫 화면은 입력 폼에서 끝났고, 처리방침으로 가는 길은 가입 폼과 설정 안에만 있었다 —
 * 처음 온 사람이 「이게 무엇을 하는 서비스이고 내 생년월일시를 어떻게 다루나」를 가입 전에 찾을 자리가 없었다.
 *
 * **사업자 정보와 약관 링크는 결제 페이지까지 상시 선다**(전자상거래법 제10조 · PG 심사, 운영자 결정 2026-10-12, ADR 0172).
 * 값은 뿌리 레이아웃이 환경변수에서 읽어 넘긴다(`app/business-info.ts`) — 저장소에 적지 않는다. 값이 빈 줄은 그리지 않는다.
 *
 * 앱 안(`/me/**` · `/compat`)은 이름 · 소개 · 안내 링크를 빼고 **약관 링크 셋과 사업자 정보만** 든다 — 거기는 하단 독과 톱니가
 * 길이다. 폰의 인연 덱(`data-deck-fit`)과 대화방(`data-chat-room`)은 문서를 화면 한 장에 묶어 바닥글을 걷는다(`globals.css`).
 */
export function SiteFooter({ business }: { business: BusinessInfo }) {
  const pathname = usePathname();
  if (pathname.startsWith('/ops')) return null;
  const inApp = pathname.startsWith('/me') || pathname === '/compat';

  const nav = (
    <nav aria-label="안내">
      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        {(inApp ? POLICY_LINKS : GUIDE_LINKS).map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
              className="inline-flex min-h-11 items-center text-small font-semibold text-secondary hover:text-foreground aria-[current=page]:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  if (inApp) {
    return (
      /* 위 가로 줄을 걷었다(운영자 2026-10-26) — 본문과 바닥글은 여백이 가른다(당근 SEED Top Navigation 과 같은 생각: 영역을 줄로 가르지 않는다) */
      <footer className="mt-auto">
        <div className="app-shell flex flex-col gap-1 pt-3 pb-6">
          {nav}
          <BusinessLines business={business} />
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-auto">
      <div className="app-shell flex flex-col gap-4 pt-8 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-rounded text-lead text-foreground">{SERVICE_NAME}</p>
          <p className="text-small leading-5 text-secondary">{SERVICE_TAGLINE} · 비공개 베타</p>
        </div>
        {nav}
      </div>
      <BusinessLines business={business} className="app-shell -mt-3 pb-8" />
    </footer>
  );
}

/**
 * 사업자 정보 한 묶음 — 값이 있는 줄만 선다. 공정위 사업자정보 공개 페이지 링크는 사업자등록번호 곁에, 번호가 없으면 끝에 선다.
 * 하나도 없으면 아무것도 그리지 않는다.
 */
function BusinessLines({ business, className = '' }: { business: BusinessInfo; className?: string }) {
  const lines = businessInfoLines(business);
  const disclosure = business.disclosureUrl ? (
    <a
      href={business.disclosureUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-secondary underline underline-offset-2 hover:text-foreground"
    >
      {BUSINESS_DISCLOSURE_LINK}
    </a>
  ) : null;
  const disclosureBesideNumber = lines.some((line) => line.key === 'registrationNumber');
  if (lines.length === 0 && disclosure === null) return null;

  return (
    <div className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 text-fine leading-5 text-secondary ${className}`}>
      <dl aria-label="사업자 정보" className="contents">
        {lines.map((line) => (
          <div key={line.key} className="flex flex-wrap gap-x-1.5">
            <dt>{line.label}</dt>
            <dd className="text-foreground/80">
              {line.value}
              {line.key === 'registrationNumber' && disclosure ? <> {disclosure}</> : null}
            </dd>
          </div>
        ))}
      </dl>
      {disclosureBesideNumber ? null : disclosure}
    </div>
  );
}
