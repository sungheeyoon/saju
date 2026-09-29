import Link from 'next/link';

import { Icon } from '../ui/icons';
import { ROW_CARD } from '../ui/surfaces';
import type { ReadingEntry } from '../me/reading/current';

/**
 * 궁합풀이 전부 — 풀이 보관함의 궁합풀이 칸. 목록은 나 탭 소속이고, `from=compat` 이 그 목록에서 연 결과의 ← 를 궁합 탭으로
 * 돌린다(「2026-09-29 u2」). 새 주소를 만들지 않는다.
 */
export const COMPAT_SHELF_HREF = '/me/readings?kind=compat&from=compat';

/**
 * 궁합 탭의 요약 한 줄이 드는 것 — **직접 본 궁합만**의 수와 가장 최근 것 하나.
 *
 * 직접 본 궁합은 `private`(저장한 사람 · 적어 넣은 사람끼리)이다. 인연 궁합(`match`)은 인연 탭이 든다(ADR 0126 · 0130).
 * 차례는 DB 가 준 그대로(최근 것이 앞)이다. 한 편도 없으면 `null` — 줄이 안 선다.
 */
export function compatSummary(readings: readonly ReadingEntry[]): { count: number; latest: ReadingEntry } | null {
  const direct = readings.filter((entry) => entry.kind === 'private');
  const latest = direct[0];
  return latest === undefined ? null : { count: direct.length, latest };
}

/** 가장 최근 궁합의 두 사람 — 이름을 못 읽은 쪽은 비운다(목록 줄과 같다) */
export const pairOf = (entry: ReadingEntry): string => `${entry.labelA ?? ''} × ${entry.labelB ?? ''}`;

/**
 * **궁합풀이 요약 한 줄** — 이름 · 개수 · 최근 두 사람 · ›(「2026-09-29 u2」, 시안 u).
 *
 * 누르면 풀이 보관함의 궁합풀이 칸으로 간다. 한 편도 없으면 안 선다 — 바로 위의 고르는 칸이 궁합을 만드는 자리다.
 */
export function CompatSummary({ readings }: { readings: readonly ReadingEntry[] }) {
  const summary = compatSummary(readings);
  if (summary === null) return null;

  return (
    <Link
      href={COMPAT_SHELF_HREF}
      className={`${ROW_CARD} flex w-full items-center gap-3 text-left hover:bg-surface-sunken active:scale-[0.99]`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
          궁합풀이
          <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-surface-sunken px-2 py-0.5 text-[12px] font-bold tabular-nums text-secondary">
            {summary.count}
          </span>
        </span>
        <span className="block truncate text-[13px] text-secondary">최근 {pairOf(summary.latest)}</span>
      </span>
      <Icon name="arrow" className="size-4 shrink-0 text-muted" />
    </Link>
  );
}
