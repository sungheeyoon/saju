import Link from 'next/link';

import { type Saju } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import type { ReadingEntry } from '../../../reading/current';
import { readingHref as hrefOfReading } from '../../../reading/line';
import { PILLAR_COLUMNS } from '../../../../saju/shared';
import { PERSON_LIMIT, type FixturePerson } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { Arrow } from './arrow';
import { PriorTag } from './cover';
import s from './ed.module.css';

/*
  **저장한 사람 = 목차.** 번호(01 · 02) · 제목(이름, 명조 24px) · 부제(비유 한 줄) · 여덟 글자 · 행동 둘.

  1차 R 의 줄(`r/person-row.tsx`)은 이름 14px · 여덟 글자 14px · 단추 12px 이 한 높이에 서서 무엇이 먼저인지
  말하지 않았다. 여기서는 이름이 제목이다 — 제목 자체가 상세로 가는 링크이고, 번호와 비유가 그 제목을 받친다.
  행동은 두 무게로만: 아직 없는 풀이는 「풀이 받기」 테두리 알약(할 일), 있는 것은 밑줄 링크(읽을 것).
  이미 본 궁합은 점수가 숫자 활자로 붙고 그 글로 간다.
*/

export function Contents({
  people,
  readings,
  selfId,
}: {
  people: readonly FixturePerson[];
  readings: readonly ReadingEntry[];
  /** 내 사주가 없으면 `null` — 그때 「사람 추가」는 주 단추가 아니다(「내 명식 등록」이 유일한 주 행동) */
  selfId: string | null;
}) {
  const full = people.length >= PERSON_LIMIT;

  return (
    <section aria-labelledby="ed-contents-title" className="flex flex-col gap-6">
      <div className={`${s.ruleHeavy} grid gap-4 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end`}>
        <div className="flex items-baseline gap-4">
          <h2 id="ed-contents-title" className={s.display}>
            저장한 사람
          </h2>
          <p className={`${s.figure} text-[1.5rem] text-secondary sm:text-[1.75rem]`}>
            <span className="text-foreground">{String(people.length).padStart(2, '0')}</span>/{PERSON_LIMIT}
            <span className="sr-only">명</span>
          </p>
        </div>
        {people.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {!full && (
              <Link href={previewHref('/me/people')} className={s.secondary}>
                <Plus />
                사람 추가
              </Link>
            )}
            <Link href={previewHref('/me/people')} className={s.link}>
              전체 관리
              <Arrow />
            </Link>
          </div>
        )}
      </div>

      {people.length === 0 ? (
        <AddFirst primary={selfId !== null} />
      ) : (
        <ol className="flex flex-col">
          {people.map((person, index) => (
            <Entry key={person.personId} index={index} person={person} selfId={selfId} pair={pairOf(readings, selfId, person)} />
          ))}
        </ol>
      )}
      {full && <p className={s.body}>등록할 수 있는 10명을 다 채웠습니다.</p>}
    </section>
  );
}

function Entry({
  index,
  person,
  selfId,
  pair,
}: {
  index: number;
  person: FixturePerson;
  selfId: string | null;
  pair: ReadingEntry | null;
}) {
  const detailHref = previewHref(`/me/people/${person.personId}`);
  const readingHref = previewHref(`/me/readings/${person.personId}`);
  const compatHref =
    pair === null
      ? previewHref(selfId === null ? `/compat#b.person=${person.personId}` : `/compat#a.person=${selfId}&b.person=${person.personId}`)
      : previewHref(hrefOfReading(pair));
  const note = person.note?.trim() ?? '';
  const { reading } = person;

  return (
    <li
      className={`${s.hair} grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-2 py-4 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:gap-x-6 sm:gap-y-3 sm:py-5 lg:grid-cols-[3.5rem_minmax(0,1fr)_auto_auto] lg:items-center`}
    >
      <span aria-hidden="true" className={`${s.figure} pt-1 text-[1.25rem] leading-none text-secondary sm:text-[1.5rem]`}>
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="flex min-w-0 flex-col sm:gap-1">
        <Link href={detailHref} className={`${s.entry} ${s.title} inline-flex min-h-11 items-center self-start break-all`}>
          {person.local_label}
        </Link>
        {person.chart.ok ? (
          <p className="flex min-w-0 items-center gap-2 text-[0.9375rem] leading-6">
            {reading === null ? (
              <span className="text-secondary">풀이 없음</span>
            ) : (
              <>
                {!reading.fromCurrentChart && <PriorTag />}
                <span className="truncate text-foreground/85">{reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}</span>
              </>
            )}
          </p>
        ) : (
          <p className="text-[0.9375rem] leading-6 text-secondary">{person.chart.message}</p>
        )}
        {note !== '' && <p className="hidden truncate text-xs text-secondary sm:block">{note}</p>}
      </div>

      {person.chart.ok && (
        <div className="col-start-2 sm:col-start-auto sm:row-span-2 sm:self-center lg:row-span-1">
          <Glyphs saju={person.chart.saju} label={person.local_label} />
        </div>
      )}

      <div className="col-start-2 flex flex-wrap items-center gap-x-5 gap-y-1 sm:col-span-1 lg:col-start-4 lg:grid lg:w-[15.5rem] lg:grid-cols-[6.75rem_auto] lg:justify-items-start lg:gap-x-4">
        {person.chart.ok ? (
          <>
            {reading === null ? (
              <Link href={readingHref} className={s.secondary}>
                풀이 받기
              </Link>
            ) : (
              <Link href={readingHref} className={s.link}>
                풀이 보기
              </Link>
            )}
            <Link href={compatHref} className={s.link}>
              {selfId === null ? '궁합' : '나와 궁합'}
              {pair?.score != null && (
                <span className={`${s.figure} text-[1.125rem] font-semibold no-underline`}>
                  {pair.score}
                  <span className="text-xs font-semibold">점</span>
                </span>
              )}
              <Arrow />
            </Link>
          </>
        ) : (
          <Link href={detailHref} className={s.link}>
            자세히
            <Arrow />
          </Link>
        )}
      </div>
    </li>
  );
}

/** 여덟 글자 한 줄 — 잉크 명조, 일주만 밑줄 */
function Glyphs({ saju, label }: { saju: Saju; label: string }) {
  return (
    <p className="-ml-[0.3em] flex items-center" aria-label={`${label}의 네 기둥`}>
      {PILLAR_COLUMNS.map(({ key, label: column }) => {
        const pillar = saju.pillars[key];
        if (pillar === null) {
          return (
            <span key={key} className={`${s.hanja} w-[2.6em] text-center text-base text-secondary sm:text-lg`}>
              <span aria-hidden="true">··</span>
              <span className="sr-only">{HOUR_UNKNOWN_LABEL}</span>
            </span>
          );
        }
        return (
          <span
            key={key}
            className={`${s.hanja} w-[2.6em] text-center text-base leading-8 sm:text-lg ${key === 'day' ? 'border-b-2 border-foreground' : 'border-b-2 border-transparent'}`}
          >
            <span className="sr-only">{column} </span>
            {pillar.stem}
            {pillar.branch}
          </span>
        );
      })}
    </p>
  );
}

/** 사람 0명 — 목차 대신 첫 사람을 부르는 자리 하나 */
function AddFirst({ primary }: { primary: boolean }) {
  return (
    <div className={`${s.hair} grid gap-4 pt-6 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-x-6`}>
      <span aria-hidden="true" className={`${s.figure} hidden text-[1.5rem] leading-none text-secondary sm:block`}>
        01
      </span>
      <div className="flex flex-col items-start gap-4">
        <p className={s.quote}>가족이나 친구의 출생 정보를 저장하고 관리하세요.</p>
        <Link href={previewHref('/me/people')} className={primary ? s.primary : s.secondary}>
          <Plus />
          사람 추가
        </Link>
      </div>
    </div>
  );
}

function Plus() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

/** 나 × 그 사람의 궁합풀이 — 최근 것이 앞이라 처음 만난 것이 가장 최근이다(R 과 같은 규칙) */
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
