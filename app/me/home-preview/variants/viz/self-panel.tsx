import Link from 'next/link';

import { BRANCH_INFO, CALENDAR_KO, ELEMENT_KO, STEM_INFO, type Saju } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import { ELEMENT_TONE } from '../../../../element-tone';
import { PILLAR_COLUMNS } from '../../../../saju/shared';
import type { FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { SelfBars } from './element-chart';
import { Icon, PRIMARY, SECONDARY } from './ui';
import styles from './viz.module.css';

/*
  **나 — 기준점.** 이 화면에서 가장 먼저 읽히는 것은 여덟 글자다(명조 44px). 두 번째가 오행 개수(24px 숫자),
  세 번째가 이름. 「○○ 일주」 이름표는 세우지 않는다 — 일주 칸은 옅은 바탕 하나로만 표시한다.

  글자는 세로로 선다: 천간이 위, 지지가 아래. 만세력이 적는 차례 그대로라 사주를 아는 사람의 눈이 헤매지 않고,
  한 글자마다 아래에 「갑목」처럼 읽는 소리와 오행을 붙인다 — 색만으로 말하지 않는다.
*/

export function SelfPanel({ self, max }: { self: FixtureSelf; max: number }) {
  const { query, saju } = self;
  const { counts, glyphCount } = saju.analysis.elements;

  return (
    <section aria-labelledby="viz-self" className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-6">
          <header className="flex flex-col gap-1">
            <p className="text-[12px] font-semibold tracking-[0.04em] text-accent">내 사주</p>
            <h2 id="viz-self" className="text-2xl font-bold tracking-[-0.03em]">
              {self.label}
            </h2>
            <p className="text-[13px] tabular-nums text-secondary">
              {query.calendar === 'solar' ? query.date : `${CALENDAR_KO[query.calendar]} ${query.date}`}
              {query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` · ${query.time}`}
            </p>
          </header>
          <Pillars saju={saju} />
        </div>

        <div className="flex min-w-0 flex-col gap-4 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
          <h3 className="text-[13px] font-semibold text-secondary">오행 분포</h3>
          <SelfBars counts={counts} max={max} glyphCount={glyphCount} />
          {glyphCount !== 8 && <p className="text-[12px] text-muted">출생 시각을 몰라 시주는 제외했습니다</p>}
        </div>
      </div>

      <ReadingBand self={self} />
    </section>
  );
}

/** 네 기둥 — 시 · 일 · 월 · 년, 천간 위 · 지지 아래 */
function Pillars({ saju }: { saju: Saju }) {
  return (
    <ol className="grid grid-cols-4 gap-1 sm:gap-2" aria-label="여덟 글자">
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const pillar = saju.pillars[key];
        const day = key === 'day';
        return (
          <li
            key={key}
            className={`flex min-w-0 flex-col items-center gap-3 rounded-xl py-3 ${day ? 'bg-accent-wash/70' : ''}`}
          >
            <span className={`text-[12px] font-semibold ${day ? 'text-accent' : 'text-muted'}`}>{label}</span>
            {pillar === null ? (
              <span className="flex min-h-[7.5rem] flex-col items-center justify-center gap-1 text-center">
                <span aria-hidden="true" className={`${styles.glyph} text-[2.25rem] leading-none text-muted sm:text-[2.75rem] lg:text-[3.5rem]`}>
                  ··
                </span>
                <span className="text-[11px] leading-tight text-muted">{HOUR_UNKNOWN_LABEL}</span>
              </span>
            ) : (
              <>
                <Glyph char={pillar.stem} sound={STEM_INFO[pillar.stem].ko} element={STEM_INFO[pillar.stem].element} />
                <Glyph
                  char={pillar.branch}
                  sound={BRANCH_INFO[pillar.branch].ko}
                  element={BRANCH_INFO[pillar.branch].element}
                />
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Glyph({ char, sound, element }: { char: string; sound: string; element: keyof typeof ELEMENT_TONE }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span aria-hidden="true" className={`${styles.glyph} text-[2.25rem] leading-none sm:text-[2.75rem] lg:text-[3.5rem] ${ELEMENT_TONE[element].text}`}>
        {char}
      </span>
      <span className="text-[11px] font-medium text-secondary">
        <span className="sr-only">{char} </span>
        {sound}
        {ELEMENT_KO[element]}
      </span>
    </span>
  );
}

/** 사주풀이 — 비유 한 줄이 인용처럼 서고, 단추는 오른쪽에 주 하나 · 보조 하나 */
function ReadingBand({ self }: { self: FixtureSelf }) {
  const { reading } = self;
  return (
    <div className="flex flex-col gap-4 border-t border-border bg-surface-soft/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-8">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[12px] font-semibold text-muted">
          사주풀이
          {reading !== null && !reading.fromCurrentChart && (
            <span className="rounded-md bg-warning-wash px-1.5 py-0.5 text-[11px] font-semibold text-warning">이전 명식</span>
          )}
        </p>
        <p className="mt-1 text-[15px] font-medium leading-snug text-foreground">
          {reading === null
            ? '기질과 삶의 흐름을 읽어보세요'
            : (reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요')}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row-reverse sm:items-center">
        <Link href={previewHref('/me/readings/self')} className={PRIMARY}>
          {reading === null ? '사주풀이 받기' : '사주풀이 보기'}
          <Icon name="arrow" className="size-4" />
        </Link>
        <Link href={previewHref(`/me/people/${self.personId}`)} className={SECONDARY}>
          사주 자세히 보기
        </Link>
      </div>
    </div>
  );
}

/** 내 사주 전 — 할 일이 이것 하나라 채운 단추 하나만 선다 */
export function RegisterSelf() {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div className="flex max-w-xl flex-col gap-1">
        <p className="text-[12px] font-semibold tracking-[0.04em] text-accent">내 사주</p>
        <h2 className="text-2xl font-bold tracking-[-0.03em]">내 사주 등록</h2>
        <p className="text-sm leading-relaxed text-secondary">
          출생 정보를 입력해 주세요. 나중에 언제든 고칠 수 있고, 고치면 그때부터 새 입력으로 계산합니다.
        </p>
      </div>
      <Link href={previewHref('/me')} className={`${PRIMARY} shrink-0`}>
        내 명식 등록
        <Icon name="arrow" className="size-4" />
      </Link>
    </section>
  );
}
