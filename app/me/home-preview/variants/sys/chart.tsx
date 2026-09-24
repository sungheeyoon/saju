import { BRANCH_INFO, ELEMENTS, ELEMENT_KO, STEM_INFO, type Element, type Saju } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import { PILLAR_COLUMNS } from '../../../../saju/shared';
import { TYPE, TONE } from './ui';

/*
  **명식을 그리는 부품 셋** — 큰 명식(내 카드) · 한 줄 명식(사람 줄) · 일간 타일, 그리고 오행 막대.

  지금 `PillarCard` · `ChartSummary` 는 여덟 글자를 **가로 둘씩** 20~24px 로 적는다. 천간이 위, 지지가 아래인
  원래의 세로 명식을 44/52px 로 세우면 이 화면에서 가장 먼저 읽히는 것이 된다. 오행 색은 색만으로 말하지 않게
  글자 아래 한글 이름(목 · 화 …)을 12px 로 붙인다.
*/

/** 오행 글자색 — `ELEMENT_TONE.text` 대신 대비를 보정한 값(`sys.module.css`). 바탕은 원래 토큰을 쓴다 */
export const INK: Record<Element, string> = {
  木: 'text-[var(--sys-wood)]',
  火: 'text-[var(--sys-fire)]',
  土: 'text-[var(--sys-earth)]',
  金: 'text-[var(--sys-metal)]',
  水: 'text-[var(--sys-water)]',
};

const BAR: Record<Element, string> = {
  木: 'bg-[var(--sys-wood)]',
  火: 'bg-[var(--sys-fire)]',
  土: 'bg-[var(--sys-earth)]',
  金: 'bg-[var(--sys-metal)]',
  水: 'bg-[var(--sys-water)]',
};

const SOFT: Record<Element, string> = {
  木: 'bg-wood-soft',
  火: 'bg-fire-soft',
  土: 'bg-earth-soft',
  金: 'bg-metal-soft',
  水: 'bg-water-soft',
};

/** 큰 명식 — 네 기둥이 세로로 선다. 일주 칸만 초록 바탕 */
export function PillarGrid({ saju, name, className = '' }: { saju: Saju; name: string; className?: string }) {
  return (
    <ol aria-label={`${name}의 네 기둥`} className={`grid grid-cols-4 gap-2 sm:gap-3 ${className}`}>
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const pillar = saju.pillars[key];
        const day = key === 'day';
        return (
          <li
            key={key}
            className={`flex min-w-0 flex-col items-center gap-2 rounded-2xl px-1 pb-3 pt-2.5 sm:gap-3 sm:pb-4 sm:pt-3 ${
              day ? 'bg-accent-wash ring-1 ring-inset ring-[color-mix(in_srgb,var(--accent)_30%,transparent)]' : 'bg-surface-soft'
            }`}
          >
            <span className={`${TYPE.label} ${day ? TONE.accent : TONE.muted}`}>{label}</span>
            {pillar === null ? (
              <span className="flex flex-1 flex-col items-center justify-center gap-1 py-2">
                <span aria-hidden="true" className={`${TYPE.display} ${TONE.muted} opacity-40`}>
                  ·
                </span>
                <span className={`${TYPE.label} ${TONE.muted} text-center`}>{HOUR_UNKNOWN_LABEL}</span>
              </span>
            ) : (
              <>
                <span aria-label={`${label} ${pillar.name}`} className="flex flex-col items-center gap-1.5 sm:gap-2">
                  <span aria-hidden="true" className={`${TYPE.display} ${INK[STEM_INFO[pillar.stem].element]}`}>
                    {pillar.stem}
                  </span>
                  <span aria-hidden="true" className={`${TYPE.display} ${INK[BRANCH_INFO[pillar.branch].element]}`}>
                    {pillar.branch}
                  </span>
                </span>
                <span aria-hidden="true" className={`${TYPE.label} ${TONE.muted}`}>
                  {ELEMENT_KO[STEM_INFO[pillar.stem].element]} · {ELEMENT_KO[BRANCH_INFO[pillar.branch].element]}
                </span>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** 오행 분포 — 한 줄 막대(칸 = 글자 하나) + 이름 · 개수. 0 도 적는다 */
export function ElementBar({ saju, className = '' }: { saju: Saju; className?: string }) {
  const { counts, glyphCount } = saju.analysis.elements;
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`${TYPE.label} ${TONE.secondary}`}>오행 분포</span>
        {glyphCount !== 8 && <span className={`${TYPE.caption} ${TONE.muted} text-right`}>출생 시각을 몰라 시주는 제외했습니다</span>}
      </div>
      <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {ELEMENTS.flatMap((element) =>
          Array.from({ length: counts[element] }, (_, index) => (
            <span key={`${element}-${index}`} className={`flex-1 ${BAR[element]}`} />
          )),
        )}
      </div>
      <ul className="grid grid-cols-5 gap-1">
        {ELEMENTS.map((element) => {
          const count = counts[element];
          const none = count === 0;
          return (
            <li key={element} className="flex min-w-0 items-baseline justify-center gap-1">
              <span className={`glyph text-[0.9375rem] font-semibold ${none ? `${TONE.muted} opacity-60` : INK[element]}`}>
                {element}
              </span>
              <span className={`${TYPE.caption} ${TONE.secondary}`}>{ELEMENT_KO[element]}</span>
              <span className={`${TYPE.caption} tabular-nums ${none ? TONE.muted : 'font-bold'}`}>{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 한 줄 명식 — 사람 줄의 여덟 글자. 본문 크기(15)이고 일주만 옅은 초록 */
export function GlyphLine({ saju, name }: { saju: Saju; name: string }) {
  return (
    <span aria-label={`${name}의 네 기둥`} className="flex items-center gap-1">
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const pillar = saju.pillars[key];
        if (pillar === null) {
          return (
            <span key={key} className={`glyph w-[2.4em] text-center text-[0.9375rem] ${TONE.muted}`}>
              <span aria-hidden="true">··</span>
              <span className="sr-only">{HOUR_UNKNOWN_LABEL}</span>
            </span>
          );
        }
        return (
          <span
            key={key}
            className={`glyph rounded-md px-1 text-[0.9375rem] font-semibold leading-6 ${key === 'day' ? 'bg-accent-wash' : ''}`}
          >
            <span className="sr-only">{label} </span>
            <span className={INK[STEM_INFO[pillar.stem].element]}>{pillar.stem}</span>
            <span className={INK[BRANCH_INFO[pillar.branch].element]}>{pillar.branch}</span>
          </span>
        );
      })}
    </span>
  );
}

/** 일간 타일 — 44 정사각. 그 사람을 알아보는 첫 단서 */
export function DayTile({ saju }: { saju: Saju | null }) {
  if (saju === null) {
    return (
      <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-sunken ${TYPE.heading} ${TONE.muted}`}>
        ?
      </span>
    );
  }
  const { dayMaster } = saju.pillars;
  const info = STEM_INFO[dayMaster];
  return (
    <span
      role="img"
      aria-label={`일간 ${dayMaster}, ${info.ko}${ELEMENT_KO[info.element]}`}
      className={`grid size-11 shrink-0 place-items-center rounded-2xl ${SOFT[info.element]}`}
    >
      <span aria-hidden="true" className={`glyph text-[1.375rem] font-bold leading-none ${INK[info.element]}`}>
        {dayMaster}
      </span>
    </span>
  );
}
