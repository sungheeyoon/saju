import Link from 'next/link';
import type { ReactNode } from 'react';

import { BRANCH_INFO, CALENDAR_KO, ELEMENTS, ELEMENT_KO, STEM_INFO, type Element, type Saju } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import { PILLAR_COLUMNS } from '../../../../saju/shared';
import type { FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { Icon } from './icons';
import s from './swiss.module.css';

/*
  **나 — 거대한 활자 블록.**

  1차의 요약 카드는 여덟 글자를 20px 칸 넷에 담았다. 여기서는 그 여덟 글자가 화면의 주인공이다 — 12열 중 8열을
  네 기둥이 차지하고, 글자는 칸 폭의 17%(최대 120px, 360px 폰에서 약 50px)로 선다. 색은 먹 하나다. 오행 색은
  글자에 칠하지 않고 아래 분포 줄의 막대와 작은 네모에만 둔다 — 글자가 크면 색 다섯이 서로 싸운다.
  일주 칸만 위 2px 강조선과 라벨 색으로 가린다(「○○ 일주」라는 이름은 안 세운다).
  오른쪽 4열은 이름 · 출생 · 사주풀이 · 행동. 주 단추는 하나(풀이), 상세는 셋째(글자 링크).
*/

const ELEMENT_VAR: Record<Element, string> = {
  木: 'var(--sw-wood)',
  火: 'var(--sw-fire)',
  土: 'var(--sw-earth)',
  金: 'var(--sw-metal)',
  水: 'var(--sw-water)',
};

export function SelfBlock({ self }: { self: FixtureSelf }) {
  const { query, saju, reading } = self;
  const birth = `${query.calendar === 'solar' ? query.date : `${CALENDAR_KO[query.calendar]} ${query.date}`}${
    query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` · ${query.time}`
  }`;

  return (
    <section aria-labelledby="sw-self" className="grid grid-cols-4 gap-x-4 gap-y-8 md:grid-cols-12 md:gap-x-6">
      <SectionIndex index="01" label="내 사주" />

      <div className="col-span-4 flex min-w-0 flex-col gap-2 md:col-span-8">
        <h2 id="sw-self" className="text-[2rem] font-bold leading-[1.1] tracking-[-0.035em] md:text-[2.5rem]">
          {self.label}
        </h2>
        <p className="text-[13px] font-medium tabular-nums text-[var(--sw-ink-3)]">{birth}</p>
      </div>

      <div className="col-span-4 min-w-0 md:col-span-8">
        <GiantChart saju={saju} />
      </div>

      <div className="col-span-4 flex min-w-0 flex-col gap-6 md:border-l md:border-[var(--sw-rule)] md:pl-6">
        <div className="flex flex-col gap-2">
          <p className={s.eyebrow}>사주풀이</p>
          {reading === null ? (
            <p className="text-[15px] leading-6 text-[var(--sw-ink-2)]">기질과 삶의 흐름을 읽어보세요</p>
          ) : (
            <>
              {!reading.fromCurrentChart && <OldChartTag />}
              <p className="text-[1.25rem] font-semibold leading-[1.45] tracking-[-0.02em]">
                {reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}
              </p>
            </>
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <Link href={previewHref('/me/readings/self')} className={`${s.primary} w-full`}>
            {reading === null ? '사주풀이 받기' : '사주풀이 보기'}
            <Icon name="arrow" />
          </Link>
          <Link href={previewHref(`/me/people/${self.personId}`)} className={s.tertiary}>
            사주 자세히 보기
            <Icon name="arrow" size={18} />
          </Link>
        </div>
      </div>

      <div className="col-span-4 md:col-span-12">
        <ElementRow saju={saju} />
      </div>
    </section>
  );
}

/** 섹션 머리 — 번호와 이름. 12열을 다 쓰는 2px 선 위에 선다 */
export function SectionIndex({ index, label, trailing }: { index: string; label: string; trailing?: ReactNode }) {
  return (
    <div className="col-span-4 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t-2 border-[var(--sw-ink)] pt-3 md:col-span-12">
      <p className={`${s.eyebrow} ${s.eyebrowInk} flex items-baseline gap-3`}>
        <span className="tabular-nums text-[var(--sw-accent)]">{index}</span>
        {label}
      </p>
      {trailing}
    </div>
  );
}

/** 네 기둥 — 시 · 일 · 월 · 년. 천간 위, 지지 아래 */
function GiantChart({ saju }: { saju: Saju }) {
  return (
    <ol className={`${s.chart} grid grid-cols-4`} aria-label="여덟 글자">
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const pillar = saju.pillars[key];
        const day = key === 'day';
        return (
          <li
            key={key}
            className={`flex min-w-0 flex-col gap-3 border-t-2 pt-3 ${
              day ? 'border-[var(--sw-accent)]' : 'border-[var(--sw-rule)]'
            } ${key === 'hour' ? '' : 'border-l border-l-[var(--sw-rule)] pl-2 sm:pl-3'}`}
          >
            <span className={`${s.eyebrow} ${day ? s.eyebrowAccent : ''}`}>{label}</span>
            {pillar === null ? (
              <span className="flex flex-col">
                <span aria-hidden="true" className={`${s.han} ${s.giant} text-[var(--sw-rule-2)]`}>
                  —
                </span>
                <span className="mt-2 text-[11px] font-medium leading-4 text-[var(--sw-ink-3)]">{HOUR_UNKNOWN_LABEL}</span>
              </span>
            ) : (
              <span className="flex flex-col" aria-label={`${label} ${pillar.name}`}>
                <span aria-hidden="true" className={`${s.han} ${s.giant}`}>
                  {pillar.stem}
                </span>
                <span aria-hidden="true" className={`${s.han} ${s.giant}`}>
                  {pillar.branch}
                </span>
                <span aria-hidden="true" className="mt-2 text-[11px] font-medium leading-4 text-[var(--sw-ink-3)]">
                  {ELEMENT_KO[STEM_INFO[pillar.stem].element]} · {ELEMENT_KO[BRANCH_INFO[pillar.branch].element]}
                </span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** 오행 분포 — 큰 숫자 다섯. 색 네모와 막대는 거들 뿐, 이름과 수가 말한다 */
function ElementRow({ saju }: { saju: Saju }) {
  const { counts, glyphCount } = saju.analysis.elements;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={s.eyebrow}>오행 분포</p>
        {glyphCount !== 8 && <p className="text-[12px] text-[var(--sw-ink-3)]">출생 시각을 몰라 시주는 제외했습니다</p>}
      </div>
      <ul className="grid grid-cols-5 border-t border-[var(--sw-rule)]">
        {ELEMENTS.map((element, index) => {
          const count = counts[element];
          return (
            <li
              key={element}
              className={`flex min-w-0 flex-col gap-2 pt-3 ${index === 0 ? '' : 'border-l border-[var(--sw-rule)] pl-2 sm:pl-4'}`}
            >
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--sw-ink-2)]">
                <span aria-hidden="true" className="size-2 shrink-0" style={{ background: ELEMENT_VAR[element] }} />
                <span className={s.han}>{element}</span>
                <span>{ELEMENT_KO[element]}</span>
              </span>
              <span
                className={`text-[2rem] font-semibold leading-none tracking-[-0.04em] tabular-nums md:text-[2.5rem] ${
                  count === 0 ? 'text-[var(--sw-ink-3)]' : ''
                }`}
              >
                {count}
              </span>
              <span aria-hidden="true" className="h-1 w-full bg-[var(--sw-rule)]">
                <span className="block h-full" style={{ width: `${(count / 8) * 100}%`, background: ELEMENT_VAR[element] }} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function OldChartTag() {
  return (
    <span className="inline-flex h-5 items-center self-start rounded-[2px] border border-[var(--sw-warn)] px-1.5 text-[11px] font-semibold text-[var(--sw-warn)]">
      이전 명식
    </span>
  );
}
