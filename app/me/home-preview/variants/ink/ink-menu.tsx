import Link from 'next/link';

import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { previewHref } from '../../shared/preview-href';
import { InkIcon, type IconName } from './icons';
import s from './ink.module.css';

/*
  **제안 메뉴 — 괘선 위의 네 글자.** 넷(홈 · 매칭 · 풀이 · 채팅)이 서고, 지금 있는 자리는 굵은 먹 글자와
  그 아래 주칠 네모 하나로 표시한다. 밑줄 · 알약 배경 대신 도장 한 점이다.
  종과 톱니는 44px 각진 칸. 안 읽은 수는 주칠 네모다.
  폰에서는 하단 바 모양이되 제자리에 선다 — `fixed` 는 실제 하단 메뉴와 겹친다.
*/

const TABS: readonly { href: string; label: string; icon: IconName }[] = [
  { href: '/me', label: '홈', icon: 'home' },
  { href: '/me/matching', label: '매칭', icon: 'people' },
  { href: '/me/readings', label: '풀이', icon: 'reading' },
  { href: '/me/chat', label: CHAT_TAB_LABEL, icon: 'chat' },
];

const GEAR_LINKS = [
  { href: '/me/profile', label: '프로필' },
  { href: '/me/settings', label: '계정 관리' },
  { href: '/me/survey', label: '서비스 설문' },
] as const;

export function InkMenu({ unread, unreadChat }: { unread: number; unreadChat: number }) {
  return (
    <section aria-label="제안 메뉴" className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-(--ink-3)">제안 메뉴</p>

      {/* 데스크톱 — 괘선 한 줄 */}
      <div className="hidden items-stretch justify-between border-y border-(--rule-strong) sm:flex">
        <ul className="flex">
          {TABS.map((tab) => {
            const active = tab.href === '/me';
            return (
              <li key={tab.href}>
                <Link
                  href={previewHref(tab.href)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex h-14 items-center gap-2 px-5 text-[15px] ${
                    active ? 'font-bold text-(--ink)' : 'font-medium text-(--ink-3) hover:text-(--ink)'
                  }`}
                >
                  {tab.label}
                  {tab.href === '/me/chat' && <Count count={unreadChat} />}
                  {active && <span aria-hidden="true" className="absolute bottom-2 left-1/2 size-1.5 -translate-x-1/2 bg-(--shu)" />}
                </Link>
              </li>
            );
          })}
        </ul>
        <Trailing unread={unread} />
      </div>

      {/* 폰 — 종과 톱니는 위, 넷은 아래 바 모양 */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex justify-end">
          <Trailing unread={unread} />
        </div>
        <ul className="grid grid-cols-4 border-y border-(--rule-strong)">
          {TABS.map((tab) => {
            const active = tab.href === '/me';
            return (
              <li key={tab.href} className="min-w-0">
                <Link
                  href={previewHref(tab.href)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${
                    active ? 'font-bold text-(--ink)' : 'font-medium text-(--ink-3)'
                  }`}
                >
                  <InkIcon name={tab.icon} className="size-6" />
                  <span>{tab.label}</span>
                  {tab.href === '/me/chat' && unreadChat > 0 && (
                    <span className="absolute right-[calc(50%-1.5rem)] top-2">
                      <Count count={unreadChat} />
                    </span>
                  )}
                  {active && <span aria-hidden="true" className="absolute inset-x-[30%] top-0 h-[3px] bg-(--shu)" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Trailing({ unread }: { unread: number }) {
  return (
    <div className="flex items-center gap-2 sm:pr-1">
      <Link
        href={previewHref('/me/requests')}
        aria-label="소식"
        className="relative grid size-11 place-items-center rounded-[2px] border border-(--rule-strong) text-(--ink) hover:bg-(--ink-wash) active:translate-y-px"
      >
        <InkIcon name="news" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5">
            <Count count={unread} />
          </span>
        )}
      </Link>
      <details className="relative">
        <summary
          aria-label="설정 메뉴"
          className="grid size-11 cursor-pointer list-none place-items-center rounded-[2px] border border-(--rule-strong) text-(--ink) hover:bg-(--ink-wash) [&::-webkit-details-marker]:hidden"
        >
          <InkIcon name="gear" />
        </summary>
        <div className="absolute right-0 top-13 z-10 w-48 border border-(--rule-strong) bg-(--paper-raised) py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
          {GEAR_LINKS.map((link) => (
            <Link
              key={link.href}
              href={previewHref(link.href)}
              className="flex min-h-11 items-center px-4 text-[15px] font-medium text-(--ink) hover:bg-(--ink-wash)"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </details>
    </div>
  );
}

/** 안 읽은 수 — 주칠 네모. 둥근 빨간 점이 아니라 찍은 인장 한 점이다 */
export function Count({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className={`${s.seal} h-5 min-w-5 px-1 text-[11px] font-bold tabular-nums`}>
      {count}
      <span className="sr-only">건 안 읽음</span>
    </span>
  );
}
