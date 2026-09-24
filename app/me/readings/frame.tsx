'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSelectedLayoutSegment } from 'next/navigation';
import { useEffect, type CSSProperties, type ReactNode } from 'react';

import type { Element } from '@/src/lib/saju';

import { elementScope } from '../../element-tone';
import { ElementSymbol } from '../../ui/element-symbol';
import { Icon } from '../../ui/icons';

/**
 * **책장과 읽는 자리 — 두 칸, 주소 하나에 글 하나.**
 *
 * 넓은 화면(lg)은 왼쪽이 책장, 오른쪽이 고른 글이다. 책장은 레이아웃에 살아서 표지를 눌러 옮겨 다녀도
 * 다시 안 그려진다 — 오른쪽만 바뀐다. 폰은 같은 두 칸을 **주소로 갈아 끼운다**: `/me/readings` 는 책장,
 * `/me/readings/[subject]` 는 글. 그래서 뒤로 가기 · 새로고침 · 공유 링크가 늘 한 글을 가리킨다.
 *
 * 어느 칸을 보일지는 레이아웃 바로 아래 조각 하나로 정한다(`useSelectedLayoutSegment`) — 서버의
 * 레이아웃은 지금 주소를 모른다.
 */

/** 오른쪽 글 끝의 「다음 풀이」가 쓰는 한 사람 풀이 한 권 — 클라이언트로 넘기므로 값만 든다 */
export type NextBook = {
  readonly href: string;
  readonly title: string;
  readonly metaphor: string | null;
  readonly element: Element | null;
};

/** lg — 두 칸이 서는 폭. Tailwind 의 `lg:` 와 같은 값이어야 한 칸짜리 화면에서 옮기지 않는다 */
const TWO_COLUMNS = '(min-width: 64rem)';

export function ReadingsFrame({
  shelf,
  nothing,
  singles,
  children,
}: {
  /** 책장(머리 · 함께 보는 궁합 · 두 구역) */
  shelf: ReactNode;
  /** 한 권도 없을 때의 안내 — 있으면 목록 주소에서는 두 칸 대신 이것 한 장이 선다 */
  nothing: ReactNode | null;
  /** 한 사람 풀이 — DB 가 준 차례(최근 것이 먼저) */
  singles: readonly NextBook[];
  children: ReactNode;
}) {
  const segment = useSelectedLayoutSegment();
  const router = useRouter();
  const reading = segment !== null;
  const latest = singles[0]?.href ?? null;

  /*
    **넓은 화면에서 목록만 열면 가장 최근 글을 편다**(시안이 그랬다 — 첫 표지가 펼쳐진 채로 선다).
    주소를 그 글로 **바꿔 끼운다**(`replace`) — 뒤로 가기가 빈 오른쪽을 한 번 더 지나지 않는다. 폰은
    목록이 곧 첫 화면이라 옮기지 않는다.
  */
  useEffect(() => {
    if (reading || latest === null) return;
    if (window.matchMedia(TWO_COLUMNS).matches) router.replace(latest, { scroll: false });
  }, [reading, latest, router]);

  if (!reading && nothing !== null) return nothing;

  const index = reading ? singles.findIndex((book) => book.href === `/me/readings/${segment}`) : -1;
  const next = index === -1 || singles.length < 2 ? null : singles[(index + 1) % singles.length];

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
      <div className={`${reading ? 'hidden lg:flex' : 'flex'} min-w-0 flex-col gap-10`}>
        {shelf}
      </div>

      <div className={`${reading ? 'flex' : 'hidden lg:flex'} min-w-0 flex-col gap-8`}>
        {/* 곧 가장 최근 글로 옮겨 갈 자리에 「표지를 누르면」을 잠깐 세우지 않는다 */}
        {reading || latest === null ? children : null}
        {next !== null && <NextCard book={next} />}
      </div>
    </div>
  );
}

/**
 * 표지 링크 — **지금 펼친 글의 표지에 테가 선다.** 책장은 레이아웃에 살아 옮겨 다녀도 다시 안 그려지므로
 * 어느 권이 펼쳐졌는지는 주소에서 읽는다.
 */
export function CoverLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const current = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={`${className} ${current ? 'ring-[3px] ring-[var(--btn)] ring-offset-2 ring-offset-background' : ''}`}
      style={style}
    >
      {children}
    </Link>
  );
}

/** 폰에서 글 위에 서는 「← 만든 풀이 목록」 — 넓은 화면은 책장이 옆에 있으니 안 선다 */
export function BackToShelf({ className }: { className: string }) {
  return (
    <Link href="/me/readings" className={`${className} lg:hidden`}>
      <Icon name="back" className="size-4" />
      만든 풀이 목록
    </Link>
  );
}

/** 글을 다 읽은 사람의 다음 한 권 — 책장의 차례로 다음, 끝이면 처음 */
function NextCard({ book }: { book: NextBook }) {
  return (
    <Link
      href={book.href}
      className={`${elementScope(book.element)} group flex w-full max-w-[36rem] items-center gap-4 self-center rounded-[1.5rem] border border-border bg-surface p-4 text-left transition-colors hover:border-[color-mix(in_srgb,var(--ink)_40%,transparent)] active:scale-[0.99]`}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--tile)]">
        <ElementSymbol element={book.element} className="size-7" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[12px] font-semibold text-secondary">다음 풀이</span>
        <span className="truncate text-[15px] font-semibold text-foreground">{book.title}</span>
        {book.metaphor !== null && <span className="truncate text-[13px] text-secondary">{book.metaphor}</span>}
      </span>
      <Icon name="arrow" className="size-5 shrink-0 text-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
