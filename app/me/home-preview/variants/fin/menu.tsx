import Link from 'next/link';

import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { previewHref } from '../../shared/preview-href';
import styles from './fin.module.css';
import { Badge, Icon, TYPE, type IconName } from './ui';

/*
  **메뉴 두 벌 — 앱처럼 위에는 제목과 종 · 톱니, 아래에는 탭 넷.**

  폰에서는 위가 제목 줄, 아래가 탭 막대다(토스 · 카카오뱅크와 같은 자리). 넓은 화면에서는 탭이 제목 줄 가운데로
  올라가고 아래 막대는 숨는다. 아래 막대는 `fixed` 로 띄우지 않는다 — 실제 하단 메뉴와 겹친다.
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

const ROUND_ICON =
  'relative grid size-11 place-items-center rounded-full text-[var(--fin-sub)] hover:bg-[var(--fin-weak-hover)] active:scale-[0.94] transition-transform';

export function TopBar({ unread, unreadChat }: { unread: number; unreadChat: number }) {
  return (
    <header className="flex items-start justify-between gap-3 px-1 pt-2 sm:items-center sm:px-2">
      <div className="min-w-0">
        <h2 className={TYPE.title}>나의 사주와 인연</h2>
        <p className={`mt-1 ${TYPE.caption}`}>저장한 사주를 확인하고 오늘의 인연을 만나보세요.</p>
      </div>

      <nav aria-label="제안 메뉴" className="hidden items-center gap-1 rounded-full bg-[var(--fin-card)] p-1 lg:flex">
        {TABS.map((tab) => {
          const active = tab.href === '/me';
          return (
            <Link
              key={tab.href}
              href={previewHref(tab.href)}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[0.9375rem] font-semibold transition-transform active:scale-[0.96] ${
                active ? 'bg-[var(--fin-text)] text-[var(--fin-card)]' : 'text-[var(--fin-sub)] hover:bg-[var(--fin-weak)]'
              }`}
            >
              {tab.label}
              {tab.href === '/me/chat' && <Badge count={unreadChat} />}
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center">
        <Link href={previewHref('/me/requests')} aria-label="소식" className={ROUND_ICON}>
          <Icon name="bell" className="size-6" />
          {unread > 0 && (
            <span className="absolute right-0.5 top-0.5">
              <Badge count={unread} />
            </span>
          )}
        </Link>
        <details className={`relative ${styles.gearMenu}`}>
          <summary aria-label="설정 메뉴" className={`${ROUND_ICON} cursor-pointer list-none`}>
            <Icon name="gear" className="size-6" />
          </summary>
          <div className="absolute right-0 top-12 z-10 w-52 rounded-2xl bg-[var(--fin-card)] p-2 shadow-[var(--shadow-float)]">
            {GEAR_LINKS.map((link) => (
              <Link
                key={link.href}
                href={previewHref(link.href)}
                className="flex min-h-11 items-center rounded-xl px-3 text-[0.9375rem] font-semibold hover:bg-[var(--fin-weak)] active:scale-[0.98]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </details>
      </div>
    </header>
  );
}

/** 폰의 탭 막대 모형 — 제자리에 선다 */
export function TabBar({ unreadChat }: { unreadChat: number }) {
  return (
    <nav aria-label="제안 메뉴 · 하단" className="rounded-[1.5rem] bg-[var(--fin-card)] px-2 py-1 lg:hidden">
      <ul className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active = tab.href === '/me';
          return (
            <li key={tab.href} className="min-w-0">
              <Link
                href={previewHref(tab.href)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[0.75rem] font-semibold transition-transform active:scale-[0.94] ${
                  active ? 'text-[var(--fin-text)]' : 'text-[var(--fin-faint)]'
                }`}
              >
                <Icon name={tab.icon} className="size-6" stroke={active ? 2.2 : 1.8} />
                <span>{tab.label}</span>
                {tab.href === '/me/chat' && unreadChat > 0 && (
                  <span className="absolute left-1/2 top-1 ml-2">
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
