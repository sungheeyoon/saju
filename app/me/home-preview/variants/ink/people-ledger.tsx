import Link from 'next/link';

import { ELEMENT_KO, STEM_INFO, type Saju } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import type { ReadingEntry } from '../../../reading/current';
import { readingHref } from '../../../reading/line';
import { PILLAR_COLUMNS } from '../../../../saju/shared';
import { PERSON_LIMIT, type FixturePerson } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { InkIcon } from './icons';
import s from './ink.module.css';
import { OldChartTag } from './self-plate';

/*
  **저장한 사람 — 카드가 아니라 명부(名簿)다.**

  위아래 먹 괘선 사이에 한 사람이 한 줄. 줄의 왼쪽 큰 칸은 누르면 그 사람의 상세로 가는 한 덩이다 —
  일간 한 글자(28px) · 이름 · 메모 · 작은 세로 네 기둥 · 풀이 한 줄. 오른쪽(폰에서는 아래)에 행동 둘.
  단추 위계: 풀이가 없으면 「풀이 받기」가 먹 테두리, 있으면 「풀이 보기」가 옅은 채움. 이미 본 궁합은
  옅은 채움에 점수가 붙고 그 글로 간다. 이 영역의 주칠 단추는 사람이 0명일 때의 「사람 추가」 하나뿐이다.
*/

export function PeopleLedger({
  people,
  readings,
  selfId,
}: {
  people: readonly FixturePerson[];
  readings: readonly ReadingEntry[];
  selfId: string | null;
}) {
  const full = people.length >= PERSON_LIMIT;

  return (
    <section aria-labelledby="ink-people" className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h2 id="ink-people" className="flex items-baseline gap-3">
          <span className={`${s.title} text-[1.5rem] font-bold leading-tight`}>저장한 사람</span>
          <span className="text-[13px] tabular-nums text-(--ink-3)">
            <span className="text-[15px] font-bold text-(--ink)">{people.length}</span>/{PERSON_LIMIT}명
          </span>
        </h2>
        {people.length > 0 && (
          <div className="flex items-center gap-4">
            {!full && (
              <Link href={previewHref('/me/people')} className={`${s.btn} ${s.secondary} min-h-11 px-3.5`}>
                <InkIcon name="plus" className="size-4" />
                사람 추가
              </Link>
            )}
            <Link href={previewHref('/me/people')} className={s.link}>
              전체 관리
              <InkIcon name="arrow" className="size-4" />
            </Link>
          </div>
        )}
      </header>

      {people.length === 0 ? (
        <AddFirst primary={selfId !== null} />
      ) : (
        <ol className="border-y-[1.5px] border-(--ink)">
          {people.map((person, index) => (
            <Row
              key={person.personId}
              person={person}
              first={index === 0}
              selfId={selfId}
              pair={pairOf(readings, selfId, person)}
            />
          ))}
        </ol>
      )}
      {full && <p className="text-[13px] text-(--ink-3)">등록할 수 있는 10명을 다 채웠습니다.</p>}
    </section>
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

function Row({
  person,
  first,
  selfId,
  pair,
}: {
  person: FixturePerson;
  first: boolean;
  selfId: string | null;
  pair: ReadingEntry | null;
}) {
  const note = person.note?.trim() ?? '';
  const detailHref = previewHref(`/me/people/${person.personId}`);
  const compatHref = previewHref(
    selfId === null ? `/compat#b.person=${person.personId}` : `/compat#a.person=${selfId}&b.person=${person.personId}`,
  );
  const { chart, reading } = person;

  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-x-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-4 ${first ? '' : 'border-t border-(--rule)'}`}
    >
      <Link
        href={detailHref}
        className={`${s.rowLink} -mx-2 grid min-h-14 grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-x-3 px-2 py-1 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] lg:grid-cols-[3.25rem_minmax(0,11rem)_auto_minmax(0,1fr)] lg:gap-x-5`}
      >
        <span className="row-span-2 self-center sm:row-span-1">
          <DayStem chart={chart} />
        </span>

        <span className="min-w-0">
          <span className={`${s.rowName} block truncate text-[17px] font-semibold leading-snug`}>{person.local_label}</span>
          {note !== '' && <span className="block truncate text-[13px] leading-5 text-(--ink-3)">{note}</span>}
          {!chart.ok && <span className="block truncate text-[13px] leading-5 text-(--ink-3)">{chart.message}</span>}
        </span>

        {chart.ok && <MiniPillars saju={chart.saju} label={person.local_label} />}

        {chart.ok && (
          <span className="col-span-2 col-start-2 mt-1 hidden min-w-0 items-center gap-2 text-[13px] sm:flex lg:col-span-1 lg:col-start-4 lg:mt-0">
            {reading === null ? (
              <span className="text-(--ink-3)">풀이 없음</span>
            ) : (
              <>
                {!reading.fromCurrentChart && <OldChartTag />}
                <span className={`${s.title} truncate text-[15px] text-(--ink-2)`}>
                  {reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}
                </span>
              </>
            )}
          </span>
        )}
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row">
        {chart.ok ? (
          <>
            <Link
              href={previewHref(`/me/readings/${person.personId}`)}
              className={`${s.btn} ${reading === null ? s.secondary : s.quiet} px-2 sm:px-3.5`}
            >
              {reading === null ? '풀이 받기' : '풀이 보기'}
              {reading !== null && !reading.fromCurrentChart && <span className="sr-only">(이전 명식)</span>}
            </Link>
            <Link
              href={pair === null ? compatHref : previewHref(readingHref(pair))}
              className={`${s.btn} ${pair === null ? s.secondary : s.quiet} px-2 sm:px-3.5`}
            >
              궁합
              {pair?.score != null && <span className="tabular-nums text-(--shu)">{pair.score}점</span>}
            </Link>
          </>
        ) : (
          <Link href={detailHref} className={`${s.btn} ${s.secondary} px-2 sm:px-3.5`}>
            자세히
          </Link>
        )}
      </div>
    </li>
  );
}

type Chart = FixturePerson['chart'];

/** 일간 한 글자 — 각진 먹 테 안에. 오행은 아래 한자로 */
function DayStem({ chart }: { chart: Chart }) {
  if (!chart.ok) {
    return (
      <span aria-hidden="true" className="grid size-[3.25rem] place-items-center border border-dashed border-(--rule-strong) text-lg text-(--ink-3)">
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
      className="relative grid size-[3.25rem] place-items-center border border-(--rule-strong) bg-(--paper-raised)"
    >
      <span aria-hidden="true" className={`${s.hanja} text-[1.75rem] font-black leading-none`}>
        {dayMaster}
      </span>
      <span aria-hidden="true" className={`${s.hanja} absolute bottom-0.5 right-1 text-[11px] leading-none text-(--ink-3)`}>
        {info.element}
      </span>
    </span>
  );
}

/** 작은 네 기둥 — 위의 큰 기둥과 같은 세로 쓰기. 일주만 주칠 밑금 */
function MiniPillars({ saju, label }: { saju: Saju; label: string }) {
  return (
    <span className="col-start-2 mt-1.5 flex items-stretch gap-1 sm:col-start-auto sm:mt-0" aria-label={`${label}의 네 기둥`}>
      {PILLAR_COLUMNS.map(({ key, label: column }) => {
        const pillar = saju.pillars[key];
        if (pillar === null) {
          return (
            <span key={key} className="grid w-6 place-items-center border border-dashed border-(--rule) text-[11px] text-(--ink-3)">
              <span aria-hidden="true">·</span>
              <span className="sr-only">
                {column} {HOUR_UNKNOWN_LABEL}
              </span>
            </span>
          );
        }
        return (
          <span
            key={key}
            className={`${s.hanja} ${s.vertical} w-6 border-b-2 pb-1 pt-0.5 text-center text-[15px] font-bold leading-[1.25] ${
              key === 'day' ? 'border-(--shu)' : 'border-transparent'
            }`}
          >
            <span className="sr-only">{column} </span>
            {pillar.name}
          </span>
        );
      })}
    </span>
  );
}

/** 사람 0명 — 빈 명부 한 칸. 내 사주가 있으면 이 영역의 주 행동은 사람 추가다 */
function AddFirst({ primary }: { primary: boolean }) {
  return (
    <div className="flex flex-col items-start gap-4 border-y-[1.5px] border-(--ink) py-6 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[15px] leading-6 text-(--ink-2)">가족이나 친구의 출생 정보를 저장하고 관리하세요.</p>
      <Link
        href={previewHref('/me/people')}
        className={`${s.btn} ${primary ? s.primary : s.secondary} self-stretch sm:self-auto`}
      >
        <InkIcon name="plus" className="size-4" />
        사람 추가
      </Link>
    </div>
  );
}
