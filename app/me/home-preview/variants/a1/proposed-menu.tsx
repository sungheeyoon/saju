import Link from 'next/link';

import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { previewHref } from '../../shared/preview-href';

/*
  **제안 메뉴의 모형** — 실제 머리글(`app/site-header.tsx`)은 이 라운드에 안 고친다.

  넷(홈 · 매칭 · 풀이 · 채팅)이 줄에 서고, 소식은 종, 나머지(프로필 · 계정 관리 · 서비스 설문)는 톱니 안으로
  물러난다. 지금 머리글의 일곱 길 중 「내 사주」 · 「사람」 · 「사주·궁합」 셋이 홈 안으로 들어온다는 가정이다.
  모바일 폭에서는 하단 바 모양으로 그리되 `fixed` 로 띄우지 않는다 — 실제 하단 메뉴와 겹친다.
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

type Icon = (typeof TABS)[number]['icon'] | 'news' | 'gear';

export function ProposedMenu({ unread, unreadChat }: { unread: number; unreadChat: number }) {
  return (
    <section aria-label="제안 메뉴" className="flex flex-col gap-2">
      <p className="eyebrow">제안 메뉴</p>

      {/* 데스크톱 — 탭 줄 */}
      <div className="hidden items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-3 py-2 sm:flex">
        <ul className="flex items-center gap-1">
          {TABS.map((tab) => {
            const active = tab.href === '/me';
            return (
              <li key={tab.href}>
                <Link
                  href={previewHref(tab.href)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                    active ? 'bg-accent-wash text-accent' : 'text-secondary hover:text-accent'
                  }`}
                >
                  {tab.label}
                  {tab.href === '/me/chat' && <Badge count={unreadChat} />}
                </Link>
              </li>
            );
          })}
        </ul>
        <Trailing unread={unread} />
      </div>

      {/* 모바일 — 하단 바 모양이되 제자리에 선다 */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex justify-end">
          <Trailing unread={unread} />
        </div>
        <ul className="grid grid-cols-4 rounded-2xl border border-border bg-surface px-1">
          {TABS.map((tab) => {
            const active = tab.href === '/me';
            return (
              <li key={tab.href} className="min-w-0">
                <Link
                  href={previewHref(tab.href)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold ${
                    active ? 'text-accent' : 'text-muted hover:text-foreground'
                  }`}
                >
                  <MenuIcon name={tab.icon} />
                  <span className="truncate">{tab.label}</span>
                  {tab.href === '/me/chat' && unreadChat > 0 && (
                    <span className="absolute right-3 top-1.5">
                      <Badge count={unreadChat} />
                    </span>
                  )}
                  {active && <span aria-hidden="true" className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-accent" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** 종과 톱니 — 두 폭이 같은 것을 쓴다 */
function Trailing({ unread }: { unread: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={previewHref('/me/requests')}
        aria-label="소식"
        className="relative grid size-9 place-items-center rounded-full border border-border-strong bg-surface text-secondary hover:border-accent hover:text-accent"
      >
        <MenuIcon name="news" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1">
            <Badge count={unread} />
          </span>
        )}
      </Link>
      <details className="relative">
        <summary
          aria-label="설정 메뉴"
          className="grid size-9 cursor-pointer list-none place-items-center rounded-full border border-border-strong bg-surface text-secondary hover:border-accent hover:text-accent [&::-webkit-details-marker]:hidden"
        >
          <MenuIcon name="gear" />
        </summary>
        <div className="absolute right-0 top-11 z-10 w-48 rounded-2xl border border-border bg-surface p-2 shadow-[var(--shadow-float)]">
          {GEAR_LINKS.map((link) => (
            <Link
              key={link.href}
              href={previewHref(link.href)}
              className="block rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-surface-soft"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </details>
    </div>
  );
}

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="grid size-4.5 place-items-center rounded-full bg-fire text-[10px] font-bold text-white">
      {count}
      <span className="sr-only">건 안 읽음</span>
    </span>
  );
}

/** 선은 `site-header.tsx` 의 `MobileNavIcon` 사본이다 — 톱니만 더했다 */
function MenuIcon({ name }: { name: Icon }) {
  const paths = {
    home: <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4Z" />,
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.4-3.3 2.2-5 5.5-5s5.1 1.7 5.5 5M15 6.5a2.5 2.5 0 0 1 0 5M16 14c2.7.2 4.2 1.8 4.5 4.5" />
      </>
    ),
    reading: (
      <path d="M4 5.5A3.5 3.5 0 0 1 7.5 4H12v16H7.5A3.5 3.5 0 0 0 4 21.5ZM20 5.5A3.5 3.5 0 0 0 16.5 4H12v16h4.5a3.5 3.5 0 0 1 3.5 1.5Z" />
    ),
    chat: (
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17H6.5A2.5 2.5 0 0 1 4 14.5Z" />
    ),
    news: (
      <>
        <path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 8H4c0-1 2-1 2-8Z" />
        <path d="M9.5 20h5" />
      </>
    ),
    gear: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
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
