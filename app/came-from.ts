import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { SHELF_TITLE, shelfKindOf, withShelfKind, type ShelfKind } from './me/(shelf)/readings/kind';

/**
 * **결과 화면은 온 곳을 안다 — `?from=`**(ADR 0134).
 *
 * 결과 화면 셋(사주풀이 `/me/readings/self|[subject]` · 직접 궁합 `/me/compat?a&b` · 인연 궁합 `/me/match/[id]`)은
 * 네 탭과 보관함 · 채팅방 · 소식 여섯 자리에서 열린다. 2026-09-29 까지 ← 와 켜진 탭은 **글의 종류**로 정해졌다 —
 * 궁합 탭에서 연 궁합의 ← 가 보관함으로 갔고, 채팅방에서 연 인연 궁합의 ← 도 보관함으로 갔다. 홈 탭에서 연 사주풀이의
 * ← 는 홈을 안 거치고 보관함으로 갔다. 이제 **결과 링크가 온 곳을 싣고**, 결과 화면과 머리글이 그것을 읽는다.
 *
 * 이 파일이 그 한 벌이다 — 무슨 값이 있고(`CAME_FROM`), 각 값이 어느 탭을 켜고(`tabOf`) ← 가 어디로 무슨 이름으로
 * 가는가(`backOf`). **모르는 값 · 없음은 결과 종류의 기본**이다 — 옛 링크 · 주소를 직접 연 사람 · 손으로 고친 주소가
 * 헛길에 떨어지지 않는다.
 *
 * **← 는 이 표 밖으로 못 간다.** 값은 이름표일 뿐 주소가 아니다 — `from=https://…` 도 `from=//evil` 도 모르는 값이라
 * 기본으로 떨어진다. 가는 곳은 아래 표의 같은 사이트 경로 여섯과, 채팅방이면 **결과가 이미 든 Match id** 뿐이다.
 */
export const CAME_FROM = ['me', 'shelf', 'compat', 'matching', 'history', 'chat', 'news'] as const;
export type CameFrom = (typeof CAME_FROM)[number];

/** 결과 화면의 종류 — 사주풀이 · 직접 궁합 · 인연 궁합 */
export type ResultKind = 'saju' | 'compat' | 'match';

/** 머리글의 탭 넷 — `site-header.tsx` 의 `MEMBER_TABS` 와 같은 주소다 */
type TabHref = '/me' | '/compat' | '/me/matching' | '/me/chat';

/** 온 곳이 켜는 불 — 탭 넷 중 하나, 아니면 종(소식) */
type Light = TabHref | '/me/requests';

/** 주소의 `from` 한 값 — 배열(`?from=a&from=b`)은 첫 값, 모르는 값은 `null` */
export function cameFromOf(value: QueryValue): CameFrom | null {
  const one = firstOf(value);
  return CAME_FROM.find((known) => known === one) ?? null;
}

/** 주소 쿼리 한 칸 — Next 의 `searchParams` 는 같은 이름이 둘이면 배열을 준다 */
type QueryValue = string | readonly string[] | null | undefined;

function firstOf(value: QueryValue): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : (value[0] ?? null);
}

/** 온 곳이 없을 때 결과 종류가 켜는 탭 — 사주는 홈, 궁합은 궁합, 인연은 인연 */
const DEFAULT_TAB: Record<ResultKind, TabHref> = {
  saju: '/me',
  compat: '/compat',
  match: '/me/matching',
};

const LIGHT_OF: Record<CameFrom, Light> = {
  me: '/me',
  shelf: '/me',
  compat: '/compat',
  matching: '/me/matching',
  history: '/me/matching',
  chat: '/me/chat',
  news: '/me/requests',
};

/**
 * 결과 화면이 켜는 불 — 온 곳이 있으면 그 자리, 없으면 결과 종류의 탭.
 *
 * **인연 궁합은 온 곳과 상관없이 늘 「인연」이다**(ADR 0134 덧붙임) — 화면은 제가 무엇인지의 탭을 켠다(ADR 0126). 온 곳마다
 * 다른 탭을 켜면 같은 글이 여러 이름으로 읽힌다. ← 는 그대로 온 곳으로 간다(`backOf`).
 */
export function lightOf(kind: ResultKind, from: CameFrom | null): Light {
  if (kind === 'match') return DEFAULT_TAB.match;
  return from === null ? DEFAULT_TAB[kind] : LIGHT_OF[from];
}

/**
 * 궁합 두 갈래의 **보관함 안 주소** — 사주풀이처럼 책장 옆 칸에 선다(ADR 0134, 2026-09-29 운영자). 틀 밖 주소
 * (`/me/compat` · `/me/match/[id]`)는 궁합 탭 · 인연 기록 · 채팅 · 소식이 그대로 쓴다. 두 주소가 같은 결과 부품을 그린다.
 */
const SHELF_COMPAT = '/me/readings/compat';
const SHELF_MATCH = '/me/readings/match/';

/** 이 주소가 결과 화면이면 그 종류 — 보관함 목록(`/me/readings`) 자체는 결과가 아니다 */
export function resultKindOf(address: string): ResultKind | null {
  const pathname = address.split(/[?#]/, 1)[0];
  if (pathname === '/me/compat' || pathname === SHELF_COMPAT) return 'compat';
  /* 틀 안 인연 궁합은 id 가 있어야 결과다 — `/me/readings/match` 를 사주풀이 id 로 읽지 않는다 */
  if (`${pathname}/`.startsWith(SHELF_MATCH)) return pathname.length > SHELF_MATCH.length ? 'match' : null;
  if (pathname.startsWith('/me/readings/') && pathname.length > '/me/readings/'.length) return 'saju';
  if (pathname.startsWith('/me/match/') && pathname.length > '/me/match/'.length) return 'match';
  return null;
}

/** 보관함 틀 안의 궁합 주소인가 — 그 자리는 온 곳이 없어도 보관함이다(주소가 곧 온 곳이다) */
function withinShelf(pathname: string): boolean {
  return pathname === SHELF_COMPAT || pathname.startsWith(SHELF_MATCH);
}

/** 궁합 결과 주소를 보관함 틀 안으로 옮긴다 — 사주풀이 · 이미 틀 안인 주소 · 결과가 아닌 주소는 그대로다 */
function intoShelf(href: string): string {
  if (href === '/me/compat' || href.startsWith('/me/compat?')) return `${SHELF_COMPAT}${href.slice('/me/compat'.length)}`;
  if (href.startsWith('/me/match/')) return `${SHELF_MATCH}${href.slice('/me/match/'.length)}`;
  return href;
}

export type Back = { readonly href: string; readonly label: string };

/**
 * ← 가 가는 곳과 그 이름 — **가는 곳의 이름**이다(「돌아가기」가 아니다). 폰에서 이 글자가 곧 「어디로 돌아가나」다.
 *
 * - `shelf` 는 들어온 칩(`kind`)을 들고 돌아간다 — 궁합풀이 칸에서 연 글의 ← 는 궁합풀이 칸이다.
 * - `chat` 은 인연 궁합이면 **그 Match 의 방**으로 간다 — 방의 주소가 곧 Match id 라 따로 싣지 않는다. 다른 결과면 목록.
 */
export function backOf(
  kind: ResultKind,
  place: { from: CameFrom | null; shelfKind?: ShelfKind; matchId?: string },
): Back {
  switch (place.from) {
    case 'me':
      return { href: '/me', label: '홈' };
    case 'shelf':
      return { href: withShelfKind('/me/readings', place.shelfKind ?? 'all'), label: SHELF_TITLE };
    case 'compat':
      return { href: '/compat', label: '궁합' };
    case 'matching':
      return { href: '/me/matching', label: '인연' };
    case 'history':
      return { href: '/me/matching/history', label: '인연 기록' };
    case 'chat':
      /* 방이든 목록이든 이름은 「채팅」이다 — 인연 궁합 화면 아래의 방으로 가는 단추와 한 이름(docs/context/copy.md §8 「한 화면 한 이름」) */
      return kind === 'match' && place.matchId !== undefined
        ? { href: `/me/chat/${place.matchId}`, label: CHAT_TAB_LABEL }
        : { href: '/me/chat', label: CHAT_TAB_LABEL };
    case 'news':
      return { href: '/me/requests', label: '소식' };
    case null:
      return DEFAULT_BACK[kind];
  }
}

/** 주소를 직접 연 결과의 ← — 그 종류의 탭 첫 화면 */
const DEFAULT_BACK: Record<ResultKind, Back> = {
  saju: { href: '/me', label: '홈' },
  compat: { href: '/compat', label: '궁합' },
  match: { href: '/me/matching', label: '인연' },
};

/**
 * 결과 링크에 온 곳을 싣는다. 보관함이면 칩(`kind`)도 함께 싣는다 — 전체 칩은 안 싣는다(`withShelfKind` 와 같은 결).
 * 이미 쿼리가 있는 주소(`/me/compat?a=…&b=…`)에는 `&` 로 잇는다.
 *
 * **보관함에서 여는 궁합은 보관함 틀 안의 주소로 간다** — 사주풀이와 같은 칸에 서게(2026-09-29 운영자). 표지가 어느
 * 주소를 들든 여기 한 자리에서 옮긴다.
 */
export function withCameFrom(href: string, from: CameFrom, shelfKind: ShelfKind = 'all'): string {
  /* 이미 온 곳을 든 주소는 그대로다 — 먼저 실은 자리가 이긴다(홈 탭의 `withFromMe` 가 싣고 `CoverLink` 를 지난다) */
  if (/[?&]from=/.test(href)) return href;
  const query = new URLSearchParams();
  if (from === 'shelf' && shelfKind !== 'all') query.set('kind', shelfKind);
  query.set('from', from);
  const target = from === 'shelf' ? intoShelf(href) : href;
  return `${target}${target.includes('?') ? '&' : '?'}${query.toString()}`;
}

/**
 * 결과 화면이 제 주소에서 읽는 두 값 — `kind` 는 보관함에서 왔을 때만 뜻이 있다. 보관함 틀 안의 궁합 주소는 온 곳이
 * 없어도 보관함이다 — 그 주소는 보관함만 연다.
 */
export function placeOf(
  params: { from?: QueryValue; kind?: QueryValue },
  pathname?: string,
): { from: CameFrom | null; shelfKind: ShelfKind } {
  const from = cameFromOf(params.from) ?? (pathname !== undefined && withinShelf(pathname) ? 'shelf' : null);
  return { from, shelfKind: shelfKindOf(firstOf(params.kind)) };
}

/**
 * 이 링크가 **지금 펼친 글**인가 — 책장의 표지 테가 읽는다. 온 곳 · 칩은 안 본다(같은 글이다). 궁합은 두 사람(`a` · `b`)까지 같아야 한다.
 */
export function isOpenResult(link: string, pathname: string, search: string): boolean {
  const url = new URL(link, 'https://x.invalid');
  if (url.pathname !== pathname) return false;
  const here = new URLSearchParams(search);
  return ['a', 'b'].every((name) => url.searchParams.get(name) === here.get(name));
}
