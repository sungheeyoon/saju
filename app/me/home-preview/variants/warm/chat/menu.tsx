import Link from 'next/link';

import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { previewHref } from '../../../shared/preview-href';
import { ROUND_ICON } from '../buttons';
import { Icon, type IconName } from '../symbols';

/*
  **제안 메뉴 — 홈 시안(`../index.tsx`)의 `TopBar` · `Dock` 을 옮겨 적었다.** 홈의 것은 켜진 탭이 `/me` 로 박혀 있고
  내보내지 않아 import 할 수 없다. 모양은 한 줄도 안 바꾸고 켜진 탭만 받는다 — 네 화면이 같은 메뉴를 입어야 한 제품이다.
*/

const TABS = [
  { href: '/me', label: '홈', icon: 'home' },
  { href: '/me/matching', label: '매칭', icon: 'people' },
  { href: '/me/readings', label: '풀이', icon: 'reading' },
  { href: '/me/chat', label: CHAT_TAB_LABEL, icon: 'chat' },
] as const satisfies readonly { href: string; label: string; icon: IconName }[];

type TabHref = (typeof TABS)[number]['href'];

const GEAR_LINKS = [
  { href: '/me/profile', label: '프로필' },
  { href: '/me/settings', label: '계정 관리' },
  { href: '/me/survey', label: '서비스 설문' },
] as const;

export function TopBar({ active, unread, unreadChat }: { active: TabHref; unread: number; unreadChat: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <nav aria-label="제안 메뉴" className="hidden sm:block">
        <ul className="flex items-center gap-1 rounded-full bg-[var(--card)] p-1 ring-1 ring-[var(--line)]">
          {TABS.map((tab) => {
            const on = tab.href === active;
            return (
              <li key={tab.href}>
                <Link
                  href={previewHref(tab.href)}
                  aria-current={on ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold active:scale-[0.97] ${
                    on ? 'bg-[var(--btn)] text-[var(--on-btn)]' : 'text-secondary hover:bg-surface-soft hover:text-foreground'
                  }`}
                >
                  <Icon name={tab.icon} className="size-[18px]" />
                  {tab.label}
                  {tab.href === '/me/chat' && <Badge count={unreadChat} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <p className="text-[13px] font-semibold text-secondary sm:hidden">제안 메뉴</p>

      <div className="flex items-center gap-2">
        <Link href={previewHref('/me/requests')} aria-label="소식" className={ROUND_ICON}>
          <Icon name="bell" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5">
              <Badge count={unread} />
            </span>
          )}
        </Link>
        <details className="relative">
          <summary aria-label="설정 메뉴" className={`${ROUND_ICON} list-none [&::-webkit-details-marker]:hidden`}>
            <Icon name="gear" />
          </summary>
          <div className="absolute right-0 top-13 z-20 w-52 rounded-[1.25rem] bg-[var(--card)] p-2 shadow-[var(--shadow-float)] ring-1 ring-[var(--line)]">
            {GEAR_LINKS.map((link) => (
              <Link
                key={link.href}
                href={previewHref(link.href)}
                className="flex min-h-11 items-center rounded-xl px-3 text-[15px] font-semibold hover:bg-surface-soft active:bg-surface-sunken"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

export function Dock({ active, unreadChat }: { active: TabHref; unreadChat: number }) {
  return (
    <nav aria-label="제안 메뉴 · 하단" className="sm:hidden">
      <ul className="grid grid-cols-4 rounded-[1.75rem] bg-[var(--card)] p-1.5 shadow-[0_10px_30px_-12px_rgba(60,48,30,0.35)] ring-1 ring-[var(--line)]">
        {TABS.map((tab) => {
          const on = tab.href === active;
          return (
            <li key={tab.href}>
              <Link
                href={previewHref(tab.href)}
                aria-current={on ? 'page' : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.25rem] text-[12px] font-semibold active:scale-95 ${
                  on ? 'text-foreground' : 'text-secondary'
                }`}
              >
                <span className={`grid h-8 w-14 place-items-center rounded-full ${on ? 'bg-[var(--wood-bg)] text-[var(--wood-ink)]' : ''}`}>
                  <Icon name={tab.icon} />
                </span>
                {tab.label}
                {tab.href === '/me/chat' && unreadChat > 0 && (
                  <span className="absolute right-[calc(50%-1.5rem)] top-0.5">
                    <Badge count={unreadChat} />
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

export function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-fire px-1 text-[11px] font-bold leading-none text-white tabular-nums">
      {count}
      <span className="sr-only">건 안 읽음</span>
    </span>
  );
}
