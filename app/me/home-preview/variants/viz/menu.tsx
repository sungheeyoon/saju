import Link from 'next/link';

import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { previewHref } from '../../shared/preview-href';
import { CountBadge, Icon, type IconName } from './ui';

/*
  **제안 메뉴 모형** — 신문 섹션 줄처럼 글자와 밑줄 하나로 선다. 메뉴는 차트와 경쟁하지 않는다.

  넓은 폭: 네 탭은 15px 글자, 지금 자리만 전경색 + 2px 밑줄. 종과 톱니는 44px 둥근 단추(테두리가 있어
  「누르는 것」임이 보인다). 폰: 하단 바 모양이되 `fixed` 로 띄우지 않는다 — 실제 하단 메뉴와 겹친다.
  지금 자리는 아이콘 뒤에 옅은 알약이 깔린다.
*/

const TABS: readonly { href: string; label: string; icon: IconName }[] = [
  { href: '/me', label: '홈', icon: 'home' },
  { href: '/me/matching', label: '매칭', icon: 'people' },
  { href: '/me/readings', label: '풀이', icon: 'reading' },
  { href: '/me/chat', label: CHAT_TAB_LABEL, icon: 'chat' },
];

const GEAR_LINKS = [
  { href: '/me/profile', label: '프로필' },
  { href: '/me/settings', label: '계정 관리' },
  { href: '/me/survey', label: '서비스 설문' },
] as const;

const ROUND =
  'relative grid size-11 place-items-center rounded-full border border-border-strong bg-surface text-secondary hover:bg-surface-soft hover:text-foreground active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function Menu({ unread, unreadChat }: { unread: number; unreadChat: number }) {
  return (
    <section aria-label="제안 메뉴" className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted">제안 메뉴</p>

      <div className="hidden items-center justify-between gap-4 border-b border-border sm:flex">
        <ul className="flex items-center gap-6">
          {TABS.map((tab) => {
            const active = tab.href === '/me';
            return (
              <li key={tab.href}>
                <Link
                  href={previewHref(tab.href)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative inline-flex min-h-12 items-center gap-1.5 text-[15px] font-semibold ${
                    active ? 'text-foreground' : 'text-secondary hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  {tab.href === '/me/chat' && <CountBadge count={unreadChat} />}
                  {active && <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-[2px] bg-foreground" />}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="pb-1">
          <Trailing unread={unread} />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex justify-end">
          <Trailing unread={unread} />
        </div>
        <ul className="grid grid-cols-4 rounded-2xl border border-border bg-surface p-1">
          {TABS.map((tab) => {
            const active = tab.href === '/me';
            return (
              <li key={tab.href} className="min-w-0">
                <Link
                  href={previewHref(tab.href)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold ${
                    active ? 'text-foreground' : 'text-muted hover:text-foreground'
                  }`}
                >
                  <span className={`grid h-7 w-12 place-items-center rounded-full ${active ? 'bg-accent-wash text-accent' : ''}`}>
                    <Icon name={tab.icon} />
                  </span>
                  {tab.label}
                  {tab.href === '/me/chat' && unreadChat > 0 && (
                    <span className="absolute right-2 top-1">
                      <CountBadge count={unreadChat} />
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Trailing({ unread }: { unread: number }) {
  return (
    <div className="flex items-center gap-2">
      <Link href={previewHref('/me/requests')} aria-label="소식" className={ROUND}>
        <Icon name="news" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1">
            <CountBadge count={unread} />
          </span>
        )}
      </Link>
      <details className="relative">
        <summary aria-label="설정 메뉴" className={`${ROUND} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
          <Icon name="gear" />
        </summary>
        <div className="absolute right-0 top-13 z-10 w-48 rounded-xl border border-border bg-surface-raised p-1.5 shadow-[var(--shadow-float)]">
          {GEAR_LINKS.map((link) => (
            <Link
              key={link.href}
              href={previewHref(link.href)}
              className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-surface-soft"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </details>
    </div>
  );
}
