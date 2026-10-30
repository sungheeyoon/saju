/** 앱 머리 · 하단 탭을 어느 주소에 세우나 — `me/_layout.tsx` 가 여기 한 자리로 묻는다(운영자 2026-10-31) */

/** 탭의 첫 화면 넷 — 앱 머리는 여기에만 선다. 그 아래 화면의 맨 위 줄은 `ui/top-bar.tsx` 다 */
const TAB_FIRST = new Set(['/me', '/me/compat', '/me/matching', '/me/chat']);

const trimmed = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname);

/** `/me/compat` 은 한 주소가 두 걸음을 든다 — `a` · `b` 가 실리면 고르기의 아래 화면인 결과다 */
export function appHeadStands(pathname: string, params: { a?: unknown; b?: unknown } = {}): boolean {
  const path = trimmed(pathname);
  if (path === '/me/compat' && params.a !== undefined && params.b !== undefined) return false;
  return TAB_FIRST.has(path);
}

/** 대화방 하나에서는 독이 안 선다 — 폰의 방은 화면 전체다(웹의 `dockStandsOn`, PRD 「앱 내 채팅」) */
export const dockStands = (pathname: string) => !/^\/me\/chat\/[^/]+\/?$/.test(pathname);
