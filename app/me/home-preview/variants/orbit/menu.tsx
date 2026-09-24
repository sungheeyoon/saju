import Link from 'next/link';

import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { previewHref } from '../../shared/preview-href';

/*
  **제안 메뉴 — 데스크톱은 떠 있는 알약 하나, 폰은 아래 탭 막대.**

  1차 메뉴는 글자 네 개가 줄에 서고 지금 자리는 옅은 배경뿐이라 눌리는 것처럼 안 보였다. 여기서는
  데스크톱에서 네 길을 **한 덩어리의 분할 단추**로 묶고 지금 자리는 흰 판이 떠 오른다(Arc 의 탭 막대).
  소식 종과 톱니는 44px 원이다. 폰에서는 하단 막대 모양이되 `fixed` 로 띄우지 않는다 — 실제 하단 메뉴와 겹친다.
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

const RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function TopBar({ unread, unreadChat }: { unread: number; unreadChat: number }) {
  return (
    <nav aria-label="제안 메뉴" className="flex items-center justify-between gap-3">
      <ul className="hidden items-center gap-1 rounded-full border border-border bg-surface-sunken p-1 sm:flex">
        {TABS.map((tab) => {
          const active = tab.href === '/me';
          return (
            <li key={tab.href}>
              <Link
                href={previewHref(tab.href)}
                aria-current={active ? 'page' : undefined}
                className={`relative inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition active:scale-[0.97] ${RING} ${
                  active
                    ? 'bg-surface text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08),0_4px_12px_-4px_rgba(0,0,0,0.12)]'
                    : 'text-secondary hover:bg-surface/60 hover:text-foreground'
                }`}
              >
                <MenuIcon name={tab.icon} className={active ? 'text-accent' : ''} />
                {tab.label}
                {tab.icon === 'chat' && <Badge count={unreadChat} />}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-[13px] font-bold text-muted sm:hidden">[서비스명]</p>
      <Trailing unread={unread} />
    </nav>
  );
}

/** 폰의 하단 탭 — 제자리에 선 모형이다 */
export function BottomBar({ unreadChat }: { unreadChat: number }) {
  return (
    <nav aria-label="제안 메뉴 — 폰 하단" className="sm:hidden">
      <ul className="grid grid-cols-4 rounded-[1.5rem] border border-border bg-surface p-1.5 shadow-[var(--shadow-float)]">
        {TABS.map((tab) => {
          const active = tab.href === '/me';
          return (
            <li key={tab.href} className="min-w-0">
              <Link
                href={previewHref(tab.href)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold transition active:scale-95 ${RING} ${
                  active ? 'bg-accent-wash text-accent' : 'text-secondary'
                }`}
              >
                <MenuIcon name={tab.icon} />
                {tab.label}
                {tab.icon === 'chat' && unreadChat > 0 && (
                  <span className="absolute right-[22%] top-1.5">
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

function Trailing({ unread }: { unread: number }) {
  const round = `relative grid size-11 place-items-center rounded-full border border-border-strong bg-surface text-foreground transition hover:border-accent hover:text-accent active:scale-95 ${RING}`;
  return (
    <div className="flex items-center gap-2">
      <Link href={previewHref('/me/requests')} aria-label="소식" className={round}>
        <MenuIcon name="news" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1">
            <Badge count={unread} />
          </span>
        )}
      </Link>
      <details className="relative">
        <summary aria-label="설정 메뉴" className={`${round} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
          <MenuIcon name="gear" />
        </summary>
        <div className="absolute right-0 top-13 z-10 w-52 rounded-2xl border border-border bg-surface p-1.5 shadow-[var(--shadow-float)]">
          {GEAR_LINKS.map((link) => (
            <Link
              key={link.href}
              href={previewHref(link.href)}
              className={`flex min-h-11 items-center rounded-xl px-3 text-[15px] font-semibold hover:bg-surface-soft active:bg-surface-sunken ${RING}`}
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
    <span className="grid min-w-5 place-items-center rounded-full bg-fire px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-surface">
      {count}
      <span className="sr-only">건 안 읽음</span>
    </span>
  );
}

/** 선은 `site-header.tsx` 의 `MobileNavIcon` 사본이다 — 톱니만 더했다 */
function MenuIcon({ name, className = '' }: { name: Icon; className?: string }) {
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
      className={`size-5 shrink-0 fill-none stroke-current ${className}`}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
