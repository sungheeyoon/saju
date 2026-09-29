'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams, useSelectedLayoutSegment } from 'next/navigation';
import { useEffect, type CSSProperties, type ReactNode } from 'react';

import type { Element } from '@/src/lib/saju';

import { elementScope } from '../../../ui/element-tone';
import { FaceSymbol } from '../../../ui/stem-symbol';
import { Icon } from '../../../ui/icons';
import { TYPE_TITLE } from '../../../ui/surfaces';
import { backOf, isOpenResult, placeOf, resultKindOf, withCameFrom, type CameFrom } from '../../../came-from';
import { SHELF_KIND_LABEL, SHELF_KINDS, SHELF_TITLE, shelfKindOf, withShelfKind, type ShelfKind } from './kind';
import { openingHref } from './opening';

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
  /** 그 사람의 일간 — 얼굴에 천간 그림을 세운다 */
  readonly stem: string | null;
};

/** lg — 두 칸이 서는 폭. Tailwind 의 `lg:` 와 같은 값이어야 한 칸짜리 화면에서 옮기지 않는다 */
const TWO_COLUMNS = '(min-width: 64rem)';

/** 지금 켠 필터 칸 — 주소의 `?kind=` 가 든다(ADR 0133). 레이아웃은 서버라 쿼리를 모르므로 여기서 읽는다 */
function useShelfKind(): ShelfKind {
  return shelfKindOf(useSearchParams().get('kind'));
}

/** 지금 글이 어디서 열렸나 — 주소의 `?from=` 과 `?kind=`(ADR 0134) */
function usePlace() {
  const params = useSearchParams();
  return placeOf({ from: params.get('from'), kind: params.get('kind') });
}

export function ReadingsFrame({
  shelves,
  nothing,
  singles,
  children,
}: {
  /** 필터 칸마다의 책장 — 서버가 넷을 다 그려 두고, 여기서는 주소가 고른 하나만 세운다 */
  shelves: Record<ShelfKind, ReactNode>;
  /** 한 권도 없을 때의 안내 — 있으면 목록 주소에서는 두 칸 대신 이것 한 장이 선다 */
  nothing: ReactNode | null;
  /** 한 사람 풀이 — DB 가 준 차례(최근 것이 먼저) */
  singles: readonly NextBook[];
  children: ReactNode;
}) {
  const segment = useSelectedLayoutSegment();
  const router = useRouter();
  const kind = useShelfKind();
  const reading = segment !== null;
  /*
    궁합 칸 · 인연 칸에는 한 사람 풀이가 안 서므로 옆 칸에 펼 것도 없다 — 그 표지들은 제 결과 화면으로 떠난다.
    사주풀이 칸에서 펼 때는 칸을 들고 간다 — 펼친 뒤에도 책장이 같은 칸에 남는다.
  */
  const openingBook = kind === 'all' || kind === 'saju' ? openingHref(singles) : null;
  const opening = openingBook === null ? null : withCameFrom(openingBook, 'shelf', kind);

  /*
    **넓은 화면에서 목록만 열면 한 권을 편다** — 내 사주풀이가 있으면 그것, 없으면 가장 최근 글(`openingHref`).
    주소를 그 글로 **바꿔 끼운다**(`replace`) — 뒤로 가기가 빈 오른쪽을 한 번 더 지나지 않는다. 폰은
    목록이 곧 첫 화면이라 옮기지 않는다.
  */
  useEffect(() => {
    if (reading || opening === null) return;
    if (window.matchMedia(TWO_COLUMNS).matches) router.replace(opening, { scroll: false });
  }, [reading, opening, router]);

  if (!reading && nothing !== null) {
    return (
      <div className="flex flex-col gap-10">
        <ShelfHead kind={null} />
        {nothing}
      </div>
    );
  }

  const index = reading ? singles.findIndex((book) => book.href === `/me/readings/${segment}`) : -1;
  const next = index === -1 || singles.length < 2 ? null : singles[(index + 1) % singles.length];

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
      <div className={`${reading ? 'hidden lg:flex' : 'flex'} min-w-0 flex-col gap-10`}>
        <ShelfHead kind={kind} />
        {shelves[kind]}
      </div>

      <div className={`${reading ? 'flex' : 'hidden lg:flex'} min-w-0 flex-col gap-8`}>
        {/* 곧 펼 글로 옮겨 갈 자리에 「표지를 누르면」을 잠깐 세우지 않는다 */}
        {reading || opening === null ? children : null}
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
  from,
  className,
  style,
  children,
}: {
  href: string;
  /** 이 표지가 선 자리 — 결과로 가는 표지에만 싣는다(ADR 0134). 보관함이면 켠 칩도 함께 든다 */
  from?: CameFrom;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const kind = useShelfKind();
  /* 결과로 가는 표지만 온 곳을 싣는다 — 만드는 자리(`/me` · `/compat`)로 가는 빈 표지는 아니다. 보관함이면 궁합도 틀 안 주소다 */
  const target = from !== undefined && resultKindOf(href) !== null ? withCameFrom(href, from, kind) : href;
  const current = isOpenResult(target, pathname, params.toString());
  return (
    <Link
      href={target}
      aria-current={current ? 'page' : undefined}
      className={`${className} ${current ? 'ring-[3px] ring-accent ring-offset-2 ring-offset-background' : ''}`}
      style={style}
    >
      {children}
    </Link>
  );
}

/**
 * 글 위의 ← — **온 곳으로 돌아간다**(ADR 0134). 나 탭에서 열었으면 「나」, 보관함에서 열었으면 들어온 칩의
 * 「풀이 보관함」, 주소를 직접 열었으면 「나」다. 보관함으로 가는 ← 는 넓은 화면에서 안 선다 — 책장이 이미 옆에 있다.
 */
export function ReadingBack({ className }: { className: string }) {
  const place = usePlace();
  const back = backOf('saju', place);
  return (
    <Link href={back.href} className={`${className} ${place.from === 'shelf' ? 'lg:hidden' : ''}`}>
      <Icon name="back" className="size-4" />
      {back.label}
    </Link>
  );
}

/** 글을 다 읽은 사람의 다음 한 권 — 책장의 차례로 다음, 끝이면 처음. 지금 글이 온 곳을 그대로 들고 간다 */
function NextCard({ book }: { book: NextBook }) {
  const place = usePlace();
  return (
    <Link
      href={place.from === null ? book.href : withCameFrom(book.href, place.from, place.shelfKind)}
      className={`${elementScope(book.element)} group flex w-full max-w-[36rem] items-center gap-4 self-center rounded-[1.5rem] border border-border bg-surface p-4 text-left transition-colors hover:border-[color-mix(in_srgb,var(--ink)_40%,transparent)] active:scale-[0.99]`}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--tile)]">
        <FaceSymbol stem={book.stem} className="size-7" />
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

/**
 * **제목과 필터 칩이 한 덩어리로 선다.** 탭 불은 나지만 나 탭 홈과 다른 화면이라 제목이 위치를 말한다(ADR 0134) — 그래서
 * 폰에서는 이 덩어리가 머리글 바로 아래에 붙어 따라 내려온다. 책장을 한참 내려도 「어디서 무엇을 보고 있나」를
 * 잃지 않는다. 넓은 화면은 책장이 한 칸이라 붙이지 않는다.
 *
 * 칩은 주소를 바꾼다(`replace`) — 칩을 누를 때마다 뒤로 가기가 쌓이지 않고, 새로고침 · 공유해도 같은 칸이 열린다.
 * 안내 한 장만 서는 빈 보관함(`kind === null`)에는 칩이 안 선다 — 가를 것이 없다.
 */
function ShelfHead({ kind }: { kind: ShelfKind | null }) {
  return (
    <header className="sticky top-16 z-30 -mx-4 flex flex-col gap-3 bg-background/90 px-4 pb-3 pt-2 backdrop-blur-xl lg:static lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      <h1 className={TYPE_TITLE}>{SHELF_TITLE}</h1>
      {kind !== null && (
        <nav aria-label="풀이 종류">
          <ul className="flex gap-2 overflow-x-auto">
            {SHELF_KINDS.map((one) => {
              const on = one === kind;
              return (
                <li key={one} className="shrink-0">
                  <Link
                    href={withShelfKind('/me/readings', one)}
                    replace
                    scroll={false}
                    aria-current={on ? 'page' : undefined}
                    className={`flex min-h-9 items-center rounded-full px-3.5 text-[14px] font-semibold transition-colors ${
                      on ? 'bg-foreground text-background' : 'bg-surface text-secondary ring-1 ring-border hover:text-foreground'
                    }`}
                  >
                    {SHELF_KIND_LABEL[one]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
