import Link from 'next/link';

import { BRANCH_INFO, CALENDAR_KO, ELEMENTS, ELEMENT_KO, STEM_INFO, type Saju } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import { PILLAR_COLUMNS } from '../../../../saju/shared';
import type { FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { InkIcon } from './icons';
import s from './ink.module.css';

/*
  **나 — 세로로 선 네 기둥이 이 화면의 주인공이다.**

  1차의 여덟 글자는 20px 칸 여덟 개였다. 여기서는 기둥 하나를 세로 쓰기로 세우고(천간 위 · 지지 아래)
  글자를 폰 44px · 넓은 화면 68px 로 키운다. 기둥 사이는 괘선이고, 일주 기둥만 주칠 테가 두른다 — 명식을
  한지에 세로로 적어 둔 모양이다. 읽는 차례는 오른쪽의 년주부터 왼쪽의 시주로, 세로쓰기의 결과 같다.

  오행은 색이 아니라 글자다. 기둥 아래 한자 둘, 분포는 한자 · 한글 · 개수 · 먹 점.
  주 단추는 사주풀이 하나(주칠), 사주 자세히 보기는 먹 테두리다.
*/

export function SelfPlate({ self }: { self: FixtureSelf }) {
  const { query, saju, reading } = self;
  const birth = `${query.calendar === 'solar' ? query.date : `${CALENDAR_KO[query.calendar]} ${query.date}`}${
    query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` · ${query.time}`
  }`;

  return (
    <section
      aria-label="내 사주"
      className="grid gap-8 border-y-[1.5px] border-(--ink) py-6 sm:py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] md:gap-10"
    >
      {/* 이름 · 풀이 · 행동 — 폰에서는 기둥 아래로 간다 */}
      <div className="order-2 flex min-w-0 flex-col gap-6 md:order-1">
        <header className="flex items-start gap-3">
          <span className={`${s.seal} ${s.title} size-11 text-xl font-bold`} aria-hidden="true">
            나
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-(--ink-3)">내 사주</p>
            <h3 className={`${s.title} truncate text-[2.25rem] font-bold leading-[1.15]`}>{self.label}</h3>
            <p className="mt-1 text-[13px] tabular-nums text-(--ink-3)">{birth}</p>
          </div>
        </header>

        {reading === null ? (
          <div className="flex flex-col gap-3">
            <p className="text-[15px] leading-6 text-(--ink-2)">기질과 삶의 흐름을 읽어보세요</p>
            <Actions primary="사주풀이 받기" personId={self.personId} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <figure className="border-l-[3px] border-(--shu) pl-4">
              <figcaption className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-(--ink-3)">
                사주풀이
                {!reading.fromCurrentChart && <OldChartTag />}
              </figcaption>
              <blockquote className={`${s.title} mt-1.5 text-[1.25rem] leading-[1.55] text-(--ink)`}>
                {reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}
              </blockquote>
            </figure>
            <Actions primary="사주풀이 보기" personId={self.personId} />
          </div>
        )}
      </div>

      <div className="order-1 flex min-w-0 flex-col gap-5 md:order-2">
        <Pillars saju={saju} />
        <ElementCounts saju={saju} />
      </div>
    </section>
  );
}

function Actions({ primary, personId }: { primary: string; personId: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={previewHref('/me/readings/self')} className={`${s.btn} ${s.primary} grow sm:grow-0`}>
        {primary}
        <InkIcon name="arrow" className="size-4" />
      </Link>
      <Link href={previewHref(`/me/people/${personId}`)} className={`${s.btn} ${s.secondary} grow sm:grow-0`}>
        사주 자세히 보기
      </Link>
    </div>
  );
}

export function OldChartTag() {
  return (
    <span className="inline-flex h-5 items-center border border-(--rule-strong) px-1.5 text-[11px] font-semibold tracking-normal text-(--ink-2)">
      이전 명식
    </span>
  );
}

/** 네 기둥 — 시 · 일 · 월 · 년이 왼쪽에서 오른쪽. 기둥마다 세로 쓰기 */
function Pillars({ saju }: { saju: Saju }) {
  return (
    <ol className="grid grid-cols-4 border-x border-(--rule)" aria-label="네 기둥">
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const pillar = saju.pillars[key];
        const day = key === 'day';
        return (
          <li
            key={key}
            className={`relative flex min-w-0 flex-col items-center gap-3 py-4 ${
              day ? 'z-[1] outline-[1.5px] outline-(--shu) outline -outline-offset-[0.75px] bg-(--shu-wash)' : ''
            } ${key !== 'hour' ? 'border-l border-(--rule)' : ''}`}
          >
            <span className={`text-xs font-semibold ${day ? 'text-(--shu)' : 'text-(--ink-3)'}`}>{label}</span>
            {pillar === null ? (
              <span className="grid h-[6.25rem] w-11 place-items-center border border-dashed border-(--rule-strong) px-1 text-center text-[11px] leading-tight text-(--ink-3) sm:h-[8.5rem] lg:h-[9.5rem]">
                {HOUR_UNKNOWN_LABEL}
              </span>
            ) : (
              <span
                aria-label={`${label} ${pillar.name}`}
                className={`${s.hanja} ${s.vertical} text-[2.75rem] font-black leading-[1.12] sm:text-[3.75rem] lg:text-[4.25rem]`}
              >
                <span aria-hidden="true">{pillar.name}</span>
              </span>
            )}
            <span className="flex h-4 items-center gap-1.5 text-xs text-(--ink-3)">
              {pillar !== null && (
                <>
                  <ElementGlyph element={STEM_INFO[pillar.stem].element} />
                  <span aria-hidden="true" className="text-(--rule-strong)">·</span>
                  <ElementGlyph element={BRANCH_INFO[pillar.branch].element} />
                </>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ElementGlyph({ element }: { element: (typeof ELEMENTS)[number] }) {
  return (
    <span>
      <span className={s.hanja} aria-hidden="true">
        {element}
      </span>
      <span className="sr-only">{ELEMENT_KO[element]}</span>
    </span>
  );
}

/** 오행 분포 — 다섯 칸. 한자 · 한글 · 개수, 개수만큼 먹 점. 0 도 적는다 */
function ElementCounts({ saju }: { saju: Saju }) {
  const { counts, glyphCount } = saju.analysis.elements;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-(--ink-3)">오행 분포</p>
      <ul className="grid grid-cols-5 border-t border-(--rule)">
        {ELEMENTS.map((element) => {
          const count = counts[element];
          const none = count === 0;
          return (
            <li
              key={element}
              className={`flex min-w-0 flex-col gap-1 pt-2.5 ${element !== '木' ? 'border-l border-(--rule) pl-2.5 sm:pl-3' : ''}`}
            >
              <span className="flex items-baseline gap-1">
                <span className={`${s.hanja} text-xl font-bold leading-none ${none ? 'text-(--ink-3)' : ''}`}>{element}</span>
                <span className="text-xs text-(--ink-3)">{ELEMENT_KO[element]}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className={`text-lg leading-none tabular-nums ${none ? 'text-(--ink-3)' : 'font-bold'}`}>{count}</span>
                <span aria-hidden="true" className="flex flex-wrap gap-[3px]">
                  {none ? (
                    <span className="size-2 border border-(--rule-strong)" />
                  ) : (
                    Array.from({ length: count }, (_, i) => <span key={i} className="size-2 bg-(--ink)" />)
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {glyphCount !== 8 && <p className="text-xs text-(--ink-3)">출생 시각을 몰라 시주는 제외했습니다</p>}
    </div>
  );
}

/**
 * 내 사주 전 — 네 기둥 자리를 빈 괘선으로 먼저 세운다. 할 일이 하나라 주칠 단추 하나만 선다.
 */
export function EmptyPlate() {
  return (
    <section
      aria-label="내 사주"
      className="grid gap-8 border-y-[1.5px] border-(--ink) py-6 sm:py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] md:gap-10"
    >
      <div className="order-2 flex min-w-0 flex-col gap-5 md:order-1">
        <header className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-(--ink-3)">내 사주</p>
          <h3 className={`${s.title} text-[2.25rem] font-bold leading-[1.15]`}>내 사주 등록</h3>
          <p className="mt-1 max-w-[34rem] text-[15px] leading-6 text-(--ink-2)">
            출생 정보를 입력해 주세요. 나중에 언제든 고칠 수 있고, 고치면 그때부터 새 입력으로 계산합니다.
          </p>
        </header>
        <Link href={previewHref('/me')} className={`${s.btn} ${s.primary} self-stretch sm:self-start`}>
          내 명식 등록
          <InkIcon name="arrow" className="size-4" />
        </Link>
      </div>

      <ol aria-hidden="true" className="order-1 grid grid-cols-4 border-x border-(--rule) md:order-2">
        {PILLAR_COLUMNS.map(({ key, label }) => (
          <li key={key} className={`flex flex-col items-center gap-3 py-4 ${key !== 'hour' ? 'border-l border-(--rule)' : ''}`}>
            <span className="text-xs font-semibold text-(--ink-3)">{label}</span>
            <span className="h-[6.25rem] w-11 border border-dashed border-(--rule-strong) sm:h-[8.5rem] sm:w-16" />
            <span className="h-4" />
          </li>
        ))}
      </ol>
    </section>
  );
}
