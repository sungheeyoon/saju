import Link from 'next/link';

import { isoOf, solarDateOf } from '@/src/lib/input/chart';
import { HOUR_UNKNOWN_LABEL, type Query } from '@/src/lib/input/query';
import { READING_STALE_LABEL } from '@/src/lib/reading/notes';
import {
  BRANCH_INFO,
  CALENDAR_KO,
  ELEMENTS,
  ELEMENT_PICTURE_KO,
  GENDER_KO,
  STEM_INFO,
  type Element,
  type Saju,
} from '@/src/lib/saju';

import { elementScope } from '../../ui/element-tone';
import { PILLAR_COLUMNS } from '../../saju/shared';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../../ui/buttons';
import { ElementSymbol } from '../../ui/element-symbol';
import { Icon } from '../../ui/icons';
import { EditInput } from '../edit-input';
import type { ReadingEntry } from '../reading/current';

/*
  **나 — 홈의 기준점.** 카드가 내 일간의 파스텔을 입는다(아래 사람 타일과 같은 규칙이라 「나도 이 목록의
  한 색」이 된다). 여덟 글자는 36~44px 로 세로 두 줄(천간 위 · 지지 아래)로 세우고, 오행 분포 다섯 칸이 같은
  색에 **상징과 이름**을 붙여 색만으로 말하지 않는다.

  **넓은 화면에서는 관계 지도와 한 줄에 서고 두 카드의 윗선 · 아랫선이 같다.** 격자가 두 칸을 같은 높이로
  늘이고, 이 카드는 네 덩어리를 위아래로 고르게 편다(`justify-between`) — 이름과 한 줄 평 → 저장된 출생 정보 →
  여덟 글자와 오행 분포 → 단추. 무엇으로 계산했나가 결과 앞에 선다. 단추 줄이 지도의 범례 띠와 같은 바닥선에 선다. 남는 높이가 한 틈에 몰리지 않고 덩어리 사이에 나뉜다.

  고치는 손잡이(「출생 정보 수정」)는 오른쪽 맨 위 모서리에 뜨고, 펴지는 폼은 머리 바로 아래에 선다 — 누르는
  곳과 펴지는 곳이 멀면 폰에서 눌러도 아무 일이 없는 것처럼 보였다.
*/

export function SelfCard({
  personId,
  label,
  query,
  saju,
  reading,
}: {
  personId: string;
  label: string;
  query: Query;
  saju: Saju;
  /** 내 사주풀이 — 없으면 `null` */
  reading: ReadingEntry | null;
}) {
  const dayElement = STEM_INFO[saju.pillars.dayMaster].element;

  return (
    <section
      aria-label="내 사주"
      className={`${elementScope(dayElement)} relative flex h-full min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-[2rem] bg-[var(--tile)] p-5 sm:gap-6 sm:p-8`}
    >
      <ElementSymbol element={dayElement} className="pointer-events-none absolute -bottom-10 -right-8 size-40 opacity-15 sm:size-56" />

      {/* 이름(가장 크게)과 바로 아래 한 줄 평 — 내 사주풀이의 비유. 풀이가 없으면 그 줄은 서지 않는다 */}
      <header className="relative flex min-w-0 flex-col gap-2 pr-14 sm:gap-3">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ink)]">
            <span className="rounded-full bg-[var(--ink)] px-2 py-0.5 text-[11px] font-bold text-[var(--tile)]">나</span>
            내 사주
          </p>
          <h2 className="mt-1 break-all font-rounded text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-foreground sm:text-[2.5rem]">
            {label}
          </h2>
        </div>
        {reading?.metaphor != null && (
          <p className="font-rounded text-[1.0625rem] leading-[1.5] text-foreground sm:text-xl">
            <span className="sr-only">내 사주풀이의 비유 </span>
            <span aria-hidden="true" className="text-[var(--ink)]">“</span>
            {reading.metaphor}
            <span aria-hidden="true" className="text-[var(--ink)]">”</span>
          </p>
        )}
      </header>

      {/* 모서리 손잡이 — 단추는 카드의 오른쪽 맨 위에 뜨고, 펴지는 폼은 여기(머리 아래)에 선다 */}
      {/*
        `display: contents` 라 이 상자는 판에 자리를 안 차지한다 — 단추만 판의 오른쪽 맨 위로 띄운다(공용
        `ICON_BUTTON` 의 `relative` 가 손잡이의 `absolute` 를 이겨 단추가 흐름에 떨어지던 것을 여기서 누른다).
      */}
      <div className="contents [&>button]:absolute [&>button]:right-4 [&>button]:top-4 sm:[&>button]:right-5 sm:[&>button]:top-5">
        <EditInput personId={personId} current={query} variant="corner" editableName={false} confirmsRequests />
      </div>

      <BirthLine query={query} />

      <div className="relative grid gap-4 sm:gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-end md:gap-8">
        <Pillars saju={saju} />
        <ElementCounts saju={saju} />
      </div>

      {/* 폰에서도 두 단추가 한 줄을 나눠 쓴다 — 세로로 쌓으면 단추 줄만 110px 였다 */}
      <div className="relative flex flex-wrap items-center gap-2">
        <Link href="/me/readings/self" className={`${BUTTON_PRIMARY} flex-1 px-4 sm:flex-none sm:min-w-52 sm:px-5`}>
          <Icon name={reading === null ? 'spark' : 'reading'} className="size-[18px]" />
          {reading === null ? '사주풀이 받기' : '사주풀이 보기'}
          {reading !== null && !reading.fromCurrentChart && (
            <span className="rounded-full bg-[color-mix(in_srgb,var(--on-accent)_20%,transparent)] px-2 py-0.5 text-[11px]">{READING_STALE_LABEL}</span>
          )}
        </Link>
        <Link href={`/me/people/${personId}`} className={`${BUTTON_SECONDARY} flex-1 px-4 sm:flex-none sm:px-5`}>
          사주 자세히 보기
          <Icon name="arrow" className="hidden size-4 sm:block" />
        </Link>
      </div>
    </section>
  );
}

/** 네 기둥 — 시 · 일 · 월 · 년, 천간이 위 지지가 아래. 일주 칸은 테두리로 짚는다 */
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
              <span className="grid min-h-[6.25rem] place-items-center rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--ink)_30%,transparent)] px-1 text-center text-[12px] leading-tight text-secondary sm:min-h-[8.5rem]">
                {HOUR_UNKNOWN_LABEL}
              </span>
            ) : (
              <span
                aria-label={`${label} ${pillar.name}`}
                className={`flex flex-col gap-1 rounded-2xl p-1 ${
                  day ? 'bg-surface shadow-card ring-2 ring-[var(--ink)]' : 'bg-[color-mix(in_srgb,var(--surface)_55%,transparent)]'
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
      className={`${elementScope(element)} glyph grid h-11 place-items-center rounded-xl bg-[var(--tile)] text-[1.85rem] font-bold leading-none text-[var(--ink)] sm:h-16 sm:text-[2.6rem]`}
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
              className={`${elementScope(element)} flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2 sm:py-2.5 ${
                count === 0 ? 'border border-dashed border-[color-mix(in_srgb,var(--foreground)_22%,transparent)]' : 'bg-surface'
              }`}
            >
              <ElementSymbol element={element} className="size-6 sm:size-7" />
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

/**
 * 저장된 출생 정보 — **이 사주가 무엇으로 계산됐나.** 폰에서는 상자를 벗고 한 줄(생년월일 · 출생지)로 선다
 * (2026-09-25) — 카드 한 장이 첫 화면에 들어야 해서다. 아예 빼면 고친 입력이 홈 어디에도 안 보인다. 성별과 자시
 * 규칙은 넓은 화면에만 서고, 폰에서는 「사주 자세히 보기」에 있다. 두 폭이 **같은 글 한 벌**을 입는다.
 *
 * 음력으로 넣었으면 적은 그대로와 바뀐 양력을 함께 보여준다. 양력만 보이면 사용자가 자기 입력을 못
 * 알아보고, 원본만 보이면 우리가 무엇으로 계산했는지 모른다(ADR 0002).
 */
function BirthLine({ query }: { query: Query }) {
  const rows = [
    [
      '생년월일',
      `${
        query.calendar === 'solar' ? query.date : `${CALENDAR_KO[query.calendar]} ${query.date} · 양력 ${isoOf(solarDateOf(query))}`
      }${query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` ${query.time}`}`,
    ],
    ['성별', GENDER_KO[query.gender]],
    ['출생지', query.city],
    ['자시 규칙', query.rule === 'jo' ? '조자시 (23:00 경계)' : '야자시 (자정 경계)'],
  ] as const;

  return (
    <section className="relative -mt-2 sm:mt-0 sm:rounded-[1.25rem] sm:bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] sm:px-4 sm:py-3">
      <h3 className="sr-only text-[13px] font-semibold text-secondary sm:not-sr-only">저장된 출생 정보</h3>
      <dl className="flex flex-wrap gap-x-1.5 text-[13px] leading-5 text-secondary sm:mt-1.5 sm:grid sm:grid-cols-[auto_1fr_auto_1fr] sm:gap-x-5 sm:gap-y-1 sm:text-[14px] sm:leading-6">
        {rows.map(([term, value], at) => (
          <div key={term} className={at === 0 || at === 2 ? 'contents' : 'hidden sm:contents'}>
            <dt className="sr-only text-secondary sm:not-sr-only">{term}</dt>
            <dd className={`min-w-0 tabular-nums sm:text-foreground ${at === 2 ? "before:mr-1.5 before:content-['·'] sm:before:content-none" : ''}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
