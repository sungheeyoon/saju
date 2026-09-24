import Link from 'next/link';

import { BRANCH_INFO, CALENDAR_KO, ELEMENTS, ELEMENT_KO, STEM_INFO, type Element, type Saju } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import { ELEMENT_TONE } from '../../../../element-tone';
import { PILLAR_COLUMNS } from '../../../../saju/shared';
import type { FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { Arrow } from './arrow';
import s from './ed.module.css';

/*
  **나 = 표지.** 여덟 글자가 표지의 큰 활자다 — 데스크톱 7.5rem, 폰 16vw(360px 에서 58px).

  1차의 요약 카드(`a1/self-summary.tsx`)는 글자를 20px 칸에 넣고 일주 표식 · 이름 · 풀이 단추 · 자세히 단추를
  같은 무게로 줄 세웠다. 여기서는 위계를 셋으로 가른다: ① 여덟 글자(잉크, 표지 크기) ② 이름과 비유 한 줄(명조)
  ③ 나머지는 12px 캡션. 글자는 오행 색을 입지 않고 잉크다 — 색은 글자 아래의 작은 칩(색 + 「목」)과 아래 오행 띠가
  든다. 색이 혼자 말하는 자리가 없다. 「○○ 일주」 이름은 세우지 않는다(사용자 요청).
*/

export function Cover({ self }: { self: FixtureSelf }) {
  const { query, saju, reading } = self;
  const born = `${query.calendar === 'solar' ? query.date : `${CALENDAR_KO[query.calendar]} ${query.date}`}${
    query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` · ${query.time}`
  }`;

  return (
    <section aria-labelledby="ed-cover-title" className="flex flex-col gap-6">
      <div className={`${s.rule} flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-3`}>
        <p className={s.caption}>내 사주</p>
        <p className={`${s.caption} tabular-nums`}>{born}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <Board saju={saju} />
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-span-5 lg:pt-8">
          <h2 id="ed-cover-title" className={s.display}>
            {self.label}의 사주팔자
          </h2>

          <div className={`${s.hair} flex flex-col gap-2 pt-4`}>
            <p className={`${s.caption} flex items-center gap-2`}>
              사주풀이
              {reading !== null && !reading.fromCurrentChart && <PriorTag />}
            </p>
            {reading === null ? (
              <p className={s.body}>기질과 삶의 흐름을 읽어보세요</p>
            ) : (
              <blockquote className={s.quote}>
                「{reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}」
              </blockquote>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={previewHref('/me/readings/self')} className={s.primary}>
              {reading === null ? '사주풀이 받기' : '사주풀이 보기'}
              <Arrow />
            </Link>
            <Link href={previewHref(`/me/people/${self.personId}`)} className={s.link}>
              사주 자세히 보기
              <Arrow />
            </Link>
          </div>
        </div>
      </div>

      <ElementBand saju={saju} />
    </section>
  );
}

/** 여덟 글자 판 — 시 · 일 · 월 · 년, 칸 사이는 머리카락 선. 일주 칸 위에만 굵은 잉크 선 */
function Board({ saju }: { saju: Saju }) {
  return (
    <ol className="grid grid-cols-4">
      {PILLAR_COLUMNS.map(({ key, label }, index) => {
        const pillar = saju.pillars[key];
        const day = key === 'day';
        return (
          <li
            key={key}
            className={`flex min-w-0 flex-col items-center gap-3 pb-2 pt-3 ${index > 0 ? 'border-l border-border-strong' : ''} ${
              day ? 'border-t-[3px] border-t-foreground' : 'border-t-[3px] border-t-transparent'
            }`}
          >
            <span className={`${s.caption} ${day ? 'text-foreground' : ''}`}>{label}</span>
            {pillar === null ? (
              <span className={`${s.blank} flex w-[78%] flex-1 items-center justify-center px-1 py-6 text-center text-xs leading-snug text-secondary`}>
                {HOUR_UNKNOWN_LABEL}
              </span>
            ) : (
              <span className="flex flex-col items-center gap-3" aria-label={`${label} ${pillar.name}`}>
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
    <span className="flex flex-col items-center gap-1.5" aria-hidden="true">
      <span className={s.cover}>{char}</span>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-secondary">
        <span className={`size-2 rounded-full ${ELEMENT_TONE[element].bar}`} />
        {ELEMENT_KO[element]}
      </span>
    </span>
  );
}

/** 오행 분포 — 다섯 칸, 개수는 큰 숫자, 아래 띠는 여덟 중 몇인가. 0 도 적는다 */
function ElementBand({ saju }: { saju: Saju }) {
  const { counts, glyphCount } = saju.analysis.elements;
  return (
    <div className={`${s.rule} flex flex-col gap-3 pt-3`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={s.caption}>오행 분포</p>
        {glyphCount !== 8 && <p className="text-xs text-secondary">출생 시각을 몰라 시주는 제외했습니다</p>}
      </div>
      <ul className="grid grid-cols-5">
        {ELEMENTS.map((element, index) => {
          const count = counts[element];
          return (
            <li key={element} className={`flex min-w-0 flex-col gap-2 px-2 sm:px-4 ${index > 0 ? 'border-l border-border-strong' : 'pl-0 sm:pl-0'}`}>
              <span className="flex items-baseline gap-1.5">
                <span className={`${s.hanja} text-lg sm:text-xl ${count === 0 ? 'text-secondary' : ELEMENT_TONE[element].text}`}>{element}</span>
                <span className="text-xs font-semibold text-secondary">{ELEMENT_KO[element]}</span>
              </span>
              <span className={`${s.figure} text-[2rem] leading-none sm:text-[2.5rem] ${count === 0 ? 'text-secondary' : ''}`}>{count}</span>
              <span aria-hidden="true" className="h-1 w-full bg-track">
                <span className={`block h-full ${ELEMENT_TONE[element].bar}`} style={{ width: `${(count / glyphCount) * 100}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PriorTag() {
  return (
    <span className="rounded-full border border-warning px-2 py-0.5 text-[11px] font-semibold tracking-normal text-warning">
      이전 명식
    </span>
  );
}

/** 등록 전 표지 — 여덟 칸은 점선으로 비어 있고, 할 일은 「내 명식 등록」 하나다 */
export function EmptyCover() {
  return (
    <section aria-labelledby="ed-cover-title" className="flex flex-col gap-6">
      <div className={`${s.rule} pt-3`}>
        <p className={s.caption}>내 사주</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
        <ol aria-hidden="true" className="grid grid-cols-4 lg:col-span-7">
          {PILLAR_COLUMNS.map(({ key, label }, index) => (
            <li key={key} className={`flex flex-col items-center gap-3 pb-2 pt-3 ${index > 0 ? 'border-l border-border-strong' : ''}`}>
              <span className={s.caption}>{label}</span>
              <span className={`${s.blank} ${s.cover} w-[78%] text-transparent`}>空</span>
              <span className={`${s.blank} ${s.cover} w-[78%] text-transparent`}>空</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-4 lg:col-span-5 lg:pt-8">
          <h2 id="ed-cover-title" className={s.display}>
            내 사주 등록
          </h2>
          <p className={s.body}>출생 정보를 입력해 주세요. 나중에 언제든 고칠 수 있고, 고치면 그때부터 새 입력으로 계산합니다.</p>
          <Link href={previewHref('/me')} className={`${s.primary} mt-2 self-start`}>
            내 명식 등록
            <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}
