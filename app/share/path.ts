import { SHARE_ROOTS } from '@/src/lib/reading/share-path';

/* 주소를 짓는 일은 앱도 해서 `src/lib/reading/share-path.ts` 에 산다(앱의 「공유 링크 복사」) */
export { SHARE_ROOTS, sharePath, type ShareKind } from '@/src/lib/reading/share-path';

/** 지금 보고 있는 화면이 공유본인가 — 헤더가 묻는다 */
export function isSharePath(pathname: string): boolean {
  return Object.values(SHARE_ROOTS).some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}
