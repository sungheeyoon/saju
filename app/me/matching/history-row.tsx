import Link from 'next/link';

import { Icon } from '../../ui/icons';
import { ROW_CARD } from '../../ui/surfaces';
import { HISTORY_HREF, type HistorySummary } from './history';

/** 개수 칩 — 요약 한 줄과 기록 화면의 절 제목이 같은 모양을 쓴다 */
export const COUNT_CHIP =
  'inline-flex min-w-7 items-center justify-center rounded-full bg-surface-sunken px-2 py-0.5 font-sans text-[12px] font-bold tabular-nums text-secondary';

/**
 * 덱 아래 **「인연 기록 N」 한 줄**(운영자 답 2026-09-29 u2, 시안 u) — 인연 궁합과 지난 요청이 여기 하나로 접힌다.
 *
 * #330 은 덱 아래에 최근 인연 궁합 표지 셋과 지난 요청 접이칸을 펼쳤다. 폰은 덱이 뷰포트에 묶여(`globals.css`) 그 둘이
 * 화면 밖에서 잘렸다. 한 줄(폰 56px)이면 덱 사진이 그만큼 줄 뿐 한 화면에 든다. 수가 0 이면 줄이 안 선다(`summary` 가 `null`).
 */
export function HistoryRow({ summary }: { summary: HistorySummary | null }) {
  if (summary === null) return null;

  return (
    <Link href={HISTORY_HREF} className={`${ROW_CARD} flex min-h-12 shrink-0 items-center gap-3 py-2! hover:border-border-strong`}>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[15px] font-semibold leading-5 text-foreground">
          인연 기록
          <span className={COUNT_CHIP}>{summary.count}</span>
        </span>
        <span className="block truncate text-[13px] leading-[18px] text-secondary">{summary.hint}</span>
      </span>
      <Icon name="chevron" className="size-4 shrink-0 text-muted" />
    </Link>
  );
}
