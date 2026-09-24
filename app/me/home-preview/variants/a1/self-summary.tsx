import Link from 'next/link';

import { BRANCH_INFO, CALENDAR_KO, ELEMENTS, ELEMENT_KO, STEM_INFO, type Saju } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import { ELEMENT_TONE } from '../../../../element-tone';
import { PILLAR_COLUMNS } from '../../../../saju/shared';
import type { FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { CardActionIcon } from '../../shared/person-card';

/*
  **내 자리는 요약 한 장이다.**

  지금 홈은 `PillarCard` 를 통째로 편다 — 여덟 글자 표 · 오행 막대 · 출생 정보까지 폰에서 한 화면을 넘는다.
  그러면 저장한 사람들이 그 아래로 밀려 「통합 홈」이 다시 「내 사주 화면」이 된다. 여기서는 누구인가(일주 표식 ·
  이름) · 여덟 글자 한 줄 · 오행 개수 한 줄까지만 세우고, 나머지는 기존 상세와 풀이로 보낸다.
  일주 표식과 여덟 글자 칸은 `PillarCard` · `ChartSummary` 의 모양 그대로다.
*/

export function SelfSummary({ self }: { self: FixtureSelf }) {
  const { query, saju } = self;
  const dayPillar = saju.pillars.day;
  const dayStem = STEM_INFO[dayPillar.stem];
  const dayBranch = BRANCH_INFO[dayPillar.branch];
  const stemTone = ELEMENT_TONE[dayStem.element];
  const branchTone = ELEMENT_TONE[dayBranch.element];

  return (
    <section className="rounded-[1.75rem] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[minmax(0,0.85fr)_minmax(20rem,1.15fr)] md:items-center md:gap-8">
        <div className="min-w-0">
          <p className="eyebrow">내 사주</p>
          <div
            className="mt-2 flex items-center gap-1.5"
            aria-label={`${dayPillar.ko} 일주, 천간 ${dayStem.ko}${ELEMENT_KO[dayStem.element]}, 지지 ${dayBranch.ko}${ELEMENT_KO[dayBranch.element]}`}
          >
            <span className={`glyph grid size-8 place-items-center rounded-lg border text-lg font-bold ${stemTone.border} ${stemTone.surface} ${stemTone.text}`} aria-hidden="true">
              {dayPillar.stem}
            </span>
            <span className={`glyph grid size-8 place-items-center rounded-lg border text-lg font-bold ${branchTone.border} ${branchTone.surface} ${branchTone.text}`} aria-hidden="true">
              {dayPillar.branch}
            </span>
            <span className="ml-1 text-sm font-semibold text-secondary">{dayPillar.ko} 일주</span>
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-[-0.03em]">{self.label}의 사주팔자</h2>
          <p className="mt-1 text-sm text-secondary">
            {query.calendar === 'solar' ? query.date : `${CALENDAR_KO[query.calendar]} ${query.date}`}
            {query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` · ${query.time}`}
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <EightGlyphs saju={saju} />
          <ElementLine saju={saju} />
        </div>
      </div>

      <div className="grid gap-3 rounded-b-[1.75rem] border-t border-border bg-surface-soft/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4">
        <SelfReadingAction self={self} />
        <Link
          href={previewHref(`/me/people/${self.personId}`)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
        >
          사주 자세히 보기 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

/** 여덟 글자 한 줄 — `ChartSummary` 의 표를 칸 높이만 줄였다 */
function EightGlyphs({ saju }: { saju: Saju }) {
  return (
    <ol className="grid grid-cols-4 gap-1.5 text-center">
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const pillar = saju.pillars[key];
        return (
          <li key={key} className="flex min-w-0 flex-col gap-1">
            <span className={`text-[11px] font-medium ${key === 'day' ? 'text-accent' : 'text-muted'}`}>{label}</span>
            {pillar === null ? (
              <span className="grid min-h-10 place-items-center rounded-xl bg-surface-sunken px-1 text-[11px] leading-tight text-muted">
                {HOUR_UNKNOWN_LABEL}
              </span>
            ) : (
              <span
                aria-label={`${label} ${pillar.name}`}
                className={`grid min-h-10 place-items-center rounded-xl border px-1 ${
                  key === 'day' ? 'border-accent/30 bg-accent-wash/50' : 'border-border bg-surface-soft'
                }`}
              >
                <span aria-hidden="true">
                  <span className={`glyph text-xl font-semibold ${ELEMENT_TONE[STEM_INFO[pillar.stem].element].text}`}>{pillar.stem}</span>
                  <span className={`glyph text-xl font-semibold ${ELEMENT_TONE[BRANCH_INFO[pillar.branch].element].text}`}>{pillar.branch}</span>
                </span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** 오행 개수 한 줄 — `PillarCard` 의 오행 막대를 숫자만 남겨 편 것이다. 0 도 적는다 */
function ElementLine({ saju }: { saju: Saju }) {
  const { counts, glyphCount } = saju.analysis.elements;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-xs">
      <span className="font-semibold text-secondary">오행 분포</span>
      <ul className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {ELEMENTS.map((element) => {
          const count = counts[element];
          return (
            <li key={element} className="inline-flex items-baseline gap-1">
              <span className={`glyph text-sm ${count === 0 ? 'text-muted' : ELEMENT_TONE[element].text}`}>{element}</span>
              <span className="text-muted">{ELEMENT_KO[element]}</span>
              <span className={`tabular-nums ${count === 0 ? 'text-muted' : 'font-semibold'}`}>{count}</span>
            </li>
          );
        })}
      </ul>
      {glyphCount !== 8 && <span className="text-[11px] text-muted">출생 시각을 몰라 시주는 제외했습니다</span>}
    </div>
  );
}

/**
 * 내 사주풀이 — `ReadingAction` 의 모양 그대로다. 원본은 `/me/readings/<id>` 로 가는데 내 것은
 * `/me/readings/self` 라서 길만 다른 사본을 둔다.
 */
function SelfReadingAction({ self }: { self: FixtureSelf }) {
  const href = previewHref('/me/readings/self');
  const { reading } = self;

  if (reading === null) {
    return (
      <Link
        href={href}
        className="group flex min-h-[4.75rem] w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl bg-accent px-4 py-3 text-on-accent shadow-sm hover:bg-accent-strong"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/14">
          <CardActionIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">사주풀이 받기</span>
          <span className="mt-0.5 line-clamp-2 block text-xs text-on-accent/75">기질과 삶의 흐름을 읽어보세요</span>
        </span>
        <span className="shrink-0 text-sm text-on-accent/70" aria-hidden="true">→</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="group flex min-h-[4.75rem] w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-accent/25 bg-accent-wash px-4 py-3 hover:border-accent"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-accent shadow-sm">
        <CardActionIcon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-bold text-accent-strong">사주풀이 보기</span>
          {!reading.fromCurrentChart && (
            <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted">이전 명식</span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-secondary">
          {reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}
        </span>
      </span>
      <span className="shrink-0 text-sm text-accent" aria-hidden="true">→</span>
    </Link>
  );
}
