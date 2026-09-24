import Link from 'next/link';

import { BRANCH_INFO, ELEMENT_KO, STEM_INFO } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import type { ReadingEntry } from '../../../reading/current';
import { PILLAR_COLUMNS } from '../../../../saju/shared';
import { readingHref as hrefOfReading } from '../../../reading/line';
import type { FixturePerson } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { Icon } from './icons';
import styles from './night.module.css';
import { PriorBadge } from './self-hero';
import { NIGHT_TONE, serif } from './tone';

/*
  **저장한 사람 한 줄 — 유리 카드.** 행 전체가 상세로 가는 문이고(이름 링크가 행을 덮는다), 단추 둘이 그 위에 선다.

  - 일간 구슬(48px): 오행 색이 안에서 비치고 글자는 명조 24px. 읽는 이름은 `aria-label` 이 든다.
  - 이름 16px 굵게 · 여덟 글자 명조 15px · 풀이의 비유 13px. 폰에서는 여덟 글자와 비유가 둘째 줄로 내려간다.
  - 단추: 「풀이 받기」는 금 테(아직 안 한 일), 「풀이 보기」와 「궁합」은 반투명. 이미 본 궁합은 점수가 금빛으로
    붙고 그 글로 곧장 간다. 한 줄에 채움 단추는 두지 않는다 — 채움은 판마다 하나다.
*/

const ACTION = 'relative z-10 inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-xl px-3 text-[13px] font-semibold';

export function PersonRow({ person, selfPersonId, pair }: { person: FixturePerson; selfPersonId: string | null; pair: ReadingEntry | null }) {
  const note = person.note?.trim() ?? '';
  const detailHref = previewHref(`/me/people/${person.personId}`);
  const compatHref = previewHref(
    selfPersonId === null
      ? `/compat#b.person=${person.personId}`
      : `/compat#a.person=${selfPersonId}&b.person=${person.personId}`,
  );
  const chart = person.chart;

  return (
    <li
      className={`${styles.glass} ${styles.row} relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-2xl p-3 sm:grid-cols-[auto_minmax(0,10rem)_auto_minmax(0,1fr)_auto] sm:gap-x-5 sm:px-4`}
    >
      <DayOrb chart={chart} />

      <div className="min-w-0">
        <Link
          href={detailHref}
          className={`${styles.stretch} block truncate text-base font-semibold text-[color:var(--n-text)]`}
        >
          {person.local_label}
        </Link>
        {note !== '' && <p className="hidden truncate text-[13px] text-[color:var(--n-text-3)] sm:block">{note}</p>}
      </div>

      {/* 폰: 둘째 줄(이름 아래, 단추 칸까지 걸친다) · 데스크톱: 한 줄의 셋째 · 넷째 칸 */}
      <div className="col-start-2 col-end-4 row-start-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:col-auto sm:row-auto sm:contents">
        {chart.ok ? (
          <Glyphs person={person} />
        ) : (
          <p className="text-[13px] text-[color:var(--n-text-2)] sm:col-span-2">{chart.message}</p>
        )}
        {chart.ok && <Status reading={person.reading} />}
      </div>

      <div className="col-start-3 row-start-1 flex items-center gap-1.5 sm:col-start-5">
        {chart.ok && (
          <Link
            href={previewHref(`/me/readings/${person.personId}`)}
            aria-label={person.reading === null ? '사주풀이 받기' : '사주풀이 보기'}
            className={`${ACTION} ${person.reading === null ? styles.gilded : styles.secondary}`}
          >
            {person.reading === null ? '풀이 받기' : '풀이 보기'}
          </Link>
        )}
        {chart.ok ? (
          <Link href={pair === null ? compatHref : previewHref(hrefOfReading(pair))} className={`${ACTION} ${styles.secondary}`}>
            <Icon name="pair" className="hidden size-4 text-[color:var(--n-text-2)] sm:block" />
            궁합
            {pair?.score != null && (
              <span className="tabular-nums text-[color:var(--n-gold-strong)]">{pair.score}점</span>
            )}
          </Link>
        ) : (
          <span className={`${ACTION} pointer-events-none text-[color:var(--n-text-2)]`} aria-hidden="true">
            <Icon name="arrow" className="size-4" />
          </span>
        )}
      </div>
    </li>
  );
}

function DayOrb({ chart }: { chart: FixturePerson['chart'] }) {
  if (!chart.ok) {
    return (
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-full border border-dashed border-[color:var(--n-line-strong)] text-lg text-[color:var(--n-text-3)]"
      >
        ?
      </span>
    );
  }
  const { dayMaster } = chart.saju.pillars;
  const info = STEM_INFO[dayMaster];
  return (
    <span
      role="img"
      aria-label={`일간 ${dayMaster}, ${info.ko}${ELEMENT_KO[info.element]}`}
      className={`${styles.orb} ${NIGHT_TONE[info.element].text} grid size-12 place-items-center rounded-full`}
    >
      <span aria-hidden="true" className={`${serif.className} text-2xl font-semibold leading-none`}>
        {dayMaster}
      </span>
    </span>
  );
}

/** 네 기둥 — 시 · 일 · 월 · 년. 일주만 금빛 밑줄 */
function Glyphs({ person }: { person: FixturePerson }) {
  if (!person.chart.ok) return null;
  const { saju } = person.chart;
  return (
    <p className={`${serif.className} flex items-center gap-2 text-[15px]`} aria-label={`${person.local_label}의 네 기둥`}>
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const pillar = saju.pillars[key];
        if (pillar === null) {
          return (
            <span key={key} className="w-[2.2em] text-center text-[color:var(--n-text-3)]">
              <span aria-hidden="true">··</span>
              <span className="sr-only">{HOUR_UNKNOWN_LABEL}</span>
            </span>
          );
        }
        return (
          <span
            key={key}
            className={`font-semibold ${key === 'day' ? 'border-b border-[color:var(--n-gold)]/70 pb-px' : ''}`}
          >
            <span className="sr-only">{label} </span>
            <span className={NIGHT_TONE[STEM_INFO[pillar.stem].element].text}>{pillar.stem}</span>
            <span className={NIGHT_TONE[BRANCH_INFO[pillar.branch].element].text}>{pillar.branch}</span>
          </span>
        );
      })}
    </p>
  );
}

/** 풀이 상태 — 비유 한 줄이거나 없다는 말. 폰에서도 둘째 줄에 남긴다 */
function Status({ reading }: { reading: ReadingEntry | null }) {
  if (reading === null) {
    return <p className="text-[13px] text-[color:var(--n-text-3)]">풀이 없음</p>;
  }
  return (
    <p className="flex min-w-0 items-center gap-2 text-[13px]">
      {!reading.fromCurrentChart && <PriorBadge />}
      <span className="truncate text-[color:var(--n-text-2)]">
        {reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}
      </span>
    </p>
  );
}
