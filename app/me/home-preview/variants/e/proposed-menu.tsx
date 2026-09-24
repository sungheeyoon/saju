import Link from 'next/link';

import { previewHref } from '../../shared/preview-href';

/*
  **제안 메뉴 모형** — 실제 헤더는 안 고치므로 시안 머리에 그려 둔다. 데스크톱은 탭 줄, 모바일은 하단 바
  모양인데 떠 있지 않다(`fixed` 면 실제 하단 메뉴와 겹친다). 톱니는 `<details>` 로만 연다.
*/

const TABS = [
  { href: '/me', label: '홈' },
  { href: '/me/matching', label: '매칭' },
  { href: '/me/readings', label: '풀이' },
  { href: '/me/chat', label: '채팅' },
] as const;

const GEAR_LINKS = [
  { href: '/me/profile', label: '프로필' },
  { href: '/me/settings', label: '계정 관리' },
  { href: '/me/survey', label: '서비스 설문' },
] as const;

export function ProposedMenu({ unread, unreadChat }: { unread: number; unreadChat: number }) {
  return (
    <section aria-label="제안 메뉴" className="rounded-2xl border border-dashed border-border-strong bg-surface-soft/60 p-2">
      <div className="flex items-center gap-1">
        <p className="eyebrow shrink-0 px-2">제안 메뉴</p>

        {/* 데스크톱 — 탭 줄 */}
        <nav aria-label="제안 메뉴 탭" className="hidden min-w-0 flex-1 items-center gap-1 sm:flex">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={previewHref(tab.href)}
              aria-current={tab.href === '/me' ? 'page' : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${tab.href === '/me' ? 'bg-accent-wash text-accent-strong' : 'text-secondary hover:bg-surface hover:text-foreground'}`}
            >
              {tab.label}
              {tab.href === '/me/chat' && <Badge count={unreadChat} />}
            </Link>
          ))}
        </nav>
        <div aria-hidden="true" className="min-w-0 flex-1 sm:hidden" />

        <Link
          href={previewHref('/me/requests')}
          aria-label="소식"
          className="relative grid size-9 shrink-0 place-items-center rounded-full border border-border bg-surface text-secondary hover:border-accent hover:text-accent"
        >
          <BellIcon />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid size-4.5 place-items-center rounded-full bg-fire text-[10px] font-bold text-white">
              {unread}
              <span className="sr-only">건 안 읽음</span>
            </span>
          )}
        </Link>

        <details className="relative shrink-0">
          <summary
            aria-label="설정"
            className="grid size-9 cursor-pointer list-none place-items-center rounded-full border border-border bg-surface text-secondary hover:border-accent hover:text-accent [&::-webkit-details-marker]:hidden"
          >
            <GearIcon />
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

      {/* 모바일 — 하단 바 모양이지만 흐름 안에 선다 */}
      <nav aria-label="제안 메뉴 하단 바" className="mt-2 grid grid-cols-4 rounded-xl border border-border bg-surface sm:hidden">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={previewHref(tab.href)}
            aria-current={tab.href === '/me' ? 'page' : undefined}
            className={`relative flex min-h-12 min-w-0 items-center justify-center text-xs font-semibold ${tab.href === '/me' ? 'text-accent' : 'text-muted'}`}
          >
            {tab.label}
            {tab.href === '/me/chat' && <Badge count={unreadChat} />}
          </Link>
        ))}
      </nav>
    </section>
  );
}

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-1 inline-grid size-4.5 place-items-center rounded-full bg-fire align-middle text-[10px] font-bold text-white">
      {count}
      <span className="sr-only">건 안 읽음</span>
    </span>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4.5 fill-none stroke-current" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4.5 fill-none stroke-current" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </svg>
  );
}
