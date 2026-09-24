import Link from 'next/link';

import { ELEMENT_KO, STEM_INFO } from '@/src/lib/saju';

import { ELEMENT_TONE } from '../../../../element-tone';
import { PERSON_LIMIT, type FixturePerson } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';

/*
  **사람은 작은 카드의 격자다.**

  저장 목록의 `PersonCard` 는 한 사람이 폰 한 화면 가까이 쓴다 — 열 명이면 홈이 열 화면이 된다. 홈에서는
  「누가 있는가」만 알아보게 하고(일간 타일 · 이름 · 풀이가 있는가), 고치고 빼고 메모하는 일은 지금처럼
  `/me/people` 이 맡는다. 일간 타일은 `ChartSummary` 의 것을 한 치수 줄였다.

  카드 전체가 사람 상세로 가는 링크이고, 「나와 궁합」만 그 위에 따로 선다 — 링크 안에 링크를 넣지 않으려고
  이름 링크를 카드 크기로 편다(`after:inset-0`).
*/

export function PeopleGrid({ people, selfId }: { people: readonly FixturePerson[]; selfId: string | null }) {
  const full = people.length >= PERSON_LIMIT;

  return (
    <section aria-labelledby="a1-people" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="a1-people" className="text-lg font-bold tracking-[-0.03em]">
            저장한 사람
            <span className="ml-2 text-sm font-normal tabular-nums text-muted">
              {people.length}/{PERSON_LIMIT}명
            </span>
          </h2>
        </div>
        <Link
          href={previewHref('/me/people')}
          className="shrink-0 text-sm font-semibold text-secondary hover:text-accent"
        >
          전체 관리 <span aria-hidden="true">→</span>
        </Link>
      </div>

      {people.length === 0 && (
        <p className="text-sm text-muted">아직 저장한 사람이 없습니다. 이름과 출생 정보를 입력해 사람을 추가해 보세요.</p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {people.map((person) => (
          <li key={person.personId} className="min-w-0">
            <PersonTile person={person} selfId={selfId} />
          </li>
        ))}
        <li className="min-w-0">
          {full ? (
            <div className="flex h-full min-h-40 flex-col justify-center gap-1 rounded-[1.75rem] border border-border bg-surface-sunken p-4 text-xs text-muted">
              등록할 수 있는 {PERSON_LIMIT}명을 다 채웠습니다.
            </div>
          ) : (
            <Link
              href={previewHref('/me/people')}
              className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-[1.75rem] border border-dashed border-border-strong bg-surface-soft/60 p-4 text-center hover:border-accent hover:text-accent"
            >
              <span aria-hidden="true" className="grid size-10 place-items-center rounded-full border border-border-strong bg-surface text-xl leading-none">
                +
              </span>
              <span className="text-sm font-semibold">사람 추가</span>
              <span className="text-xs tabular-nums text-muted">
                {people.length}/{PERSON_LIMIT}명
              </span>
            </Link>
          )}
        </li>
      </ul>
    </section>
  );
}

function PersonTile({ person, selfId }: { person: FixturePerson; selfId: string | null }) {
  const { chart, reading } = person;

  return (
    <article className="relative flex h-full min-h-40 min-w-0 flex-col gap-3 rounded-[1.75rem] border border-border bg-surface p-4 shadow-[var(--shadow-card)] hover:border-accent">
      {chart.ok ? (
        <DayMasterTile stem={chart.saju.pillars.dayMaster} />
      ) : (
        <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl border border-border bg-surface-sunken text-lg text-muted">
          ?
        </span>
      )}

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 break-all text-base font-bold leading-snug tracking-[-0.02em]">
          <Link
            href={previewHref(`/me/people/${person.personId}`)}
            className="after:absolute after:inset-0 after:rounded-[1.75rem] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent"
          >
            {person.local_label}
          </Link>
        </h3>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted">
          {!chart.ok ? (
            <span className="line-clamp-2">{chart.message}</span>
          ) : reading === null ? (
            <span className="truncate">아직 풀이 없음</span>
          ) : (
            <>
              <span className="truncate text-accent-strong">풀이 있음</span>
              {!reading.fromCurrentChart && (
                <span className="shrink-0 rounded-full bg-warning-wash px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                  이전 명식
                </span>
              )}
            </>
          )}
        </p>
      </div>

      {chart.ok && selfId !== null && (
        <Link
          href={previewHref(`/compat#a.person=${selfId}&b.person=${person.personId}`)}
          className="relative z-10 inline-flex self-start rounded-full border border-border-strong bg-surface px-3 py-1 text-xs font-semibold hover:border-accent hover:text-accent"
        >
          나와 궁합
        </Link>
      )}
    </article>
  );
}

/** 일간 타일 — `ChartSummary` 의 것(`size-16`)을 격자에 맞춰 줄였다 */
function DayMasterTile({ stem }: { stem: keyof typeof STEM_INFO }) {
  const info = STEM_INFO[stem];
  const tone = ELEMENT_TONE[info.element];
  return (
    <span className="flex items-center gap-2">
      <span
        className={`grid size-12 shrink-0 place-items-center rounded-2xl border ${tone.border} ${tone.surface}`}
        aria-label={`일간 ${stem}, ${info.ko}${ELEMENT_KO[info.element]}`}
      >
        <span className={`glyph text-2xl font-bold leading-none ${tone.text}`} aria-hidden="true">
          {stem}
        </span>
      </span>
      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.surface} ${tone.text}`}>
        {info.ko}{ELEMENT_KO[info.element]}
      </span>
    </span>
  );
}
