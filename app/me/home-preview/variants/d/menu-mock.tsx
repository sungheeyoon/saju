import Link from 'next/link';

import { previewHref } from '../../shared/preview-href';

/*
  **제안 메뉴의 모형** — 실제 헤더는 이 라운드에 못 고친다.
  데스크톱은 탭 줄, 모바일 폭은 하단 바 모양으로 그리되 `fixed` 로 띄우지 않는다(실제 하단 메뉴와 겹친다).
  톱니는 `<details>` 로 제자리에서 편다 — 떠 있는 층은 360px 에서 화면 밖으로 샌다.
*/

const TABS = [
  { href: '/me', text: '홈' },
  { href: '/me/matching', text: '매칭' },
  { href: '/me/readings', text: '풀이' },
  { href: '/me/chat', text: '채팅' },
] as const;

const SETTINGS = [
  { href: '/me/profile', text: '프로필' },
  { href: '/me/settings', text: '계정 관리' },
  { href: '/me/survey', text: '서비스 설문' },
] as const;

export function MenuMock({ unread, unreadChat }: { unread: number; unreadChat: number }) {
  return (
    <section
      aria-label="제안 메뉴"
      className="flex flex-col gap-2 rounded-2xl border border-dashed border-border-strong bg-surface-soft/60 p-3"
    >
      <p className="eyebrow">제안 메뉴</p>

      {/* 데스크톱 — 탭 줄 */}
      <div className="hidden items-start justify-between gap-3 sm:flex">
        <ul className="flex gap-1">
          {TABS.map((tab) => (
            <li key={tab.href}>
              <Link
                href={previewHref(tab.href)}
                aria-current={tab.href === '/me' ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                  tab.href === '/me' ? 'bg-accent-wash text-accent' : 'text-muted hover:text-foreground'
                }`}
              >
                {tab.text}
                {tab.href === '/me/chat' && <Badge count={unreadChat} />}
              </Link>
            </li>
          ))}
        </ul>
        <Utilities unread={unread} />
      </div>

      {/* 모바일 — 위에는 종 · 톱니, 아래는 하단 바 모양 */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex justify-end">
          <Utilities unread={unread} />
        </div>
        <ul className="grid grid-cols-4 rounded-xl border border-border bg-background">
          {TABS.map((tab) => (
            <li key={tab.href}>
              <Link
                href={previewHref(tab.href)}
                aria-current={tab.href === '/me' ? 'page' : undefined}
                className={`flex min-h-12 items-center justify-center gap-1 text-[11px] font-semibold ${
                  tab.href === '/me' ? 'text-accent' : 'text-muted'
                }`}
              >
                {tab.text}
                {tab.href === '/me/chat' && <Badge count={unreadChat} />}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Utilities({ unread }: { unread: number }) {
  return (
    <div className="flex items-start gap-1.5">
      <Link
        href={previewHref('/me/requests')}
        aria-label="소식"
        className="relative grid size-9 place-items-center rounded-full border border-border bg-surface text-muted hover:text-foreground"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4 fill-none stroke-current"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" />
          <path d="M10 20.5a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1">
            <Badge count={unread} />
          </span>
        )}
      </Link>
      <details className="flex flex-col items-end">
        <summary
          aria-label="설정 메뉴"
          className="grid size-9 cursor-pointer list-none place-items-center rounded-full border border-border bg-surface text-muted hover:text-foreground [&::-webkit-details-marker]:hidden"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-4 fill-none stroke-current"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
          </svg>
        </summary>
        <ul className="mt-2 flex flex-col gap-1 rounded-xl border border-border bg-surface p-1.5 text-sm">
          {SETTINGS.map((item) => (
            <li key={item.href}>
              <Link
                href={previewHref(item.href)}
                className="block whitespace-nowrap rounded-lg px-3 py-1.5 hover:bg-surface-soft"
              >
                {item.text}
              </Link>
            </li>
          ))}
        </ul>
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
