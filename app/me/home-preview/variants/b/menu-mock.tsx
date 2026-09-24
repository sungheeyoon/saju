import Link from 'next/link';

import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { previewHref } from '../../shared/preview-href';

/*
  제안 메뉴 모형 — 실제 헤더는 이 라운드에서 못 고친다. 데스크톱은 탭 줄, 모바일 폭은 위 한 줄(종 · 톱니)과
  하단 바 모양. `position: fixed` 는 쓰지 않는다 — 실제 하단 메뉴와 겹친다.
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
      aria-label="제안 메뉴 모형"
      className="flex flex-col gap-2 rounded-2xl border border-dashed border-border-strong bg-surface-soft/60 p-3"
    >
      <p className="text-[11px] font-semibold text-muted">제안 메뉴 모형</p>

      {/* 데스크톱 — 탭 줄 */}
      <div className="hidden items-center gap-1 sm:flex">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={previewHref(tab.href)}
            aria-current={tab.href === '/me' ? 'page' : undefined}
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ${
              tab.href === '/me'
                ? 'bg-accent-wash text-accent-strong'
                : 'text-secondary hover:bg-surface hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.href === '/me/chat' && <Badge count={unreadChat} />}
          </Link>
        ))}
        <span className="min-w-0 flex-1" />
        <Bell count={unread} />
        <Gear />
      </div>

      {/* 모바일 — 위 한 줄과 하단 바 모양 */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-bold">[서비스명]</span>
          <Bell count={unread} />
          <Gear />
        </div>
        <nav aria-label="하단 메뉴 모형" className="grid grid-cols-4 rounded-2xl border border-border bg-surface p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={previewHref(tab.href)}
              aria-current={tab.href === '/me' ? 'page' : undefined}
              className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold ${
                tab.href === '/me' ? 'bg-accent-wash text-accent-strong' : 'text-secondary'
              }`}
            >
              {tab.label}
              {tab.href === '/me/chat' && <Badge count={unreadChat} />}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-1 grid size-5 place-items-center rounded-full bg-fire text-[10px] font-bold text-white">
      {count}
      <span className="sr-only">건 안 읽음</span>
    </span>
  );
}

function Bell({ count }: { count: number }) {
  return (
    <Link
      href={previewHref('/me/requests')}
      aria-label="소식"
      className="relative grid size-9 shrink-0 place-items-center rounded-full border border-border bg-surface text-secondary hover:border-accent hover:text-accent"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-[1.15rem] fill-none stroke-current"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" />
        <path d="M10 20.5a2 2 0 0 0 4 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-fire text-[10px] font-bold text-white">
          {count}
          <span className="sr-only">건 안 읽음</span>
        </span>
      )}
    </Link>
  );
}

/** 톱니 — 펼치기는 `<details>` 로 한다. 클라이언트 파일을 안 둔다 */
function Gear() {
  return (
    <details className="relative shrink-0">
      <summary
        aria-label="설정"
        className="grid size-9 cursor-pointer list-none place-items-center rounded-full border border-border bg-surface text-secondary hover:border-accent hover:text-accent [&::-webkit-details-marker]:hidden"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-[1.15rem] fill-none stroke-current"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
        </svg>
      </summary>
      <ul className="absolute right-0 top-11 z-10 flex w-40 flex-col gap-0.5 rounded-2xl border border-border bg-surface p-1.5 shadow-[var(--shadow-card)]">
        {SETTINGS.map((item) => (
          <li key={item.href}>
            <Link
              href={previewHref(item.href)}
              className="block rounded-xl px-3 py-2 text-sm hover:bg-surface-soft hover:text-accent"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
