import Link from 'next/link';

import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { previewHref } from '../../shared/preview-href';
import { Icon, type IconName } from './icons';

/*
  **제안 메뉴 모형** — 실제 헤더는 이 라운드에서 못 고치니 시안 맨 위에 그림으로 세운다.
  데스크톱은 탭 줄, 모바일 폭은 하단 바 모양이다. 하단 바는 `fixed` 로 띄우지 않는다 — 실제 하단 메뉴와 겹친다.
*/

const TABS: readonly { href: string; label: string; icon: IconName }[] = [
  { href: '/me', label: '홈', icon: 'home' },
  { href: '/me/matching', label: '매칭', icon: 'people' },
  { href: '/me/readings', label: '풀이', icon: 'reading' },
  { href: '/me/chat', label: CHAT_TAB_LABEL, icon: 'chat' },
];

const SETTINGS = [
  { href: '/me/profile', label: '프로필' },
  { href: '/me/settings', label: '계정 관리' },
  { href: '/me/survey', label: '서비스 설문' },
] as const;

export function ProposedMenu({ unread, unreadChat }: { unread: number; unreadChat: number }) {
  return (
    <section aria-label="제안 메뉴" className="rounded-2xl border border-dashed border-border-strong p-3">
      <p className="eyebrow mb-2">제안 메뉴</p>

      {/* 데스크톱 — 탭 줄 */}
      <div className="hidden items-center gap-1 sm:flex">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={previewHref(tab.href)}
            aria-current={tab.href === '/me' ? 'page' : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              tab.href === '/me'
                ? 'bg-accent-wash text-accent-strong'
                : 'text-secondary hover:bg-surface-soft hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.href === '/me/chat' && <Badge count={unreadChat} />}
          </Link>
        ))}
        <span className="flex-1" />
        <Bell unread={unread} />
        <Settings />
      </div>

      {/* 모바일 — 하단 바 모양. 종과 톱니는 머리 오른쪽에 선다 */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex items-center justify-end gap-1.5">
          <Bell unread={unread} />
          <Settings />
        </div>
        <div className="grid grid-cols-4 rounded-2xl border border-border bg-background">
          {TABS.map((tab) => {
            const active = tab.href === '/me';
            return (
              <Link
                key={tab.href}
                href={previewHref(tab.href)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold ${active ? 'text-accent' : 'text-muted hover:text-foreground'}`}
              >
                <Icon name={tab.icon} />
                <span className="truncate">{tab.label}</span>
                {tab.href === '/me/chat' && unreadChat > 0 && (
                  <span className="absolute right-3 top-1.5 grid size-4.5 place-items-center rounded-full bg-fire text-[10px] font-bold text-white">
                    {unreadChat}
                    <span className="sr-only">건 안 읽음</span>
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
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

function Bell({ unread }: { unread: number }) {
  return (
    <Link
      href={previewHref('/me/requests')}
      aria-label="소식"
      className="relative grid size-9 place-items-center rounded-full border border-border-strong bg-surface text-secondary hover:border-accent hover:text-accent"
    >
      <Icon name="news" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 grid size-4.5 place-items-center rounded-full bg-fire text-[10px] font-bold text-white">
          {unread}
          <span className="sr-only">건 안 읽음</span>
        </span>
      )}
    </Link>
  );
}

function Settings() {
  return (
    <details className="relative">
      <summary
        aria-label="설정"
        className="grid size-9 cursor-pointer list-none place-items-center rounded-full border border-border-strong bg-surface text-secondary hover:border-accent hover:text-accent [&::-webkit-details-marker]:hidden"
      >
        <Icon name="gear" />
      </summary>
      <ul className="absolute right-0 z-10 mt-2 flex w-40 flex-col rounded-2xl border border-border bg-surface p-1.5 shadow-[var(--shadow-float)]">
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
