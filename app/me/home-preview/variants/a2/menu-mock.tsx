import Link from 'next/link';

import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { previewHref } from '../../shared/preview-href';

/*
  **제안 메뉴의 모형** — 실제 헤더(`app/site-header.tsx`)는 못 고치니 시안 맨 위에 그린다.
  넷(홈 · 매칭 · 풀이 · 채팅) + 종(소식) + 톱니(프로필 · 계정 관리 · 서비스 설문). 모바일 폭에서는
  하단 바 모양으로 서지만 `fixed` 가 아니다 — 실제 하단 메뉴와 겹친다.
*/

const TABS = [
  { href: '/me', label: '홈' },
  { href: '/me/matching', label: '매칭' },
  { href: '/me/readings', label: '풀이' },
  { href: '/me/chat', label: CHAT_TAB_LABEL },
] as const;

const SETTINGS = [
  { href: '/me/profile', label: '프로필' },
  { href: '/me/settings', label: '계정 관리' },
  { href: '/me/survey', label: '서비스 설문' },
] as const;

export function MenuMock({ unread, unreadChat }: { unread: number; unreadChat: number }) {
  return (
    <section
      aria-label="제안 메뉴"
      className="flex flex-col gap-2 rounded-2xl border border-dashed border-border-strong p-2"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="px-1 text-[11px] font-semibold text-muted">제안 메뉴</p>
        {/* 모바일 — 종과 톱니는 머리에, 넷은 아래 하단 바 모양 */}
        <span className="sm:hidden">
          <Tools unread={unread} />
        </span>
      </div>

      {/* 데스크톱 — 탭 줄 */}
      <div className="hidden items-center gap-1 sm:flex">
        {TABS.map((tab, index) => (
          <Link
            key={tab.href}
            href={previewHref(tab.href)}
            aria-current={index === 0 ? 'page' : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${index === 0 ? 'bg-accent-wash text-accent-strong' : 'text-secondary hover:bg-surface-soft hover:text-foreground'}`}
          >
            {tab.label}
            {tab.href === '/me/chat' && <Badge count={unreadChat} />}
          </Link>
        ))}
        <span className="flex-1" />
        <Tools unread={unread} />
      </div>

      <div className="sm:hidden">
        <div className="grid grid-cols-4 border-t border-border">
          {TABS.map((tab, index) => (
            <Link
              key={tab.href}
              href={previewHref(tab.href)}
              aria-current={index === 0 ? 'page' : undefined}
              className={`relative flex min-h-12 min-w-0 items-center justify-center px-1 text-[11px] font-semibold ${index === 0 ? 'text-accent' : 'text-muted'}`}
            >
              <span className="truncate">{tab.label}</span>
              {tab.href === '/me/chat' && <Badge count={unreadChat} />}
              {index === 0 && (
                <span aria-hidden="true" className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent" />
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Tools({ unread }: { unread: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <Link
        href={previewHref('/me/requests')}
        className="relative grid size-9 place-items-center rounded-full border border-border-strong bg-surface text-secondary hover:border-accent hover:text-accent"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4.5 fill-none stroke-current"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" />
          <path d="M10 20.5a2 2 0 0 0 4 0" />
        </svg>
        <span className="sr-only">소식</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid size-4.5 place-items-center rounded-full bg-fire text-[10px] font-bold text-white">
            {unread}
            <span className="sr-only">건 안 읽음</span>
          </span>
        )}
      </Link>
      <details className="relative">
        <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-full border border-border-strong bg-surface text-secondary hover:border-accent hover:text-accent [&::-webkit-details-marker]:hidden">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4.5 fill-none stroke-current" strokeWidth="1.6">
            <path d="M12 8.25A3.75 3.75 0 1 0 12 15.75 3.75 3.75 0 0 0 12 8.25Z" />
            <path d="M19.2 13.1a7.7 7.7 0 0 0 0-2.2l2-1.55-2-3.45-2.48 1a8 8 0 0 0-1.9-1.1L14.45 3h-4.1l-.38 2.8a8 8 0 0 0-1.9 1.1l-2.48-1-2 3.45 2 1.55a7.7 7.7 0 0 0 0 2.2l-2 1.55 2 3.45 2.48-1a8 8 0 0 0 1.9 1.1l.38 2.8h4.1l.38-2.8a8 8 0 0 0 1.9-1.1l2.48 1 2-3.45-2.01-1.55Z" />
          </svg>
          <span className="sr-only">설정</span>
        </summary>
        <div className="absolute right-0 top-11 z-10 w-48 rounded-2xl border border-border bg-surface p-2 shadow-[var(--shadow-float)]">
          {SETTINGS.map((one) => (
            <Link
              key={one.href}
              href={previewHref(one.href)}
              className="block rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-surface-soft"
            >
              {one.label}
            </Link>
          ))}
        </div>
      </details>
    </span>
  );
}

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-1.5 inline-grid size-4.5 place-items-center rounded-full bg-fire align-middle text-[10px] font-bold text-white">
      {count}
      <span className="sr-only">건 안 읽음</span>
    </span>
  );
}
