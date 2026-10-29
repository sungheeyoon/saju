import { CREDITS_PATH } from './buy-path';

/**
 * **결제 뒤 돌아갈 곳 — 풀이권 창을 연 화면**(운영자 결정 2026-10-29, ADR 0171 「덧」).
 *
 * 풀이를 받으려다 0개라 산 사람은 홈이 아니라 하던 화면으로 돌아간다. 풀이권 창이 지금 주소를 `?back=` 으로 싣고, 상품 화면 →
 * 결제창 → 결제 뒤 화면까지 들고 간다. 돌아간 화면에서 풀이권을 쓰는 것은 그 화면의 확인 창이 그대로 묻는다 — 산 풀이권을 곧장
 * 쓰지 않는다(쓴 풀이권은 단순 변심 환불이 안 된다, 환불정책).
 *
 * **← 는 이 표 밖으로 못 간다.** 같은 사이트의 경로이고 아래 넷 중 하나로 시작해야 한다 — 아니면 `null` 이고 화면은 지금대로
 * 「홈으로」다. 머리글 · 주소로 상품 화면을 연 사람도 그렇다.
 */
export type ReturnTo = { readonly href: string; readonly label: string };

const PLACES = [
  { path: '/me/readings', label: '사주풀이로 돌아가기' },
  { path: '/me/compat', label: '궁합풀이로 돌아가기' },
  { path: '/me/match', label: '인연 궁합으로 돌아가기' },
  { path: '/me/matching', label: '인연으로 돌아가기' },
] as const;

/** 주소의 `back` 한 값 — 배열은 첫 값, 표 밖이면 `null` */
export function returnToOf(value: string | readonly string[] | null | undefined): ReturnTo | null {
  const candidate = typeof value === 'string' ? value : value?.[0];
  if (!candidate?.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return null;

  let parsed: URL;
  try {
    parsed = new URL(candidate, 'https://local.invalid');
  } catch {
    return null;
  }
  if (parsed.origin !== 'https://local.invalid') return null;

  const place = PLACES.find(({ path }) => parsed.pathname === path || parsed.pathname.startsWith(`${path}/`));
  return place ? { href: `${parsed.pathname}${parsed.search}`, label: place.label } : null;
}

/** 돌아갈 곳을 실은 주소 — 표 밖이면 싣지 않는다 */
export function withReturnTo(path: string, back: ReturnTo | null): string {
  return back ? `${path}${path.includes('?') ? '&' : '?'}back=${encodeURIComponent(back.href)}` : path;
}

/** 풀이권 창이 보내는 상품 화면 주소 — 지금 서 있는 화면을 싣는다 */
export const creditsPathFrom = (current: string): string => withReturnTo(CREDITS_PATH, returnToOf(current));
