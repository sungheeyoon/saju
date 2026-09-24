import type { ReactNode } from 'react';

import { BRANCH_INFO, STEM_INFO, type Saju } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import { ELEMENT_TONE } from '../../../../element-tone';
import { PILLAR_COLUMNS } from '../../../../saju/shared';

/**
 * 접힌 한 줄 — **누르면 그 자리에서 펴진다.** 페이지를 옮기지 않는다.
 *
 * 접혀 있을 때는 한 줄 카드이고, 펴지면 겉 상자가 물러나고 안의 카드(`PillarCard` · `PersonCard`)가
 * 제 모양으로 선다 — 카드 안에 카드가 겹쳐 그림자가 두 벌 서지 않게. 한 줄은 펴진 뒤에도 남아 닫는 손잡이가 된다.
 * `name` 이 같은 것끼리는 하나만 펴진다(exclusive details — NOTES 「한 번에 하나」).
 */
export function Fold({
  name,
  tone = 'plain',
  summary,
  children,
}: {
  name?: string;
  tone?: 'plain' | 'self';
  summary: ReactNode;
  children: ReactNode;
}) {
  const frame = tone === 'self' ? 'border-accent/30 bg-accent-wash/40' : 'border-border bg-surface';

  return (
    <details
      name={name}
      className={`group min-w-0 rounded-[1.75rem] border shadow-[var(--shadow-card)] open:border-transparent open:bg-transparent open:shadow-none ${frame}`}
    >
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-[1.75rem] px-4 py-3 hover:bg-surface-soft/70 group-open:mb-3 group-open:rounded-2xl group-open:bg-surface-sunken sm:px-5 [&::-webkit-details-marker]:hidden">
        {summary}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5 shrink-0 fill-none stroke-current text-muted transition-transform group-open:rotate-180"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="flex min-w-0 flex-col gap-3">{children}</div>
    </details>
  );
}

/** 여덟 글자를 한 줄로 — 시 · 일 · 월 · 년, 명식 표와 같은 차례다. 모르는 시주는 빈 칸으로 선다 */
export function EightGlyphs({ saju }: { saju: Saju }) {
  return (
    <span className="flex items-center gap-2 text-sm">
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const pillar = saju.pillars[key];
        if (pillar === null) {
          return (
            <span key={key} className="text-xs text-muted" aria-label={`${label} ${HOUR_UNKNOWN_LABEL}`}>
              <span aria-hidden="true">··</span>
            </span>
          );
        }
        const stemTone = ELEMENT_TONE[STEM_INFO[pillar.stem].element];
        const branchTone = ELEMENT_TONE[BRANCH_INFO[pillar.branch].element];
        return (
          <span
            key={key}
            aria-label={`${label} ${pillar.name}`}
            className={`glyph font-semibold ${key === 'day' ? 'rounded-md bg-accent-wash/70 px-0.5' : ''}`}
          >
            <span className={stemTone.text}>{pillar.stem}</span>
            <span className={branchTone.text}>{pillar.branch}</span>
          </span>
        );
      })}
    </span>
  );
}

/** 일간 한 글자 표식 — 사람 카드의 큰 표식을 한 줄 크기로 줄였다 */
export function DayMasterMark({ saju }: { saju: Saju }) {
  const stem = saju.pillars.dayMaster;
  const tone = ELEMENT_TONE[STEM_INFO[stem].element];
  return (
    <span
      aria-hidden="true"
      className={`glyph grid size-10 shrink-0 place-items-center rounded-xl border text-xl font-bold ${tone.border} ${tone.surface} ${tone.text}`}
    >
      {stem}
    </span>
  );
}
