import Link from 'next/link';

import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';
import { BRANCH_INFO, ELEMENT_KO, STEM_INFO } from '@/src/lib/saju';

import { ELEMENT_TONE } from '../../../../element-tone';
import { PILLAR_COLUMNS } from '../../../../saju/shared';
import type { FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';

/**
 * 내 사주 — **얇은 띠 하나.** 이 시안에서 홈의 주인은 행동이라 명식은 표지만 선다.
 *
 * 일주 표식은 `PillarCard` 머리의 두 칸과 같은 모양이고, 여덟 글자는 `ChartSummary` 표의 차례(시 · 일 · 월 · 년)를
 * 한 줄로 눕힌 것이다. 오행은 색으로 칠하고 이름은 일주 표식의 읽는 말이 든다.
 */
export function SelfStrip({ self }: { self: FixtureSelf }) {
  const { pillars } = self.saju;
  const day = pillars.day;
  const stem = STEM_INFO[day.stem];
  const branch = BRANCH_INFO[day.branch];
  const stemTone = ELEMENT_TONE[stem.element];
  const branchTone = ELEMENT_TONE[branch.element];

  return (
    <section
      aria-label="내 사주"
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[1.75rem] border border-border bg-surface px-4 py-3 shadow-[var(--shadow-card)] sm:px-5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className="flex shrink-0 items-center gap-1"
          aria-label={`${day.ko} 일주, 천간 ${stem.ko}${ELEMENT_KO[stem.element]}, 지지 ${branch.ko}${ELEMENT_KO[branch.element]}`}
        >
          <span
            aria-hidden="true"
            className={`glyph grid size-8 place-items-center rounded-lg border text-lg font-bold ${stemTone.border} ${stemTone.surface} ${stemTone.text}`}
          >
            {day.stem}
          </span>
          <span
            aria-hidden="true"
            className={`glyph grid size-8 place-items-center rounded-lg border text-lg font-bold ${branchTone.border} ${branchTone.surface} ${branchTone.text}`}
          >
            {day.branch}
          </span>
        </div>
        <div className="min-w-0">
          <p className="eyebrow">내 사주</p>
          <p className="truncate text-base font-bold tracking-[-0.03em]">{self.label}</p>
        </div>
      </div>

      <ol aria-label="여덟 글자" className="flex shrink-0 items-center gap-1.5">
        {PILLAR_COLUMNS.map(({ key, label }) => {
          const pillar = pillars[key];
          if (pillar === null) {
            return (
              <li key={key} className="rounded-lg bg-surface-sunken px-1.5 py-1 text-[10px] text-muted">
                {HOUR_UNKNOWN_LABEL}
              </li>
            );
          }
          return (
            <li
              key={key}
              aria-label={`${label} ${pillar.name}`}
              className={`rounded-lg border px-1.5 py-0.5 ${
                key === 'day' ? 'border-accent/30 bg-accent-wash/50' : 'border-border bg-surface-soft'
              }`}
            >
              <span className={`glyph text-base font-semibold ${ELEMENT_TONE[STEM_INFO[pillar.stem].element].text}`}>
                {pillar.stem}
              </span>
              <span className={`glyph text-base font-semibold ${ELEMENT_TONE[BRANCH_INFO[pillar.branch].element].text}`}>
                {pillar.branch}
              </span>
            </li>
          );
        })}
      </ol>

      <Link
        href={previewHref(`/me/people/${self.personId}`)}
        className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent"
      >
        자세히 <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
