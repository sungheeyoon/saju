import Link from 'next/link';

import { CALENDAR_KO, ELEMENT_KO, STEM_INFO } from '@/src/lib/saju';

import { ELEMENT_TONE } from '../../../../element-tone';
import type { FixturePerson } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';

/*
  **사람은 카드가 아니라 한 줄이다.** 이 시안은 위의 내 명식 카드를 그대로 두고 사람을 붙이기만 하므로,
  사람까지 카드로 세우면 열 명일 때 홈이 사람 목록 화면이 된다. 다섯까지 보이고 나머지는 `<details>` 에 접힌다.

  줄 전체가 사람 상세로 가는 링크이고(이름 링크를 줄 전체로 편다), 「나와 궁합」 · 「풀이」는 그 위에 따로 선다 —
  링크 안에 링크를 넣지 않으려는 것이다.
*/

const VISIBLE = 5;

export function PeopleRows({
  people,
  selfPersonId,
  limit,
}: {
  people: readonly FixturePerson[];
  /** 내 사주가 없으면 「나와 궁합」을 안 세운다 — 나 없이 나와의 궁합은 없다 */
  selfPersonId: string | null;
  limit: number;
}) {
  const shown = people.slice(0, VISIBLE);
  const folded = people.slice(VISIBLE);
  const full = people.length >= limit;

  return (
    <section className="flex flex-col gap-3 rounded-[1.75rem] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-bold tracking-[-0.02em]">저장한 사람</h2>
          <span className="text-sm tabular-nums text-muted">
            {people.length}/{limit}명
          </span>
        </div>
        {full ? (
          <span className="text-xs text-muted">등록할 수 있는 {limit}명을 다 채웠습니다.</span>
        ) : (
          <Link
            href={previewHref('/me/people')}
            className="rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent"
          >
            사람 추가
          </Link>
        )}
      </header>

      {people.length === 0 ? (
        <p className="rounded-2xl bg-surface-sunken px-4 py-5 text-sm text-muted">
          가족이나 친구의 출생 정보를 저장하고 관리하세요.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {shown.map((person) => (
            <PersonRow key={person.personId} person={person} selfPersonId={selfPersonId} />
          ))}
        </ul>
      )}

      {folded.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-1 rounded-xl py-2 text-sm font-semibold text-secondary hover:text-accent [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">{folded.length}명 더 보기</span>
            <span className="hidden group-open:inline">접기</span>
          </summary>
          <ul className="flex flex-col divide-y divide-border border-t border-border">
            {folded.map((person) => (
              <PersonRow key={person.personId} person={person} selfPersonId={selfPersonId} />
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
        <Link href={previewHref('/')} className="font-semibold text-secondary hover:text-accent">
          모르는 사람 사주 보기 <span aria-hidden="true">→</span>
        </Link>
        <Link href={previewHref('/compat')} className="font-semibold text-secondary hover:text-accent">
          궁합 보러 가기 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

function PersonRow({ person, selfPersonId }: { person: FixturePerson; selfPersonId: string | null }) {
  const { chart } = person;

  return (
    <li className="relative flex min-w-0 items-center gap-3 py-3">
      <DayGlyph person={person} />

      <div className="min-w-0 flex-1">
        <Link
          href={previewHref(`/me/people/${person.personId}`)}
          className="block truncate font-semibold after:absolute after:inset-0 after:content-[''] hover:text-accent"
        >
          {person.local_label}
        </Link>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
          {chart.ok ? (
            <span className="truncate">
              {chart.query.calendar === 'solar' ? '' : `${CALENDAR_KO[chart.query.calendar]} `}
              {chart.query.date.replaceAll('-', '.')}
            </span>
          ) : (
            <span className="truncate">{chart.message}</span>
          )}
          {chart.ok && <StatusChip reading={person.reading} />}
        </p>
      </div>

      {chart.ok && (
        <div className="relative z-10 flex shrink-0 items-center gap-1.5">
          {selfPersonId !== null && (
            <Link
              href={previewHref(`/compat#a.person=${selfPersonId}&b.person=${person.personId}`)}
              className="whitespace-nowrap rounded-full border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-semibold hover:border-accent hover:text-accent"
            >
              나와 궁합
            </Link>
          )}
          <Link
            href={previewHref(`/me/readings/${person.personId}`)}
            className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-semibold ${
              person.reading === null
                ? 'bg-accent text-on-accent hover:bg-accent-strong'
                : 'border border-accent/25 bg-accent-wash text-accent-strong hover:border-accent'
            }`}
          >
            풀이
          </Link>
        </div>
      )}
    </li>
  );
}

function DayGlyph({ person }: { person: FixturePerson }) {
  if (!person.chart.ok) {
    return (
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-surface-sunken text-sm text-muted"
      >
        ?
      </span>
    );
  }

  const stem = person.chart.saju.pillars.dayMaster;
  const info = STEM_INFO[stem];
  const tone = ELEMENT_TONE[info.element];
  return (
    <span
      className={`grid size-10 shrink-0 place-items-center rounded-xl border ${tone.border} ${tone.surface}`}
      aria-label={`일간 ${stem}, ${info.ko}${ELEMENT_KO[info.element]}`}
    >
      <span className={`glyph text-xl font-bold leading-none ${tone.text}`} aria-hidden="true">
        {stem}
      </span>
    </span>
  );
}

/** 풀이 상태 — 없음 · 있음 · 이전 명식. 「이전 명식」은 풀이 목록의 칩과 같은 모양이다 */
function StatusChip({ reading }: { reading: FixturePerson['reading'] }) {
  if (reading === null) {
    return (
      <span className="shrink-0 rounded-full bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold text-muted">
        풀이 전
      </span>
    );
  }
  if (!reading.fromCurrentChart) {
    return (
      <span className="shrink-0 rounded-full bg-warning-wash px-1.5 py-0.5 text-[10px] font-semibold text-warning">
        이전 명식
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-accent-wash px-1.5 py-0.5 text-[10px] font-semibold text-accent-strong">
      풀이 있음
    </span>
  );
}
