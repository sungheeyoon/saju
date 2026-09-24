import Link from 'next/link';

import type { ReadingEntry } from '../../reading/current';
import { readingDate, readingHref, readingTitle } from '../../reading/line';
import { previewHref } from './preview-href';

/** 풀이 목록(`/me/readings`)의 한 줄 사본 — 모양과 문구는 그대로이고 링크만 가지 않는다 */
export function ReadingRow({ entry }: { entry: ReadingEntry }) {
  return (
    <Link
      href={previewHref(readingHref(entry))}
      className="flex items-center gap-3 rounded-xl border border-border-strong bg-surface px-4 py-3 text-sm hover:border-accent hover:text-accent"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{readingTitle(entry)}</span>
        {entry.metaphor !== null && <span className="truncate text-xs font-normal text-muted">{entry.metaphor}</span>}
      </span>
      {entry.score !== null && (
        <span className="shrink-0 text-sm font-semibold tabular-nums text-accent">
          {entry.score}
          <span className="ml-0.5 text-xs font-normal text-muted">점</span>
        </span>
      )}
      {!entry.fromCurrentChart && (
        <span className="shrink-0 rounded-full bg-warning-wash px-2 py-0.5 text-[11px] font-semibold text-warning">
          이전 명식
        </span>
      )}
      <time dateTime={entry.createdAt} className="shrink-0 text-xs text-muted">
        {readingDate(entry.createdAt)}
      </time>
    </Link>
  );
}
