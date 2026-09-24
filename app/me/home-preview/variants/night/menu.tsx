import Link from 'next/link';

import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { previewHref } from '../../shared/preview-href';
import { Icon, type IconName } from './icons';
import styles from './night.module.css';

/*
  **제안 메뉴의 모형 — 밤하늘 판.** 넷(홈 · 매칭 · 풀이 · 채팅) · 소식 종 · 톱니(프로필 · 계정 관리 · 서비스 설문).

  데스크톱은 위의 유리 막대 하나, 폰은 위에 종과 톱니만 남기고 넷은 판 **맨 아래** 막대로 내린다 — 실제
  하단 메뉴의 자리를 흉내 내되 `fixed` 로 띄우지 않는다. 지금 자리는 금빛 글자와 그 위의 별 하나로 말한다
  (색만이 아니라 점과 굵기, `aria-current`).
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

/** 위 — 데스크톱은 탭 막대, 폰은 종과 톱니만 */
export function MenuTop({ unread, unreadChat }: { unread: number; unreadChat: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-[color:var(--n-gold)]">
        <Icon name="moon" className="size-5" />
        <span className="text-xs font-semibold tracking-[0.08em] text-[color:var(--n-text-3)]">제안 메뉴</span>
      </span>

      <nav aria-label="제안 메뉴" className={`${styles.glass} hidden rounded-full p-1 sm:block`}>
        <ul className="flex items-center gap-1">
          {TABS.map((tab) => {
            const active = tab.href === '/me';
            return (
              <li key={tab.href}>
                <Link
                  href={previewHref(tab.href)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ${
                    active
                      ? 'bg-[var(--n-gold-wash)] text-[color:var(--n-gold-strong)]'
                      : 'text-[color:var(--n-text-2)] hover:bg-white/5 hover:text-[color:var(--n-text)] active:bg-white/10'
                  }`}
                >
                  <Icon name={tab.icon} className="size-4.5" />
                  {tab.label}
                  {tab.href === '/me/chat' && <Badge count={unreadChat} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Trailing unread={unread} />
    </div>
  );
}

/** 아래 — 폰에서만. 실제 하단 메뉴의 모양을 판 안에 둔다 */
export function MenuBottom({ unreadChat }: { unreadChat: number }) {
  return (
    <nav aria-label="제안 메뉴 · 하단" className={`${styles.glass} rounded-3xl px-1 sm:hidden`}>
      <ul className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active = tab.href === '/me';
          return (
            <li key={tab.href} className="min-w-0">
              <Link
                href={previewHref(tab.href)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-xs ${
                  active
                    ? 'font-bold text-[color:var(--n-gold-strong)]'
                    : 'font-medium text-[color:var(--n-text-2)] active:bg-white/5'
                }`}
              >
                {active && (
                  <span aria-hidden="true" className="absolute top-1.5 size-1 rounded-full bg-[var(--n-gold)] shadow-[0_0_8px_var(--n-gold)]" />
                )}
                <Icon name={tab.icon} className="size-5.5" />
                <span className="truncate">{tab.label}</span>
                {tab.href === '/me/chat' && unreadChat > 0 && (
                  <span className="absolute right-[22%] top-2">
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

/** 종과 톱니 — 두 폭이 같은 것을 쓴다. 누를 자리 44px */
function Trailing({ unread }: { unread: number }) {
  const round = `${styles.secondary} relative grid size-11 place-items-center rounded-full`;
  return (
    <div className="flex items-center gap-2">
      <Link href={previewHref('/me/requests')} aria-label="소식" className={round}>
        <Icon name="news" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5">
            <Badge count={unread} />
          </span>
        )}
      </Link>
      <details className="relative">
        <summary aria-label="설정 메뉴" className={`${round} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
          <Icon name="gear" />
        </summary>
        <div className="absolute right-0 top-13 z-10 w-52 rounded-2xl border border-[color:var(--n-line-strong)] bg-[#141a30] p-1.5 shadow-[0_20px_40px_-12px_rgb(0_0_0/0.7)]">
          {GEAR_LINKS.map((link) => (
            <Link
              key={link.href}
              href={previewHref(link.href)}
              className="flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-semibold text-[color:var(--n-text)] hover:bg-white/8 active:bg-white/4"
            >
              {link.label}
              <Icon name="arrow" className="size-4 text-[color:var(--n-text-3)]" />
            </Link>
          ))}
        </div>
      </details>
    </div>
  );
}

/** 안 읽은 수 — 산호색 바탕에 짙은 글자(대비 9:1) */
export function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--n-coral)] px-1 text-[11px] font-bold tabular-nums text-[#240b05]">
      {count}
      <span className="sr-only">건 안 읽음</span>
    </span>
  );
}
