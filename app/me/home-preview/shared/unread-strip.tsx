import Link from 'next/link';

import { previewHref } from './preview-href';

/** `/me` 의 `Unread` 띠 사본 — 원본은 내보내지 않는 서버 함수이고 DB 를 읽는다. 모양과 문구는 그대로다 */
export function UnreadStrip({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <Link
      href={previewHref('/me/requests')}
      className="flex items-center justify-between gap-3 rounded-2xl border border-accent bg-accent-wash px-4 py-3 text-sm font-semibold text-accent-strong hover:border-accent-strong"
    >
      <span>아직 확인하지 않은 새 소식이 있습니다.</span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="grid size-5 place-items-center rounded-full bg-fire text-[10px] font-bold text-white">
          {count}
          <span className="sr-only">건 안 읽음</span>
        </span>
        <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
