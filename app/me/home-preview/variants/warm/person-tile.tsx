import Link from 'next/link';

import { ELEMENT_PICTURE_KO, STEM_INFO } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import type { ReadingEntry } from '../../../reading/current';
import { readingHref as hrefOfReading } from '../../../reading/line';
import { PILLAR_COLUMNS } from '../../../../saju/shared';
import type { FixturePerson } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { ON_TILE, ON_TILE_PRIMARY } from './buttons';
import { rounded } from './fonts';
import { ELEMENT_CLASS, ElementSymbol, Icon, NONE_CLASS } from './symbols';

/*
  **한 사람 = 한 장의 파스텔 타일.** 타일 색은 그 사람의 일간 오행이다 — 열 명이 모이면 색만으로도 누가
  어느 기운인지 한눈에 갈린다. 그래도 색 혼자 말하지 않게 왼쪽 위 딱지에 상징 · 일간 글자 · 이름(나무 …)을 함께 둔다.

  타일 전체가 상세로 가는 링크다(이름 링크의 `after:` 가 타일을 덮는다). 단추 둘은 그 위에 떠서 따로 눌린다.
  폰 폭(2열, 한 장 약 158px)에서 단추 둘이 나란히 들어가도록 글자를 13px 로 줄였고, 누를 높이는 44px 을 지킨다.
*/

export function PersonTile({
  person,
  selfPersonId,
  pair,
}: {
  person: FixturePerson;
  selfPersonId: string | null;
  /** 나 × 이 사람의 궁합풀이 — 있으면 궁합 단추가 점수를 달고 그 글로 간다 */
  pair: ReadingEntry | null;
}) {
  const detailHref = previewHref(`/me/people/${person.personId}`);
  const note = person.note?.trim() ?? '';

  if (!person.chart.ok) {
    return (
      <li className={`${NONE_CLASS} relative flex flex-col gap-3 rounded-[1.5rem] bg-[var(--tile)] p-3.5 sm:p-4`}>
        <span className="grid size-7 place-items-center self-start rounded-full bg-[color-mix(in_srgb,var(--card)_70%,transparent)]">
          <ElementSymbol element={null} className="size-5" />
        </span>
        <Name href={detailHref} label={person.local_label} />
        <p className="text-[13px] leading-5 text-secondary">{person.chart.message}</p>
        <div className="relative z-10 mt-auto">
          <Link href={detailHref} className={`${ON_TILE} w-full`}>
            자세히
          </Link>
        </div>
      </li>
    );
  }

  const { saju } = person.chart;
  const dayMaster = saju.pillars.dayMaster;
  const element = STEM_INFO[dayMaster].element;
  const reading = person.reading;
  const readingHref = previewHref(`/me/readings/${person.personId}`);
  const compatHref =
    pair === null
      ? previewHref(
          selfPersonId === null ? `/compat#b.person=${person.personId}` : `/compat#a.person=${selfPersonId}&b.person=${person.personId}`,
        )
      : previewHref(hrefOfReading(pair));

  return (
    <li className={`${ELEMENT_CLASS[element]} relative flex flex-col gap-2.5 overflow-hidden rounded-[1.5rem] bg-[var(--tile)] p-3.5 sm:p-4`}>
      <ElementSymbol element={element} className="pointer-events-none absolute -right-3 -top-3 size-20 opacity-20" />

      <span
        className="flex items-center gap-1 self-start rounded-full bg-[color-mix(in_srgb,var(--card)_70%,transparent)] py-1 pl-1 pr-2.5 text-[12px] font-semibold text-[var(--ink)]"
        aria-label={`일간 ${dayMaster}, ${ELEMENT_PICTURE_KO[element]}`}
      >
        <ElementSymbol element={element} className="size-5" />
        <span aria-hidden="true" className="glyph text-[15px] font-bold leading-none">
          {dayMaster}
        </span>
        <span aria-hidden="true">{ELEMENT_PICTURE_KO[element]}</span>
      </span>

      <div className="min-w-0">
        <Name href={detailHref} label={person.local_label} />
        {note !== '' && <p className="mt-0.5 truncate text-[12px] text-secondary">{note}</p>}
      </div>

      <p className="flex items-center gap-1 text-[var(--ink)]" aria-label={`${person.local_label}의 네 기둥`}>
        {PILLAR_COLUMNS.map(({ key, label }) => {
          const pillar = saju.pillars[key];
          if (pillar === null) {
            return (
              <span key={key} className="glyph min-w-[1.9rem] text-center text-[14px] text-secondary">
                <span aria-hidden="true">··</span>
                <span className="sr-only">{label} {HOUR_UNKNOWN_LABEL}</span>
              </span>
            );
          }
          return (
            <span
              key={key}
              className={`glyph rounded-md px-0.5 text-[14px] font-semibold leading-6 ${key === 'day' ? 'bg-[color-mix(in_srgb,var(--card)_75%,transparent)]' : ''}`}
            >
              <span className="sr-only">{label} </span>
              {pillar.stem}
              {pillar.branch}
            </span>
          );
        })}
      </p>

      <p className="line-clamp-2 min-h-10 text-[13px] leading-5">
        {reading === null ? (
          <span className="text-secondary">풀이 없음</span>
        ) : (
          <>
            {!reading.fromCurrentChart && (
              <span className="mr-1 rounded-full bg-warning-wash px-1.5 py-0.5 text-[11px] font-semibold text-warning">이전 명식</span>
            )}
            <span className="text-foreground">{reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}</span>
          </>
        )}
      </p>

      <div className="relative z-10 mt-auto grid grid-cols-2 gap-1.5">
        <Link href={readingHref} className={reading === null ? ON_TILE_PRIMARY : ON_TILE}>
          {reading === null ? '풀이 받기' : '풀이 보기'}
        </Link>
        <Link href={compatHref} className={ON_TILE} aria-label={pair?.score != null ? `나와 궁합 ${pair.score}점` : '나와 궁합'}>
          <Icon name="heart" className="size-4" />
          {pair?.score != null ? <span className="tabular-nums">{pair.score}점</span> : '궁합'}
        </Link>
      </div>
    </li>
  );
}

/** 이름 — 이 링크의 `after:` 가 타일 전체를 덮어 타일이 곧 상세 링크가 된다 */
function Name({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`${rounded.className} block truncate text-[1.3rem] leading-7 text-foreground after:absolute after:inset-0 after:rounded-[1.5rem] after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-[3px] focus-visible:after:outline-[color-mix(in_srgb,var(--btn)_45%,transparent)]`}
    >
      {label}
    </Link>
  );
}
