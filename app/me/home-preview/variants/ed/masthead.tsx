import Link from 'next/link';

import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { previewHref } from '../../shared/preview-href';
import s from './ed.module.css';

/*
  **제안 메뉴 — 잡지의 제호(masthead).**

  굵은 잉크 선 한 줄 위에 제호, 그 아래 네 길(홈 · 매칭 · 풀이 · 채팅)이 활자로만 선다. 지금 있는 곳은 밑줄 2px 로
  말한다 — 알약도 색 칠도 없다. 종과 톱니는 44px 원. 폰에서도 같은 모양이 한 줄로 서고(네 칸 격자), 하단 바처럼
  `fixed` 로 띄우지 않는다 — 실제 하단 메뉴와 겹친다.
*/

const TABS = [
  { href: '/me', label: '홈' },
  { href: '/me/matching', label: '매칭' },
  { href: '/me/readings', label: '풀이' },
  { href: '/me/chat', label: CHAT_TAB_LABEL },
] as const;

const GEAR_LINKS = [
  { href: '/me/profile', label: '프로필' },
  { href: '/me/settings', label: '계정 관리' },
  { href: '/me/survey', label: '서비스 설문' },
] as const;

export function Masthead({ unread, unreadChat }: { unread: number; unreadChat: number }) {
  return (
    <header aria-label="제안 메뉴" className={s.ruleHeavy}>
      <div className="flex items-center justify-between gap-3 pt-2">
        <p className={s.wordmark}>[서비스명]</p>

        <nav aria-label="주 메뉴" className="hidden sm:block">
          <Tabs unreadChat={unreadChat} />
        </nav>

        <div className="flex items-center">
          <Link href={previewHref('/me/requests')} aria-label="소식" className={s.icon}>
            <Icon name="news" />
            {unread > 0 && <Dot count={unread} />}
          </Link>
          <details className="relative">
            <summary aria-label="설정 메뉴" className={`${s.icon} ${s.summary}`}>
              <Icon name="gear" />
            </summary>
            <div className="absolute right-0 top-12 z-10 w-52 border border-foreground bg-background py-2">
              {GEAR_LINKS.map((link) => (
                <Link key={link.href} href={previewHref(link.href)} className={s.menuItem}>
                  {link.label}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </div>

      <nav aria-label="주 메뉴" className={`${s.hair} mt-2 sm:hidden`}>
        <Tabs unreadChat={unreadChat} />
      </nav>
      <div className={`${s.rule} hidden sm:block`} />
    </header>
  );
}

function Tabs({ unreadChat }: { unreadChat: number }) {
  return (
    <ul className="grid grid-cols-4 sm:flex sm:gap-2">
      {TABS.map((tab) => {
        const active = tab.href === '/me';
        return (
          <li key={tab.href} className="min-w-0">
            <Link
              href={previewHref(tab.href)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-12 items-center justify-center gap-1.5 px-3 text-[0.9375rem] font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-foreground ${
                active ? 'text-foreground' : 'text-secondary hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.href === '/me/chat' && unreadChat > 0 && (
                <span className={`${s.figure} text-[0.8125rem] font-semibold text-fire`}>
                  {unreadChat}
                  <span className="sr-only">건 안 읽음</span>
                </span>
              )}
              {active && <span aria-hidden="true" className="absolute inset-x-3 bottom-1.5 h-0.5 bg-foreground" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Dot({ count }: { count: number }) {
  return (
    <span className="absolute right-1 top-1 grid min-w-4.5 place-items-center rounded-full bg-fire px-1 text-[11px] font-bold leading-[18px] text-white">
      {count}
      <span className="sr-only">건 안 읽음</span>
    </span>
  );
}

/** 선은 `site-header.tsx` 의 `MobileNavIcon` 과 같은 결이다 */
function Icon({ name }: { name: 'news' | 'gear' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[22px] fill-none stroke-current"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'news' ? (
        <>
          <path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 8H4c0-1 2-1 2-8Z" />
          <path d="M9.5 20h5" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
        </>
      )}
    </svg>
  );
}
