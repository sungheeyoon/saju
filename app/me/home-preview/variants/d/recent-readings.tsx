import Link from 'next/link';

import { READING_NOUN } from '@/src/lib/reading';

import type { ReadingEntry } from '../../../reading/current';
import { readingDate, readingHref, readingTitle } from '../../../reading/line';
import { previewHref } from '../../shared/preview-href';
import { ReadingRow } from '../../shared/reading-row';

/*
  **이 시안의 주인공** — 돌아온 사람이 읽던 글을 이어 읽는다.
  가장 최근 하나는 비유를 크게 세운 카드로, 그 다음 셋은 풀이 목록의 줄 그대로 선다.
  본문은 안 싣는다 — 비유 한 줄과 가는 길뿐이다(ADR 0033 의 결).
*/

const ROWS_AFTER_FEATURED = 3;

export function RecentReadings({ readings }: { readings: readonly ReadingEntry[] }) {
  const [featured, ...rest] = readings;
  if (featured === undefined) return null;

  return (
    <section aria-labelledby="d-recent" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 id="d-recent" className="text-base font-semibold">
          최근 풀이
        </h2>
        <Link
          href={previewHref('/me/readings')}
          className="shrink-0 text-sm font-semibold text-accent hover:text-accent-strong"
        >
          풀이 전체 보기 <span aria-hidden="true">→</span>
        </Link>
      </div>

      <FeaturedReading entry={featured} />

      {rest.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rest.slice(0, ROWS_AFTER_FEATURED).map((entry) => (
            <li key={`${entry.kind}:${entry.matchId ?? entry.personA ?? 'me'}:${entry.personB ?? ''}`}>
              <ReadingRow entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 가장 최근 글 — 카드 전체가 그 글로 가는 길이다 */
function FeaturedReading({ entry }: { entry: ReadingEntry }) {
  const noun = READING_NOUN[entry.kind];

  return (
    <Link
      href={previewHref(readingHref(entry))}
      className="group flex flex-col gap-4 rounded-[1.75rem] border border-accent/25 bg-accent-wash p-5 shadow-[var(--shadow-card)] hover:border-accent sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="eyebrow">이어 읽기</p>
        <span className="text-xs text-muted">·</span>
        <time dateTime={entry.createdAt} className="text-xs text-muted">
          {readingDate(entry.createdAt)}
        </time>
        {!entry.fromCurrentChart && (
          <span className="rounded-full bg-warning-wash px-2 py-0.5 text-[11px] font-semibold text-warning">
            이전 명식
          </span>
        )}
      </div>

      <div className="min-w-0">
        <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-accent-strong">
          <span className="min-w-0 break-all">{readingTitle(entry)}</span>
          {entry.score !== null && (
            <span className="tabular-nums text-accent">
              {entry.score}
              <span className="ml-0.5 text-xs font-normal text-muted">점</span>
            </span>
          )}
        </h3>
        {entry.metaphor !== null ? (
          <p className="mt-2 break-keep text-xl font-bold leading-snug tracking-[-0.03em] sm:text-2xl">
            {entry.metaphor}
          </p>
        ) : (
          <p className="mt-2 text-base text-secondary">만들어 둔 풀이를 이어서 읽어보세요</p>
        )}
      </div>

      <span className="inline-flex min-h-10 items-center gap-2 self-start rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent group-hover:bg-accent-strong">
        {noun} 보기 <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
