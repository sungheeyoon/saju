import Link from 'next/link';

import { ELEMENT_PICTURE_KO, STEM_INFO } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';
import { READING_STALE_LABEL } from '@/src/lib/reading/notes';

import { elementScope } from '../../ui/element-tone';
import { PILLAR_COLUMNS } from '../../saju/shared';
import { BUTTON_ON_TILE, BUTTON_ON_TILE_PRIMARY } from '../../ui/buttons';
import { ElementSymbol } from '../../ui/element-symbol';
import { Icon } from '../../ui/icons';
import { STALE_CHIP, TYPE_NAME } from '../../ui/surfaces';
import type { ReadingEntry } from '../reading/current';
import { tileAnchor, type HomePerson } from './map/model';

/*
  **한 사람 = 한 장의 파스텔 타일.** 타일 색은 그 사람의 일간 오행이다 — 열 명이 모이면 색만으로도 누가
  어느 기운인지 갈린다. 그래도 색 혼자 말하지 않게 왼쪽 위 딱지에 상징 · 일간 글자 · 이름(나무 …)을 함께 둔다.

  타일 전체가 상세로 가는 링크다(이름 링크의 `after:` 가 타일을 덮는다). 단추 둘은 그 위에 떠서 따로 눌린다.
  **관계 지도의 원이 자바스크립트 없이 오는 자리**이기도 하다(`id`) — 그래서 이 타일이 그 사람의 길을 전부 든다.
*/

/** 지도에서 건너온 타일을 짚는다 — 자바스크립트 없이 `#person-…` 로 왔을 때 */
const TARGET = 'scroll-mt-24 target:ring-[3px] target:ring-accent target:ring-offset-2 target:ring-offset-background';

export function PersonTile({
  person,
  reading,
  compat,
}: {
  person: HomePerson;
  /** 그 사람의 사주풀이 — 없으면 `null` */
  reading: ReadingEntry | null;
  /** 나와 궁합 — 이미 본 것이면 점수를 달고 그 글로 간다 */
  compat: { href: string; score: number | null };
}) {
  const detailHref = `/me/people/${person.personId}`;
  const note = person.note?.trim() ?? '';
  const anchor = tileAnchor(person.personId);

  if (!person.chart.ok) {
    return (
      <li id={anchor} className={`${elementScope(null)} ${TARGET} relative flex flex-col gap-3 rounded-[1.5rem] bg-[var(--tile)] p-3.5 sm:p-4`}>
        <span className="grid size-7 place-items-center self-start rounded-full bg-[color-mix(in_srgb,var(--surface)_70%,transparent)]">
          <ElementSymbol element={null} className="size-5" />
        </span>
        <Name href={detailHref} label={person.label} />
        <p className="text-[13px] leading-5 text-secondary">{person.chart.message}</p>
        <div className="relative z-10 mt-auto">
          <Link href={detailHref} className={`${BUTTON_ON_TILE} w-full`}>
            자세히
          </Link>
        </div>
      </li>
    );
  }

  const { saju } = person.chart;
  const dayMaster = saju.pillars.dayMaster;
  const element = STEM_INFO[dayMaster].element;

  return (
    <li
      id={anchor}
      className={`${elementScope(element)} ${TARGET} relative flex flex-col gap-2.5 overflow-hidden rounded-[1.5rem] bg-[var(--tile)] p-3.5 sm:p-4`}
    >
      <ElementSymbol element={element} className="pointer-events-none absolute -right-3 -top-3 size-20 opacity-20" />

      <span
        className="flex items-center gap-1 self-start rounded-full bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] py-1 pl-1 pr-2.5 text-[12px] font-semibold text-[var(--ink)]"
        aria-label={`일간 ${dayMaster}, ${ELEMENT_PICTURE_KO[element]}`}
      >
        <ElementSymbol element={element} className="size-5" />
        <span aria-hidden="true" className="glyph text-[15px] font-bold leading-none">
          {dayMaster}
        </span>
        <span aria-hidden="true">{ELEMENT_PICTURE_KO[element]}</span>
      </span>

      <div className="min-w-0">
        <Name href={detailHref} label={person.label} />
        {note !== '' && <p className="mt-0.5 truncate text-[12px] text-secondary">{note}</p>}
      </div>

      <p className="flex items-center gap-1 text-[var(--ink)]" aria-label={`${person.label}의 네 기둥`}>
        {PILLAR_COLUMNS.map(({ key, label }) => {
          const pillar = saju.pillars[key];
          if (pillar === null) {
            return (
              <span key={key} className="glyph min-w-[1.9rem] text-center text-[14px] text-secondary">
                <span aria-hidden="true">··</span>
                <span className="sr-only">
                  {label} {HOUR_UNKNOWN_LABEL}
                </span>
              </span>
            );
          }
          return (
            <span
              key={key}
              className={`glyph rounded-md px-0.5 text-[14px] font-semibold leading-6 ${key === 'day' ? 'bg-[color-mix(in_srgb,var(--surface)_75%,transparent)]' : ''}`}
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
              <span className={`mr-1 ${STALE_CHIP}`}>{READING_STALE_LABEL}</span>
            )}
            <span className="text-foreground">{reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}</span>
          </>
        )}
      </p>

      {/*
        폰 360px 에서 타일 안 폭이 130px 남짓이라 두 단추가 나란히 서면 「풀이 받기」가 두 줄로 꺾였다. 좁은 폭에서는
        궁합 단추가 하트(점수가 있으면 점수)만 들고 물러난다 — 이름은 `aria-label` 이 늘 든다.
      */}
      <div className="relative z-10 mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 min-[400px]:grid-cols-2">
        <Link
          href={`/me/readings/${person.personId}`}
          className={`${reading === null ? BUTTON_ON_TILE_PRIMARY : BUTTON_ON_TILE} whitespace-nowrap`}
        >
          {reading === null ? '풀이 받기' : '풀이 보기'}
        </Link>
        <Link
          href={compat.href}
          className={`${BUTTON_ON_TILE} min-w-11 whitespace-nowrap`}
          aria-label={compat.score !== null ? `나와 궁합 ${compat.score}점` : '나와 궁합'}
        >
          <Icon name="heart" className={`size-4 ${compat.score !== null ? 'max-[399px]:hidden' : ''}`} />
          {compat.score !== null ? (
            <span className="tabular-nums">{compat.score}점</span>
          ) : (
            <span className="max-[399px]:sr-only">궁합</span>
          )}
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
      className={`${TYPE_NAME} block truncate after:absolute after:inset-0 after:rounded-[1.5rem] after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-[3px] focus-visible:after:outline-[color-mix(in_srgb,var(--accent)_45%,transparent)]`}
    >
      {label}
    </Link>
  );
}
