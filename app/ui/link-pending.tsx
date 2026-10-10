'use client';

import { useLinkStatus } from 'next/link';

/** 단추 안의 작은 도는 고리 — 글자 색을 따른다 */
export const LINK_PENDING_SPINNER =
  'inline-block size-4 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin motion-reduce:animate-none';

/** 카드 전체가 링크인 자리 — 카드 테두리를 따라 서는 테. 부르는 쪽이 카드의 모서리를 넘긴다 */
export const LINK_PENDING_RING = 'pointer-events-none absolute inset-0 ring-2 ring-accent animate-pulse motion-reduce:animate-none';

/**
 * **누른 링크가 아직 안 옮겼다는 표시** — 뼈대(`loading.tsx`)가 없는 동적 화면으로 가는 링크 안에 둔다.
 *
 * 뼈대가 있는 화면은 누르자마자 그 뼈대로 옮기지만, 없는 화면(ADR 0116 이 일부러 안 둔 자리 — `/me/people/[personId]`)은
 * 서버가 그 화면을 다 그릴 때까지 지금 화면에 머문다. 그동안 아무 반응이 없으면 사용자는 다시 누르거나 안 눌린 줄 안다.
 * Next 의 `useLinkStatus` 가 그 사이(`pending`)를 알려 준다 — 링크(`<Link>`)의 자손이어야 한다.
 *
 * 늘 그려 두고 투명도만 바꾼다 — 나타날 때 자리가 밀리지 않게. 빠른 이동에서 깜박이지 않게 조금 늦게 선다.
 * 보조기기에는 안 읽힌다(장식) — 이동이 끝나면 새 화면의 제목이 읽힌다.
 */
export function LinkPending({ className }: { className: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      data-link-pending={pending ? '' : undefined}
      className={`transition-opacity ${pending ? 'opacity-100 delay-150' : 'opacity-0'} ${className}`}
    />
  );
}
