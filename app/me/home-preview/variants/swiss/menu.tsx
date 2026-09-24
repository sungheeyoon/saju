import Link from 'next/link';

import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { previewHref } from '../../shared/preview-href';
import { Icon } from './icons';
import s from './swiss.module.css';

/*
  **메뉴 — 글자 넷과 선 하나.**

  데스크톱은 탭이 알약이 아니라 글자다. 지금 자리는 글자 밑 2px 강조선 하나가 말한다(색 + 선, 색만이 아니다).
  숫자 01~04 는 스위스 포스터의 색인이자 누를 자리를 넓히는 장치다. 오른쪽은 44px 네모 둘 — 종과 톱니.
  모바일은 하단 바 모양이되 `fixed` 가 아니다(실제 하단 메뉴와 겹친다). 위에 2px 선, 지금 자리는 위쪽 강조선.
*/

const TABS = [
  { href: '/me', label: '홈', icon: 'home' },
  { href: '/me/matching', label: '매칭', icon: 'people' },
  { href: '/me/readings', label: '풀이', icon: 'reading' },
  { href: '/me/chat', label: CHAT_TAB_LABEL, icon: 'chat' },
] as const;

const GEAR_LINKS = [
  { href: '/me/profile', label: '프로필' },
  { href: '/me/settings', label: '계정 관리' },
  { href: '/me/survey', label: '서비스 설문' },
] as const;

export function SwissMenu({ unread, unreadChat }: { unread: number; unreadChat: number }) {
  return (
    <section aria-label="제안 메뉴" className="flex flex-col gap-3">
      <div className="flex min-h-11 items-center justify-between gap-4 sm:border-b-2 sm:border-[var(--sw-ink)]">
        <ul className="hidden items-stretch gap-8 sm:flex">
          {TABS.map((tab, index) => {
            const active = tab.href === '/me';
            return (
              <li key={tab.href}>
                <Link
                  href={previewHref(tab.href)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative inline-flex min-h-14 items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] ${
                    active ? 'text-[var(--sw-ink)]' : 'text-[var(--sw-ink-3)] hover:text-[var(--sw-ink)]'
                  }`}
                >
                  <span className="text-[11px] font-medium tabular-nums text-[var(--sw-ink-3)]">0{index + 1}</span>
                  {tab.label}
                  {tab.href === '/me/chat' && <Count value={unreadChat} />}
                  {active && <span aria-hidden="true" className="absolute inset-x-0 -bottom-[2px] h-[2px] bg-[var(--sw-accent)]" />}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className={`${s.eyebrow} sm:hidden`}>제안 메뉴</p>
        <Trailing unread={unread} />
      </div>

      {/* 모바일 — 하단 바 모양이되 제자리에 선다 */}
      <ul className="grid grid-cols-4 border-y-2 border-t-[var(--sw-ink)] border-b-[var(--sw-rule)] sm:hidden">
        {TABS.map((tab) => {
          const active = tab.href === '/me';
          return (
            <li key={tab.href} className="min-w-0">
              <Link
                href={previewHref(tab.href)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-[0.02em] ${
                  active ? 'text-[var(--sw-accent)]' : 'text-[var(--sw-ink-3)] hover:text-[var(--sw-ink)]'
                }`}
              >
                <Icon name={tab.icon} />
                <span>{tab.label}</span>
                {tab.href === '/me/chat' && unreadChat > 0 && (
                  <span className="absolute left-1/2 top-2 ml-2">
                    <Count value={unreadChat} />
                  </span>
                )}
                {active && <span aria-hidden="true" className="absolute inset-x-4 -top-[2px] h-[2px] bg-[var(--sw-accent)]" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Trailing({ unread }: { unread: number }) {
  return (
    <div className="flex items-center gap-2">
      <Link href={previewHref('/me/requests')} aria-label="소식" className={s.icon}>
        <Icon name="news" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5">
            <Count value={unread} />
          </span>
        )}
      </Link>
      <details className={`relative ${s.details}`}>
        <summary aria-label="설정 메뉴" className={s.icon}>
          <Icon name="gear" />
        </summary>
        <ul className="absolute right-0 top-12 z-10 w-52 border border-[var(--sw-ink)] bg-[var(--sw-bg)] py-1">
          {GEAR_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={previewHref(link.href)}
                className="flex min-h-11 items-center justify-between px-4 text-[15px] font-medium hover:bg-[var(--sw-hover)] hover:text-[var(--sw-accent)]"
              >
                {link.label}
                <Icon name="arrow" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** 안 읽은 수 — 강조색 네모. 숫자가 말하고 색은 거든다 */
function Count({ value }: { value: number }) {
  if (value === 0) return null;
  return (
    <span className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-[2px] bg-[var(--sw-accent)] px-1 text-[11px] font-bold leading-none tabular-nums text-[var(--sw-on-accent)]">
      {value}
      <span className="sr-only">건 안 읽음</span>
    </span>
  );
}
