import type { ReactNode } from 'react';

/*
  **버튼 세 단과 아이콘** — 차트와 단추가 서로 닮지 않게 하는 것이 이 파일의 일이다.

  차트는 테두리도 그림자도 없는 납작한 칸이다. 그러니 단추는 반대로 **윤곽 · 높이 · 화살표**를 든다:
  주는 채움 + 그림자, 보조는 테두리 + 1px 바닥 그림자, 셋째는 밑줄이 서는 글자 링크. 셋 다 누르면 1px 가라앉고
  (`active:`), 키보드 포커스는 accent 2px 윤곽이다. 누를 자리는 44px(보조 · 셋째) · 48px(주) 아래로 안 내린다.
*/

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** 주 — 한 영역에 하나. 다크 모드에서 `accent-strong` 이 글자와 대비가 무너져 명도로만 누른다 */
export const PRIMARY = `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[15px] font-semibold tracking-[-0.01em] text-on-accent shadow-[0_1px_0_rgba(0,0,0,0.06),0_6px_16px_-8px_var(--accent)] hover:brightness-[0.93] active:translate-y-px active:shadow-none ${FOCUS}`;

/** 보조 — 테두리와 바닥 그림자 한 줄이 「눌리는 것」을 말한다 */
export const SECONDARY = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold text-foreground shadow-[0_1px_0_var(--border-strong)] hover:bg-surface-soft active:translate-y-px active:bg-surface-sunken active:shadow-none ${FOCUS}`;

/** 셋째 — 글자 링크. 화살표가 늘 붙는다 */
export const TERTIARY = `inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-semibold text-accent underline-offset-4 hover:underline active:opacity-70 ${FOCUS}`;

/**
 * 표 안의 작은 단추 — 높이는 44px 를 지키고 글자만 13px 로 줄인다. 「풀이 받기」는 옅은 채움 + accent 테두리다:
 * 열 줄에 진한 채움이 여섯 번 서면 화면의 주 단추(사주풀이 보기)가 묻힌다.
 */
export const ROW_PRIMARY = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-accent/45 bg-accent-wash px-3.5 text-[13px] font-bold text-accent shadow-[0_1px_0_var(--border-strong)] hover:border-accent active:translate-y-px active:shadow-none ${FOCUS}`;
export const ROW_SECONDARY = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3.5 text-[13px] font-semibold text-foreground shadow-[0_1px_0_var(--border-strong)] hover:bg-surface-soft active:translate-y-px active:bg-surface-sunken active:shadow-none ${FOCUS}`;

export type IconName =
  | 'home'
  | 'people'
  | 'reading'
  | 'chat'
  | 'news'
  | 'gear'
  | 'plus'
  | 'arrow'
  | 'chevron'
  | 'compat'
  | 'search'
  | 'spark';

/** 선 아이콘 — 메뉴의 넷은 `site-header.tsx` 의 `MobileNavIcon` 과 같은 선이다 */
export function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
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
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    compat: (
      <>
        <circle cx="9" cy="12" r="5" />
        <circle cx="15" cy="12" r="5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-4.5-4.5" />
      </>
    ),
    spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`${className} shrink-0 fill-none stroke-current`}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

/** 안 읽은 수 — 불(火) 색 동그라미에 숫자. 색만으로 말하지 않게 숫자가 늘 선다 */
export function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-fire px-1 text-[11px] font-bold leading-none tabular-nums text-white">
      {count}
      <span className="sr-only">건 안 읽음</span>
    </span>
  );
}
