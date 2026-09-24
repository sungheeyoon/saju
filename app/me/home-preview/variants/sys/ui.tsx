import Link from 'next/link';
import type { ReactNode } from 'react';

import { Icon, type IconName } from './icons';

/*
  **시안 sys 의 부품 — 이 홈은 이 파일의 것만으로 조립한다.**

  실제 `/me` · `/me/people` 을 재 보니 글자 크기가 열(`text-[10px]` ~ `text-3xl`, 임의값 셋 포함)이고 그중
  `text-xs` · `text-sm` 이 64 번 중 47 번이었다 — 한 화면의 거의 전부가 12 · 14px 두 칸 사이에 있다. 단추 모양은
  높이 일곱(`h-9` · `h-10` · `min-h-10` · `h-11` · `size-8/9/10` · `min-h-[4.75rem]`) × 모서리 여섯(`rounded-md` ·
  `-lg` · `-xl` · `-2xl` · `-full` · `-[1.75rem]`)이 섞였다(NOTES 「감사」). 그래서 크기를 **다섯 단**으로, 누르는 것을 **세 단 + 아이콘 단추**로 닫는다.
  옮길 때는 이 파일이 `app/ui/` 로 가고 화면은 이 이름만 부른다.
*/

/* ── 글자 ─────────────────────────────────────────────────────────────── */

/**
 * 타입 스케일 — 글 다섯 단 + 명식 글자 전용 한 단.
 * 비율은 약 1.15~1.3 (12 · 13 · 15 · 17 · 22/24). 명식 글자(44/52)는 글이 아니라 **도상**이라 따로 둔다.
 */
export const TYPE = {
  /** 명식 여덟 글자 — 화면에서 가장 먼저 읽히는 것 */
  display: 'glyph text-[2.75rem] leading-none font-semibold tracking-[-0.02em] sm:text-[3.25rem]',
  /** 페이지 제목 · 내 이름 — 두 번째로 읽히는 것 */
  title: 'text-[1.375rem] leading-[1.3] font-bold tracking-[-0.03em] sm:text-2xl',
  /** 영역 제목 */
  heading: 'text-[1.0625rem] leading-[1.4] font-bold tracking-[-0.02em]',
  /** 본문 · 이름 · 주/보조 단추 글자 */
  body: 'text-[0.9375rem] leading-[1.55] tracking-[-0.01em]',
  /** 보조 정보 — 날짜 · 비유 한 줄 · 설명 */
  caption: 'text-[0.8125rem] leading-[1.45]',
  /** 라벨 — 기둥 이름 · 개수 · 표지. 이 화면의 가장 작은 글자다(12px) */
  label: 'text-xs leading-4 font-semibold tracking-[0.02em]',
} as const;

/** 글자 색 셋 + 뜻 색 둘. 셋의 차이는 대비로 잰다: 17.0 · 6.0 · 5.3(보정한 muted) */
export const TONE = {
  default: 'text-foreground',
  secondary: 'text-secondary',
  muted: 'text-[var(--sys-muted)]',
  accent: 'text-[var(--sys-link)]',
  danger: 'text-danger',
} as const;

type TextTag = 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'strong';

export function Text({
  as: Tag = 'p',
  variant,
  tone = 'default',
  weight,
  className = '',
  children,
  id,
}: {
  as?: TextTag;
  variant: Exclude<keyof typeof TYPE, 'display'>;
  tone?: keyof typeof TONE;
  /** 본문 · 보조 글자만 굵기를 올린다 — 제목과 라벨은 굵기가 정해져 있다 */
  weight?: 'medium' | 'semibold';
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  const w = weight === 'semibold' ? 'font-semibold' : weight === 'medium' ? 'font-medium' : '';
  return (
    <Tag id={id} className={`${TYPE[variant]} ${TONE[tone]} ${w} ${className}`}>
      {children}
    </Tag>
  );
}

/* ── 누르는 것 ────────────────────────────────────────────────────────── */

/**
 * 단추 세 단. **모양이 곧 무게다** — 채움(주) · 테두리(보조) · 밑줄 글자(셋째).
 * 셋 다 누를 자리는 44px 이상이고, 누르면 98% 로 눌린다. 포커스 링은 `globals.css` 의 것(3px, 28% 초록)을 쓴다.
 */
const BUTTON_BASE =
  'inline-flex min-w-0 select-none items-center justify-center gap-2 whitespace-nowrap font-semibold active:scale-[0.98]';

const BUTTON = {
  primary:
    'rounded-full bg-accent text-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(20,30,24,0.18)] hover:bg-[var(--sys-primary-hover)]',
  secondary:
    'rounded-full border border-border-strong bg-surface text-foreground shadow-[0_1px_2px_rgba(20,30,24,0.06)] hover:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] hover:bg-surface-soft active:bg-surface-sunken',
  tertiary:
    'rounded-md text-[var(--sys-link)] underline decoration-[1.5px] decoration-[color-mix(in_srgb,var(--sys-link)_35%,transparent)] underline-offset-[5px] hover:decoration-[var(--sys-link)]',
} as const;

const BUTTON_SIZE = {
  /** 44 → 48. 영역의 주 행동 */
  md: `h-12 px-5 ${TYPE.body}`,
  /** 목록 줄 안 — 폰에서는 44, 마우스 폭에서는 36 */
  sm: `h-11 px-3.5 sm:h-9 ${TYPE.caption}`,
} as const;

export function Button({
  href,
  variant = 'secondary',
  size = 'md',
  icon,
  arrow = false,
  full = false,
  label,
  className = '',
  children,
}: {
  href: string;
  variant?: keyof typeof BUTTON;
  size?: keyof typeof BUTTON_SIZE;
  icon?: IconName;
  /** 주 단추에만 → 를 붙인다. 셋째 단추는 늘 붙고, 보조 단추는 안 붙는다 — 칸의 › 와 겹치지 않게 */
  arrow?: boolean;
  full?: boolean;
  /** 보이는 글자가 뜻을 다 못 말할 때 */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const geometry =
    variant === 'tertiary' ? `min-h-11 px-1 ${size === 'sm' ? TYPE.caption : TYPE.body}` : BUTTON_SIZE[size];
  return (
    <Link
      href={href}
      aria-label={label}
      className={`${BUTTON_BASE} ${BUTTON[variant]} ${geometry} ${full ? 'w-full' : ''} ${className}`}
    >
      {icon !== undefined && <Icon name={icon} size={16} />}
      <span className="min-w-0 truncate">{children}</span>
      {(arrow || variant === 'tertiary') && <Icon name="arrow" size={16} />}
    </Link>
  );
}

/** 아이콘 단추 — 44 원. 글자가 없으니 `label` 이 반드시 선다 */
export function IconButton({
  href,
  icon,
  label,
  count = 0,
}: {
  href: string;
  icon: IconName;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative grid size-11 shrink-0 place-items-center rounded-full text-secondary hover:bg-surface-soft hover:text-foreground active:scale-[0.96] active:bg-surface-sunken"
    >
      <Icon name={icon} />
      {count > 0 && (
        <span className="absolute right-1 top-1">
          <CountBadge count={count} />
        </span>
      )}
    </Link>
  );
}

/**
 * 칸 — **다른 화면으로 가는 줄.** 단추가 「여기서 한다」라면 칸은 「저기로 간다」다.
 * 왼쪽 아이콘 타일 · 제목 · 설명 · 오른쪽 꺾쇠. 줄 전체가 누를 자리다(최소 64px).
 */
export function Cell({
  href,
  icon,
  title,
  description,
  trailing,
  tone = 'plain',
}: {
  href: string;
  icon: IconName;
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  tone?: 'plain' | 'accent';
}) {
  return (
    <Link
      href={href}
      className={`group flex min-h-16 min-w-0 items-center gap-3 px-4 py-3 active:scale-[0.99] ${
        tone === 'accent' ? 'bg-accent-wash hover:bg-accent-soft' : 'hover:bg-surface-soft active:bg-surface-sunken'
      }`}
    >
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-2xl ${
          tone === 'accent' ? 'bg-surface text-[var(--sys-link)]' : 'bg-accent-wash text-[var(--sys-link)]'
        }`}
      >
        <Icon name={icon} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`${TYPE.body} font-semibold`}>{title}</span>
        {description !== undefined && <span className={`${TYPE.caption} ${TONE.secondary}`}>{description}</span>}
      </span>
      {trailing}
      <span className="text-[var(--sys-muted)] group-hover:translate-x-0.5 group-hover:text-foreground">
        <Icon name="chevron" />
      </span>
    </Link>
  );
}

/** 안 읽은 수 — 숫자만으로는 무엇의 수인지 모르니 화면 밖 말이 붙는다 */
export function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-[var(--sys-alert)] px-1 text-[11px] font-bold leading-none tabular-nums text-[var(--sys-on-alert)]">
      {count}
      <span className="sr-only">건 안 읽음</span>
    </span>
  );
}

/** 표지 — 누르는 것이 아니다. 모서리가 단추(원)와 달리 6px 이라 눌러 볼 이유가 안 생긴다 */
export function Tag({ children, tone = 'warning' }: { children: ReactNode; tone?: 'warning' | 'neutral' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 ${TYPE.label} ${
        tone === 'warning' ? 'bg-warning-wash text-[var(--sys-warning-ink)]' : `bg-surface-sunken ${TONE.muted}`
      }`}
    >
      {children}
    </span>
  );
}

/** 카드 — 모서리 28 · 테두리 · 그림자 하나. 안쪽 여백은 폰 20 / 넓은 폭 32 */
export const CARD = 'rounded-[1.75rem] border border-border bg-surface shadow-[var(--shadow-card)]';
