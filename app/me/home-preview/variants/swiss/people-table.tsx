import Link from 'next/link';

import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import type { ReadingEntry } from '../../../reading/current';
import { readingHref as hrefOfReading } from '../../../reading/line';
import { PILLAR_COLUMNS } from '../../../../saju/shared';
import type { FixturePerson } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { Icon } from './icons';
import { OldChartTag } from './self-block';
import s from './swiss.module.css';

/*
  **저장한 사람 — 카드가 아니라 표다.**

  열 다섯: 이름 · 여덟 글자 · 풀이 · 궁합 · 행동, 폭은 3 · 3 · 3 · 1.5 · 1.5(= 12열). 머리줄은 11px 대문자형
  라벨, 줄 사이는 1px 선, 줄 높이는 최소 72px. 이미 본 궁합은 점수가 **숫자 열**로 선다 — 28px 탭 숫자가
  표의 오른쪽을 한 줄로 세워 열 명의 궁합이 눈으로 훑인다. 숫자 자체가 그 글로 가는 링크다.
  폰(md 아래)에서는 표 머리와 풀이 칸이 숨고 한 줄이 두 층이 된다 — 위: 이름 · 궁합, 아래: 여덟 글자 · 풀이 단추.
*/

type Chart = FixturePerson['chart'];

/** 3 · 3 · 3 · 1.5 · 1.5 — 12열을 다섯 칸으로 */
const COLUMNS = 'md:grid md:grid-cols-[minmax(0,3fr)_minmax(0,3fr)_minmax(0,3fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] md:items-center md:gap-6';

export function PeopleTable({
  people,
  readings,
  selfPersonId,
}: {
  people: readonly FixturePerson[];
  readings: readonly ReadingEntry[];
  selfPersonId: string | null;
}) {
  return (
    <div className="flex flex-col">
      <div aria-hidden="true" className={`hidden border-b border-[var(--sw-ink)] pb-2 ${COLUMNS}`}>
        {['이름', '여덟 글자', '풀이', '궁합', ''].map((head, index) => (
          <span key={head === '' ? index : head} className={`${s.eyebrow} ${index >= 3 ? 'text-right' : ''}`}>
            {head}
          </span>
        ))}
      </div>
      <ol className="flex flex-col">
        {people.map((person) => (
          <Row key={person.personId} person={person} pair={pairOf(readings, selfPersonId, person)} selfPersonId={selfPersonId} />
        ))}
      </ol>
    </div>
  );
}

function Row({ person, pair, selfPersonId }: { person: FixturePerson; pair: ReadingEntry | null; selfPersonId: string | null }) {
  const note = person.note?.trim() ?? '';
  const detailHref = previewHref(`/me/people/${person.personId}`);
  const readingHref = previewHref(`/me/readings/${person.personId}`);
  const compatHref = previewHref(
    pair !== null
      ? hrefOfReading(pair)
      : selfPersonId === null
        ? `/compat#b.person=${person.personId}`
        : `/compat#a.person=${selfPersonId}&b.person=${person.personId}`,
  );
  const { reading } = person;

  return (
    <li className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-[var(--sw-rule)] py-3 md:min-h-[72px] md:py-3 ${COLUMNS}`}>
      {/* 이름 — 폰에서는 이전 명식 표시가 이름 옆으로 온다(풀이 칸이 숨는다) */}
      <div className="col-start-1 row-start-1 min-w-0 md:col-start-auto md:row-start-auto">
        <span className="flex min-w-0 items-center gap-2">
          <Link
            href={detailHref}
            className={`${s.nameLink} inline-flex min-h-11 min-w-0 items-center text-[17px] font-semibold tracking-[-0.02em]`}
          >
            <span className="truncate">{person.local_label}</span>
          </Link>
          {reading !== null && !reading.fromCurrentChart && (
            <span className="md:hidden">
              <OldChartTag />
            </span>
          )}
        </span>
        {note !== '' && <p className="-mt-2 hidden truncate text-[12px] leading-4 text-[var(--sw-ink-3)] md:block">{note}</p>}
      </div>

      {/* 여덟 글자 */}
      <div className="col-start-1 row-start-2 min-w-0 self-center md:col-start-auto md:row-start-auto">
        {person.chart.ok ? (
          <Glyphs chart={person.chart} label={person.local_label} />
        ) : (
          <p className="text-[13px] text-[var(--sw-ink-3)]">{person.chart.message}</p>
        )}
      </div>

      {/* 풀이 — 상태 한 줄. 폰에서는 숨고 단추 모양(＋받기 / 보기→)이 상태를 든다 */}
      <div className="hidden min-w-0 md:flex md:flex-col md:gap-1">
        {person.chart.ok &&
          (reading === null ? (
            <span className="text-[13px] text-[var(--sw-ink-3)]">풀이 없음</span>
          ) : (
            <>
              {!reading.fromCurrentChart && <OldChartTag />}
              <span className="line-clamp-2 text-[14px] leading-5 text-[var(--sw-ink-2)]">
                {reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}
              </span>
            </>
          ))}
      </div>

      {/* 궁합 — 강조색 한 갈래: 본 것은 점수 숫자, 안 본 것은 글자 링크. 둘 다 누르면 간다 */}
      <div className="col-start-2 row-start-1 flex items-center justify-end md:col-start-auto md:row-start-auto">
        {person.chart.ok &&
          (pair?.score != null ? (
            <Link
              href={compatHref}
              aria-label={`나와 ${person.local_label}의 궁합 ${pair.score}점 보기`}
              className={s.tertiary}
            >
              <span className="text-[1.75rem] font-semibold leading-none tracking-[-0.04em] tabular-nums">{pair.score}</span>
              <span className="self-end pb-0.5 text-[12px] font-semibold">점</span>
              <Icon name="arrow" size={16} />
            </Link>
          ) : (
            <Link href={compatHref} className={`${s.tertiary}`} aria-label={`나와 ${person.local_label}의 궁합 보기`}>
              궁합
              <Icon name="arrow" size={16} />
            </Link>
          ))}
      </div>

      {/* 행동 — 풀이 */}
      <div className="col-start-2 row-start-2 flex items-center justify-end md:col-start-auto md:row-start-auto">
        {person.chart.ok ? (
          reading === null ? (
            <Link href={readingHref} className={`${s.secondary} ${s.secondaryAccent}`}>
              <Icon name="plus" size={16} />
              풀이 받기
            </Link>
          ) : (
            <Link href={readingHref} className={`${s.secondary}`}>
              풀이 보기
              <Icon name="arrow" size={16} />
            </Link>
          )
        ) : (
          <Link href={detailHref} className={`${s.secondary}`}>
            자세히
            <Icon name="arrow" size={16} />
          </Link>
        )}
      </div>
    </li>
  );
}

/** 여덟 글자 한 줄 — 기둥마다 두 자, 일주에 밑줄. 시각 모름은 대시 */
function Glyphs({ chart, label }: { chart: Extract<Chart, { ok: true }>; label: string }) {
  return (
    <p className="flex items-baseline gap-2 md:gap-2.5" aria-label={`${label}의 네 기둥`}>
      {PILLAR_COLUMNS.map(({ key, label: column }) => {
        const pillar = chart.saju.pillars[key];
        return (
          <span
            key={key}
            className={`${s.han} border-b-2 pb-0.5 text-[17px] font-medium leading-7 md:text-[20px] ${
              key === 'day' ? 'border-[var(--sw-accent)]' : 'border-transparent'
            } ${pillar === null ? 'text-[var(--sw-rule-2)]' : ''}`}
          >
            <span className="sr-only">{column} </span>
            {pillar === null ? (
              <>
                <span aria-hidden="true">——</span>
                <span className="sr-only">{HOUR_UNKNOWN_LABEL}</span>
              </>
            ) : (
              `${pillar.stem}${pillar.branch}`
            )}
          </span>
        );
      })}
    </p>
  );
}

/** 나 × 그 사람의 궁합풀이 — 최근 것이 앞이라 처음 만난 것이 가장 최근이다 */
function pairOf(readings: readonly ReadingEntry[], selfId: string | null, person: FixturePerson): ReadingEntry | null {
  if (selfId === null) return null;
  return (
    readings.find(
      (entry) =>
        entry.kind === 'private' &&
        ((entry.personA === selfId && entry.personB === person.personId) ||
          (entry.personB === selfId && entry.personA === person.personId)),
    ) ?? null
  );
}
