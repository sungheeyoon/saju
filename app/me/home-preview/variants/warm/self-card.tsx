import Link from 'next/link';

import { BRANCH_INFO, CALENDAR_KO, ELEMENTS, ELEMENT_PICTURE_KO, STEM_INFO, type Element, type Saju } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import { PILLAR_COLUMNS } from '../../../../saju/shared';
import type { FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { PRIMARY, SECONDARY } from './buttons';
import { rounded } from './fonts';
import { ELEMENT_CLASS, ElementSymbol, Icon } from './symbols';

/*
  **나 — 이 화면의 기준점이자 가장 큰 그림.**

  카드가 내 일간의 파스텔을 입는다(아래 사람 타일과 같은 규칙이라 「나도 이 목록의 한 색」이 된다).
  여덟 글자는 이 시안의 주인공이라 36~44px 로 세로 두 줄(천간 위 · 지지 아래)로 세운다 — 옛 명식표의 모양이다.
  글자마다 제 오행의 옅은 면을 깔아 색이 뜻을 갖고, 오행 분포 다섯 칸이 같은 색에 **이름과 상징**을 붙여 색만으로
  말하지 않는다. 「○○ 일주」 이름은 적지 않는다 — 일주 칸은 테두리로만 짚는다.
*/

export function SelfCard({ self, showMetaphor }: { self: FixtureSelf; showMetaphor: boolean }) {
  const { query, saju, reading } = self;
  const dayElement = STEM_INFO[saju.pillars.dayMaster].element;
  const readingHref = previewHref('/me/readings/self');

  return (
    <section
      aria-label="내 사주"
      className={`${ELEMENT_CLASS[dayElement]} relative overflow-hidden rounded-[2rem] bg-[var(--tile)] p-5 sm:p-8`}
    >
      <ElementSymbol element={dayElement} className="pointer-events-none absolute -right-8 -top-10 size-36 opacity-20 sm:size-52" />

      <header className="relative flex flex-col gap-1">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ink)]">
            <span className="rounded-full bg-[var(--ink)] px-2 py-0.5 text-[11px] font-bold text-[var(--tile)]">나</span>
            내 사주
          </p>
          <h2 className={`${rounded.className} mt-2 text-[2rem] leading-[1.15] tracking-[-0.02em] text-foreground sm:text-[2.5rem]`}>
            {self.label}
          </h2>
        </div>
        <p className="text-[13px] font-medium text-secondary tabular-nums">
          {query.calendar === 'solar' ? query.date : `${CALENDAR_KO[query.calendar]} ${query.date}`}
          {query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` · ${query.time}`}
        </p>
      </header>

      <div className="relative mt-6 grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-end md:gap-8">
        <Pillars saju={saju} />
        <ElementCounts saju={saju} />
      </div>

      <div className="relative mt-6 flex flex-col gap-4 border-t border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pt-5">
        {reading !== null && showMetaphor && reading.metaphor !== null && (
          <p className={`${rounded.className} text-lg leading-[1.5] text-foreground sm:text-xl`}>
            <span className="sr-only">내 사주풀이의 비유 </span>
            <span aria-hidden="true" className="text-[var(--ink)]">“</span>
            {reading.metaphor}
            <span aria-hidden="true" className="text-[var(--ink)]">”</span>
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href={readingHref} className={`${PRIMARY} sm:min-w-52`}>
            <Icon name={reading === null ? 'spark' : 'reading'} className="size-[18px]" />
            {reading === null ? '사주풀이 받기' : '사주풀이 보기'}
            {reading !== null && !reading.fromCurrentChart && (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--on-btn)_20%,transparent)] px-2 py-0.5 text-[11px]">이전 명식</span>
            )}
          </Link>
          <Link href={previewHref(`/me/people/${self.personId}`)} className={SECONDARY}>
            사주 자세히 보기
            <Icon name="arrow" className="size-4" />
          </Link>
          {reading === null && <p className="text-[13px] text-secondary sm:ml-2">기질과 삶의 흐름을 읽어보세요</p>}
        </div>
      </div>
    </section>
  );
}

/** 네 기둥 — 시 · 일 · 월 · 년, 천간이 위 지지가 아래 */
function Pillars({ saju }: { saju: Saju }) {
  return (
    <ol className="grid grid-cols-4 gap-2 sm:gap-3" aria-label="여덟 글자">
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const pillar = saju.pillars[key];
        const day = key === 'day';
        return (
          <li key={key} className="flex min-w-0 flex-col items-stretch gap-1.5">
            <span className={`text-center text-[11px] font-semibold tracking-[0.04em] ${day ? 'text-[var(--ink)]' : 'text-secondary'}`}>
              {label}
            </span>
            {pillar === null ? (
              <span className="grid min-h-[7.25rem] place-items-center rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--ink)_30%,transparent)] px-1 text-center text-[11px] leading-tight text-secondary sm:min-h-[8.5rem]">
                {HOUR_UNKNOWN_LABEL}
              </span>
            ) : (
              <span
                aria-label={`${label} ${pillar.name}`}
                className={`flex flex-col gap-1 rounded-2xl p-1 ${
                  day ? 'bg-[var(--card)] shadow-[0_6px_16px_-10px_rgba(0,0,0,0.35)] ring-2 ring-[var(--ink)]' : 'bg-[color-mix(in_srgb,var(--card)_55%,transparent)]'
                }`}
              >
                <Glyph char={pillar.stem} element={STEM_INFO[pillar.stem].element} />
                <Glyph char={pillar.branch} element={BRANCH_INFO[pillar.branch].element} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Glyph({ char, element }: { char: string; element: Element }) {
  return (
    <span
      aria-hidden="true"
      className={`${ELEMENT_CLASS[element]} glyph grid h-[3.25rem] place-items-center rounded-xl bg-[var(--tile)] text-[2.1rem] font-bold leading-none text-[var(--ink)] sm:h-16 sm:text-[2.6rem]`}
    >
      {char}
    </span>
  );
}

/** 오행 분포 — 다섯 칸, 상징 · 이름 · 개수. 0 인 칸은 점선으로 비운다 */
function ElementCounts({ saju }: { saju: Saju }) {
  const { counts, glyphCount } = saju.analysis.elements;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-semibold text-secondary">오행 분포</p>
      <ul className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {ELEMENTS.map((element) => {
          const count = counts[element];
          return (
            <li
              key={element}
              className={`${ELEMENT_CLASS[element]} flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2.5 ${
                count === 0
                  ? 'border border-dashed border-[color-mix(in_srgb,var(--foreground)_22%,transparent)] opacity-70'
                  : 'bg-[var(--card)]'
              }`}
            >
              <ElementSymbol element={element} className="size-7" />
              <span className="text-[12px] font-medium text-secondary">{ELEMENT_PICTURE_KO[element]}</span>
              <span className={`text-[1.25rem] font-bold leading-none tabular-nums ${count === 0 ? 'text-secondary' : 'text-[var(--ink)]'}`}>
                {count}
              </span>
            </li>
          );
        })}
      </ul>
      {glyphCount !== 8 && <p className="text-[12px] text-secondary">출생 시각을 몰라 시주는 제외했습니다</p>}
    </div>
  );
}
