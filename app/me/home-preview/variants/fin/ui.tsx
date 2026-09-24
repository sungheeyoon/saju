import Link from 'next/link';
import type { ReactNode } from 'react';

/*
  **단추 체계 셋과 글자 단계 — 이 시안의 모든 자리가 여기서 고른다.**

  1차 시안들의 단추는 테두리 알약 하나가 주 · 보조 · 링크를 다 맡아 호버에서만 갈렸다. 여기서는 모양이 역할을 말한다:
  주는 폭을 꽉 채운 56px 채움, 보조는 같은 크기의 옅은 채움, 셋째는 셰브론이 붙은 글자다. 셋 다 누르면 0.98 로 준다.
*/

export const TYPE = {
  /** 한자 명식 — 화면의 주인공 */
  display: 'glyph text-[2.5rem] leading-none font-bold tracking-[-0.02em] sm:text-[3rem]',
  /** 화면 제목 */
  title: 'text-[1.75rem] leading-[1.25] font-extrabold tracking-[-0.04em]',
  /** 섹션 제목 — 굵고 큰 한 문장 */
  heading: 'text-[1.375rem] leading-[1.3] font-bold tracking-[-0.035em]',
  /** 줄 제목 · 단추 */
  label: 'text-[1.0625rem] leading-[1.4] font-semibold tracking-[-0.02em]',
  /** 본문 */
  body: 'text-[0.9375rem] leading-[1.5] font-medium tracking-[-0.01em] text-[var(--fin-sub)]',
  /** 설명 · 보조 */
  caption: 'text-[0.8125rem] leading-[1.4] font-medium text-[var(--fin-faint)]',
} as const;

const PRESS = 'active:scale-[0.98] transition-transform focus-visible:outline-offset-2';

export const BUTTON = {
  primary: `${PRESS} flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-[1.0625rem] font-bold tracking-[-0.02em] text-on-accent hover:bg-accent-strong`,
  secondary: `${PRESS} flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--fin-weak)] px-5 text-[1.0625rem] font-semibold tracking-[-0.02em] text-[var(--fin-text)] hover:bg-[var(--fin-weak-hover)]`,
  secondaryAccent: `${PRESS} flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--fin-accent-weak)] px-5 text-[1.0625rem] font-semibold tracking-[-0.02em] text-[var(--fin-accent-text)] hover:bg-[var(--fin-accent-weak-hover)]`,
  tertiary: `${PRESS} inline-flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-[0.9375rem] font-semibold text-[var(--fin-faint)] hover:text-[var(--fin-text)]`,
  chip: `${PRESS} inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-[var(--fin-weak)] px-3.5 text-[0.8125rem] font-semibold text-[var(--fin-text)] hover:bg-[var(--fin-weak-hover)]`,
  chipAccent: `${PRESS} inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-[var(--fin-accent-weak)] px-3.5 text-[0.8125rem] font-semibold text-[var(--fin-accent-text)] hover:bg-[var(--fin-accent-weak-hover)]`,
} as const;

/** 흰 덩어리 — 회색 바탕 위의 한 섹션 */
export function Block({ children, label, className = '' }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <section aria-label={label} className={`rounded-[1.5rem] bg-[var(--fin-card)] ${className}`}>
      {children}
    </section>
  );
}

/** 목록의 한 줄 — 왼쪽 원 · 가운데 두 줄 · 오른쪽 셰브론. 줄 전체가 링크다 */
export function ListRow({
  href,
  icon,
  title,
  sub,
  trailing,
}: {
  href: string;
  icon: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="mx-2 flex min-h-16 items-center gap-4 rounded-2xl px-3 py-3 transition-transform hover:bg-[var(--fin-press)] active:scale-[0.985] active:bg-[var(--fin-press)] sm:px-4"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className={`block truncate ${TYPE.label}`}>{title}</span>
        {sub !== undefined && <span className={`mt-0.5 block truncate ${TYPE.caption}`}>{sub}</span>}
      </span>
      {trailing}
      <Chevron />
    </Link>
  );
}

export function IconCircle({ children, tone = 'weak' }: { children: ReactNode; tone?: 'weak' | 'accent' | 'danger' }) {
  const color =
    tone === 'accent'
      ? 'bg-[var(--fin-accent-weak)] text-[var(--fin-accent-text)]'
      : tone === 'danger'
        ? 'bg-danger-wash text-danger'
        : 'bg-[var(--fin-weak)] text-[var(--fin-sub)]';
  return <span className={`grid size-11 shrink-0 place-items-center rounded-full ${color}`}>{children}</span>;
}

export function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`size-5 shrink-0 fill-none stroke-current text-[var(--fin-faint)] ${className}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#d4483a] px-1.5 text-[0.75rem] font-bold tabular-nums leading-none text-white">
      {count}
      <span className="sr-only">건 안 읽음</span>
    </span>
  );
}

export type IconName =
  | 'home'
  | 'people'
  | 'reading'
  | 'chat'
  | 'bell'
  | 'gear'
  | 'plus'
  | 'spark'
  | 'search'
  | 'heart'
  | 'alert'
  | 'user';

/** 선 아이콘 — `site-header.tsx` 의 선 굵기(1.7)를 따르고, 단추 안에서는 2 로 굵힌다 */
export function Icon({ name, className = 'size-5', stroke = 1.8 }: { name: IconName; className?: string; stroke?: number }) {
  const paths: Record<IconName, ReactNode> = {
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
    bell: (
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
    plus: <path d="M12 5v14M5 12h14" />,
    spark: <path d="M12 3.5 13.9 10 20.5 12l-6.6 2L12 20.5 10.1 14 3.5 12l6.6-2Z" />,
    search: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-4.5-4.5" />
      </>
    ),
    heart: <path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10Z" />,
    alert: (
      <>
        <path d="M12 4 21 19.5H3Z" />
        <path d="M12 10v4M12 16.8v.2" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M5 20c.6-3.8 3.1-6 7-6s6.4 2.2 7 6" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`shrink-0 fill-none stroke-current ${className}`}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
