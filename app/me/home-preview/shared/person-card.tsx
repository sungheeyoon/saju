import Link from 'next/link';

import { BRANCH_INFO, CALENDAR_KO, ELEMENT_KO, GENDER_KO, STEM_INFO, type Saju } from '@/src/lib/saju';
import { isoOf, solarDateOf } from '@/src/lib/input/chart';
import { HOUR_UNKNOWN_LABEL, type Query } from '@/src/lib/input/query';
import { UNREADABLE_INPUT_NOTE } from '@/src/lib/input/stored';

import type { ReadingEntry } from '../../reading/current';
import { ELEMENT_TONE } from '../../../element-tone';
import { PILLAR_COLUMNS } from '../../../saju/shared';
import type { FixturePerson } from '../fixtures';
import { previewHref } from './preview-href';

/*
  **저장한 사람 카드의 사본이다** — `app/me/people/page.tsx` 의 `PersonCard` · `ReadingAction` ·
  `ChartSummary` 를 모양 그대로 옮겼다. 원본은 내보내지 않는 함수라 가져올 수 없고, 원본을 고치지 않는
  라운드다. 다른 점은 둘뿐이다: 관리 메뉴(`PersonActions`)는 서버 액션을 부르므로 모양만 선 단추로 바꿨고,
  링크는 실제 화면으로 가지 않는다(가짜 사람이라 열 화면이 없다). 시안을 고르면 이 파일은 지운다.
*/

type Person = FixturePerson;

export function PersonCard({ person, reading }: { person: Person; reading: ReadingEntry | null }) {
  /** 적어 둔 메모는 **카드가 직접 보인다** — 여는 버튼 이름으로만 말하면 접힌 것이 빈 것이 된다 */
  const note = person.note?.trim() ?? '';

  return (
    <section className="relative rounded-[1.75rem] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="relative p-5 sm:p-6">
        {person.chart.ok ? (
          <ChartSummary query={person.chart.query} saju={person.chart.saju} />
        ) : (
          <div className="flex flex-col gap-1 pr-12">
            <p className="eyebrow">저장한 사람</p>
            <h2 className="text-xl font-bold tracking-[-0.03em]">{person.local_label}</h2>
            <p className="mt-2 text-sm">{person.chart.message}</p>
            <p className="text-xs text-muted">{UNREADABLE_INPUT_NOTE}</p>
          </div>
        )}

        {note !== '' && (
          <p className="mt-5 rounded-2xl border border-border bg-surface-soft/60 px-4 py-3 text-sm text-secondary">
            <span className="mr-2 text-xs font-semibold tracking-[0.08em] text-muted">메모</span>
            {note}
          </p>
        )}

        {/* 관리 메뉴 자리 — 원본은 서버 액션을 부르는 `PersonActions` 다. 여기서는 모양만 선다 */}
        <span
          aria-hidden="true"
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-border bg-surface text-muted sm:right-5 sm:top-5"
        >
          ⋯
        </span>
      </div>

      {person.chart.ok && (
        <div className="min-w-0 rounded-b-[1.75rem] border-t border-border bg-surface-soft/70 p-3 sm:p-4">
          <ReadingAction personId={person.personId} reading={reading} />
        </div>
      )}
    </section>
  );
}

/**
 * 그 사람의 사주풀이 — **목록에서 한 줄로 읽고, 누르면 글로 간다**(ADR 0033 의 결).
 *
 * 만든 글에 닿으려면 사주 상세를 한 겹 지나야 했다. 카드가 그 사람의 표지라면 그 사람의
 * 글이 있는지도 표지가 말해야 한다 — 없으면 사용자는 매번 눌러 봐야 안다.
 *
 * **본문은 안 싣는다.** 서는 것은 비유 한 줄과 가는 길뿐이고, 글이 사는 자리는 여전히
 * 그 사람의 화면 하나다 — 결과가 두 곳에 서면 「무엇이 나가는가」의 답이 둘이 된다.
 * 옛 글에는 비유가 없어서(`null`) 그때는 이어 읽을 수 있다는 안내가 대신 선다.
 */
export function ReadingAction({
  personId,
  reading,
}: {
  personId: string;
  reading: ReadingEntry | null;
}) {
  if (reading === null) {
    return (
      <Link
        href={previewHref(`/me/readings/${personId}`)}
        className="group flex min-h-[4.75rem] w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl bg-accent px-4 py-3 text-on-accent shadow-sm hover:bg-accent-strong"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/14">
          <CardActionIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">사주풀이 받기</span>
          <span className="mt-0.5 line-clamp-2 block text-xs text-on-accent/75">기질과 삶의 흐름을 읽어보세요</span>
        </span>
        <span className="shrink-0 text-sm text-on-accent/70 group-hover:translate-x-0.5 group-hover:text-on-accent" aria-hidden="true">→</span>
      </Link>
    );
  }

  return (
    <Link
      href={previewHref(`/me/readings/${personId}`)}
      className="group flex min-h-[4.75rem] w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-accent/25 bg-accent-wash px-4 py-3 hover:border-accent"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-accent shadow-sm">
        <CardActionIcon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-bold text-accent-strong">사주풀이 보기</span>
          {!reading.fromCurrentChart && (
            <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted">이전 명식</span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-secondary">
          {reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}
        </span>
      </span>
      <span className="shrink-0 text-sm text-accent group-hover:translate-x-0.5" aria-hidden="true">→</span>
    </Link>
  );
}

export function CardActionIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[1.15rem] fill-none stroke-current"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <>
        <path d="M5 5.5c2.8-.7 5-.1 7 1.5v12c-2-1.6-4.2-2.2-7-1.5Z" />
        <path d="M19 5.5c-2.8-.7-5-.1-7 1.5v12c2-1.6 4.2-2.2 7-1.5Z" />
      </>
    </svg>
  );
}

/**
 * 저장 목록의 한 사람 — **작은 원국 결과가 아니라 사람을 다시 찾는 표지**로 그린다.
 *
 * 여덟 글자를 한 줄짜리 표로만 두면 궁합의 두 사람 카드와 같은 모양이 된다. 여기서는
 * 이름과 일간을 먼저 읽고, 네 기둥은 그 사람을 알아보는 두 번째 단서로 묶는다. 자세한
 * 해석은 눌러 들어간 화면의 `PillarChart` 가 맡는다.
 */
export function ChartSummary({ query, saju }: { query: Query; saju: Saju }) {
  const { pillars } = saju;
  const dayMaster = STEM_INFO[pillars.dayMaster];
  const dayTone = ELEMENT_TONE[dayMaster.element];

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)] md:items-center md:gap-8">
      <div className="flex items-start gap-4">
        {/*
          **일간은 그 글자 아래에 붙는다.** 오른쪽 위에 따로 세웠더니 같은 한 가지를
          카드의 두 끝이 나눠 말했고, 그 자리는 이제 관리 메뉴가 쓴다.
        */}
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <div
            className={`grid size-16 place-items-center rounded-2xl border ${dayTone.border} ${dayTone.surface}`}
            aria-label={`일간 ${pillars.dayMaster}, ${dayMaster.ko}${ELEMENT_KO[dayMaster.element]}`}
          >
            <span className={`glyph text-[2rem] font-bold leading-none ${dayTone.text}`} aria-hidden="true">
              {pillars.dayMaster}
            </span>
          </div>
          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${dayTone.surface} ${dayTone.text}`}>
            {dayMaster.ko}{ELEMENT_KO[dayMaster.element]} 일간
          </span>
        </div>

        <div className="min-w-0 flex-1 pt-0.5 pr-12">
          <div>
            <p className="eyebrow">저장한 사람</p>
            <h2 className="mt-0.5 text-xl font-bold tracking-[-0.03em]">{query.name}</h2>
          </div>
          <p className="mt-1.5 text-sm text-secondary">
            {query.calendar === 'solar'
              ? query.date
              : `${CALENDAR_KO[query.calendar]} ${query.date}`}
            {query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` · ${query.time}`}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {GENDER_KO[query.gender]} · {query.city}
          </p>
        </div>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-x-1.5 text-center sm:border-spacing-x-2">
        <caption className="sr-only">{query.name}의 시주, 일주, 월주, 년주</caption>
        <thead>
          <tr className="text-xs text-muted">
            {PILLAR_COLUMNS.map(({ key, label }) => (
              <th key={key} className={`pb-1.5 font-medium ${key === 'day' ? 'text-accent' : ''}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {PILLAR_COLUMNS.map(({ key, label }) => {
              const pillar = pillars[key];
              if (pillar === null) {
                return (
                  <td key={key} className="rounded-xl bg-surface-sunken px-1 py-3 text-xs text-muted">
                    {HOUR_UNKNOWN_LABEL}
                  </td>
                );
              }

              const stemTone = ELEMENT_TONE[STEM_INFO[pillar.stem].element];
              const branchTone = ELEMENT_TONE[BRANCH_INFO[pillar.branch].element];
              return (
                <td
                  key={key}
                  aria-label={`${label} ${pillar.name}`}
                  className={`rounded-xl border px-1 py-2.5 ${
                    key === 'day' ? 'border-accent/30 bg-accent-wash/50' : 'border-border bg-surface-soft'
                  }`}
                >
                  <span className={`glyph text-2xl font-semibold ${stemTone.text}`}>{pillar.stem}</span>
                  <span className={`glyph text-2xl font-semibold ${branchTone.text}`}>{pillar.branch}</span>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>

      {query.calendar !== 'solar' && (
        <p className="-mt-2 text-xs text-muted">계산에 쓴 양력 날짜 · {isoOf(solarDateOf(query))}</p>
      )}
    </div>
  );
}

