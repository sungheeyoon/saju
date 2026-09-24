import Link from 'next/link';

import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { previewHref } from '../../shared/preview-href';
import { Icon, type IconName } from './icons';
import { CountBadge, IconButton, TONE, TYPE } from './ui';

/*
  **제안 메뉴의 모형** — 실제 머리글(`app/site-header.tsx`)은 이 라운드에 안 고친다. `fixed` 로 띄우지 않는다.

  넓은 폭: 한 줄 막대 — 왼쪽 네 탭(홈 · 매칭 · 풀이 · 채팅)은 **분할 선택**(현재 탭만 흰 칸이 떠오른다),
  오른쪽은 아이콘 단추 둘(소식 · 설정). 폰: 탭 넷은 아래 막대로 가고, 소식 · 설정은 제목 줄 오른쪽에 붙는다.
  지금 머리글은 현재 탭을 글자색 하나로만 말한다 — 여기서는 바탕 · 굵기 · 그림자 셋이 함께 바뀐다.
*/

const TABS: readonly { href: string; label: string; icon: IconName }[] = [
  { href: '/me', label: '홈', icon: 'home' },
  { href: '/me/matching', label: '매칭', icon: 'people' },
  { href: '/me/readings', label: '풀이', icon: 'book' },
  { href: '/me/chat', label: CHAT_TAB_LABEL, icon: 'chat' },
];

const SETTINGS = [
  { href: '/me/profile', label: '프로필' },
  { href: '/me/settings', label: '계정 관리' },
  { href: '/me/survey', label: '서비스 설문' },
] as const;

/** 넓은 폭의 막대 */
export function TopMenu({ unread, unreadChat }: { unread: number; unreadChat: number }) {
  return (
    <nav aria-label="제안 메뉴" className="hidden items-center justify-between gap-4 sm:flex">
      <ul className="flex items-center gap-1 rounded-full bg-surface-sunken p-1">
        {TABS.map((tab) => {
          const active = tab.href === '/me';
          return (
            <li key={tab.href}>
              <Link
                href={previewHref(tab.href)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-10 items-center gap-2 rounded-full px-4 ${TYPE.body} ${
                  active
                    ? 'bg-surface font-bold text-foreground shadow-[0_1px_3px_rgba(20,30,24,0.12)]'
                    : `font-medium ${TONE.secondary} hover:bg-surface/60 hover:text-foreground`
                }`}
              >
                <Icon name={tab.icon} size={16} />
                {tab.label}
                {tab.href === '/me/chat' && <CountBadge count={unreadChat} />}
              </Link>
            </li>
          );
        })}
      </ul>
      <Trailing unread={unread} />
    </nav>
  );
}

/** 소식 종과 설정 — 두 폭이 같은 것을 쓴다 */
export function Trailing({ unread, className = '' }: { unread: number; className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <IconButton href={previewHref('/me/requests')} icon="bell" label="소식" count={unread} />
      <details className="relative">
        <summary
          aria-label="설정 메뉴"
          className="grid size-11 cursor-pointer list-none place-items-center rounded-full text-secondary hover:bg-surface-soft hover:text-foreground active:bg-surface-sunken [&::-webkit-details-marker]:hidden"
        >
          <Icon name="gear" />
        </summary>
        <ul className="absolute right-0 top-12 z-10 flex w-52 flex-col rounded-2xl border border-border bg-surface p-1.5 shadow-[var(--shadow-float)]">
          {SETTINGS.map((link) => (
            <li key={link.href}>
              <Link
                href={previewHref(link.href)}
                className={`flex min-h-11 items-center justify-between rounded-xl px-3 ${TYPE.body} font-medium hover:bg-surface-soft`}
              >
                {link.label}
                <span className={TONE.muted}>
                  <Icon name="chevron" size={16} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** 폰의 아래 막대 — 제자리에 선다(실제 하단 메뉴와 겹치지 않게) */
export function BottomMenu({ unreadChat }: { unreadChat: number }) {
  return (
    <nav aria-label="제안 메뉴" className="flex flex-col gap-2 sm:hidden">
      <span className={`${TYPE.label} ${TONE.muted} px-1`}>제안 메뉴</span>
      <ul className="grid grid-cols-4 rounded-[1.75rem] border border-border bg-surface p-1.5 shadow-[var(--shadow-card)]">
        {TABS.map((tab) => {
          const active = tab.href === '/me';
          return (
            <li key={tab.href} className="min-w-0">
              <Link
                href={previewHref(tab.href)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl ${TYPE.label} ${
                  active ? 'bg-accent-wash text-[var(--sys-link)]' : `${TONE.muted} active:bg-surface-sunken`
                }`}
              >
                <Icon name={tab.icon} />
                <span className="truncate">{tab.label}</span>
                {tab.href === '/me/chat' && unreadChat > 0 && (
                  <span className="absolute right-[18%] top-1.5">
                    <CountBadge count={unreadChat} />
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
