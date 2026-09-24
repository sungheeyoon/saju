import Link from 'next/link';
import type { ReactNode } from 'react';

import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { previewHref } from '../../shared/preview-href';

/*
  「제안 메뉴」 모형 — 실제 머리글은 못 고치니 시안 맨 위에 그린다. 홈 · 매칭 · 풀이 · 채팅, 소식은 종,
  설정은 톱니. 모바일 폭에서는 하단 바 **모양**만 흉내 낸다 — `fixed` 로 띄우면 실제 하단 메뉴와 겹친다.
  톱니도 `<details>` 다 — 이 시안의 결(누르면 그 자리에서 펴진다)을 메뉴에도 그대로 둔다.
*/

const TABS = [
  { href: '/me', text: '홈', icon: 'home' },
  { href: '/me/matching', text: '매칭', icon: 'people' },
  { href: '/me/readings', text: '풀이', icon: 'reading' },
  { href: '/me/chat', text: CHAT_TAB_LABEL, icon: 'chat' },
] as const;

const SETTINGS = [
  { href: '/me/profile', text: '프로필' },
  { href: '/me/settings', text: '계정 관리' },
  { href: '/me/survey', text: '서비스 설문' },
] as const;

type IconName = (typeof TABS)[number]['icon'] | 'news';

export function MenuMock({ unread, unreadChat }: { unread: number; unreadChat: number }) {
  return (
    <section aria-label="제안 메뉴" className="flex flex-col gap-2 rounded-2xl border border-dashed border-border-strong p-2">
      <p className="eyebrow px-2 pt-1">제안 메뉴</p>

      {/* 데스크톱 — 탭 줄 */}
      <div className="hidden items-center gap-1 sm:flex">
        {TABS.map((tab, index) => (
          <Link
            key={tab.href}
            href={previewHref(tab.href)}
            aria-current={index === 0 ? 'page' : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${index === 0 ? 'bg-accent-wash text-accent-strong' : 'text-secondary hover:bg-surface-soft hover:text-foreground'}`}
          >
            {tab.text}
            {tab.href === '/me/chat' && <Badge count={unreadChat} inline />}
          </Link>
        ))}
        <span className="flex-1" />
        <Bell unread={unread} />
        <Gear />
      </div>

      {/* 모바일 — 위에 종 · 톱니, 아래에 하단 바 모양 */}
      <div className="flex flex-col gap-1 sm:hidden">
        <div className="flex justify-end gap-2">
          <Bell unread={unread} />
          <Gear />
        </div>
        <div className="grid grid-cols-4 rounded-xl border-t border-border bg-background/95">
          {TABS.map((tab, index) => (
            <Link
              key={tab.href}
              href={previewHref(tab.href)}
              aria-current={index === 0 ? 'page' : undefined}
              className={`relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold ${index === 0 ? 'text-accent' : 'text-muted hover:text-foreground'}`}
            >
              <Icon name={tab.icon} />
              <span className="truncate">{tab.text}</span>
              {tab.href === '/me/chat' && unreadChat > 0 && (
                <span className="absolute right-3 top-2">
                  <Badge count={unreadChat} />
                </span>
              )}
              {index === 0 && <span aria-hidden="true" className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent" />}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Bell({ unread }: { unread: number }) {
  return (
    <Link
      href={previewHref('/me/requests')}
      aria-label="소식"
      className="relative grid size-10 shrink-0 place-items-center rounded-full border border-border-strong bg-surface text-secondary hover:border-accent hover:text-accent"
    >
      <Icon name="news" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1">
          <Badge count={unread} />
        </span>
      )}
    </Link>
  );
}

function Gear() {
  return (
    <details className="group relative shrink-0">
      <summary
        aria-label="설정 메뉴"
        className="grid size-10 cursor-pointer list-none place-items-center rounded-full border border-border-strong bg-surface text-secondary hover:border-accent hover:text-accent [&::-webkit-details-marker]:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4.5 fill-none stroke-current" strokeWidth="1.8">
          <path d="M12 8.25A3.75 3.75 0 1 0 12 15.75 3.75 3.75 0 0 0 12 8.25Z" />
          <path d="M19.2 13.1a7.7 7.7 0 0 0 0-2.2l2-1.55-2-3.45-2.48 1a8 8 0 0 0-1.9-1.1L14.45 3h-4.1l-.38 2.8a8 8 0 0 0-1.9 1.1l-2.48-1-2 3.45 2 1.55a7.7 7.7 0 0 0 0 2.2l-2 1.55 2 3.45 2.48-1a8 8 0 0 0 1.9 1.1l.38 2.8h4.1l.38-2.8a8 8 0 0 0 1.9-1.1l2.48 1 2-3.45-2.01-1.55Z" />
        </svg>
      </summary>
      <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-border bg-surface p-2 shadow-[var(--shadow-float)]">
        {SETTINGS.map((item) => (
          <Link
            key={item.href}
            href={previewHref(item.href)}
            className="block rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-surface-soft"
          >
            {item.text}
          </Link>
        ))}
      </div>
    </details>
  );
}

function Badge({ count, inline = false }: { count: number; inline?: boolean }) {
  if (count === 0) return null;
  return (
    <span
      className={`${inline ? 'ml-1.5 inline-grid align-middle' : 'grid'} size-4.5 place-items-center rounded-full bg-fire text-[10px] font-bold text-white`}
    >
      {count}
      <span className="sr-only">건 안 읽음</span>
    </span>
  );
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
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
  };

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
