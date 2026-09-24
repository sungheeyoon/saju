import Link from 'next/link';

import { ELEMENT_TONE } from '../../../../element-tone';
import type { OrbitPerson } from './model';
import { BUTTON } from './ui';

/*
  **지도 아래의 목록 — 링크만으로 모든 사람의 길이 서는 기본 경로.**

  지도는 고르는 자리이고 행동은 판에 열린다. 자바스크립트가 늦거나 없으면 판이 안 바뀌므로, 사람마다
  「풀이」와 「궁합」을 이 줄이 링크로 든다. 이름을 누르면 상세로 간다. 줄은 44px 단추 둘이 한 줄에 서도록
  이름을 먼저 줄인다 — 360px 에서 열두 자 이름이 단추를 밀어내지 않게.
*/

export function PeopleList({
  people,
  hasSelf,
  copy,
}: {
  people: OrbitPerson[];
  hasSelf: boolean;
  copy: { reading: string; compat: string; noReading: string; oldChart: string };
}) {
  return (
    <ol className="grid gap-px overflow-hidden rounded-[1.5rem] border border-border bg-border md:grid-cols-2">
      {people.map((person) => {
        const tone = person.day === null ? null : ELEMENT_TONE[person.day.element];
        return (
          <li key={person.id} className="flex min-w-0 items-center gap-3 bg-surface px-3 py-2.5 sm:px-4">
            <span
              role="img"
              aria-label={person.day?.spoken ?? person.unreadable ?? ''}
              className={`grid size-11 shrink-0 place-items-center rounded-full border-2 ${
                tone === null ? 'border-dashed border-border-strong bg-surface-sunken text-muted' : `${tone.border} ${tone.surface} ${tone.text}`
              }`}
            >
              <span aria-hidden="true" className="glyph text-lg font-bold leading-none dark:brightness-[1.45]">
                {person.day?.stem ?? '?'}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={person.detailHref}
                className="block truncate rounded text-[15px] font-semibold hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {person.label}
              </Link>
              <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                {person.reading !== null && !person.reading.current && (
                  <span className="shrink-0 rounded-full bg-warning-wash px-1.5 py-px text-[11px] font-bold text-warning">{copy.oldChart}</span>
                )}
                <span className="truncate">
                  {person.unreadable ?? (person.reading === null ? copy.noReading : person.reading.metaphor ?? '')}
                </span>
              </p>
            </div>
            {person.cells !== null && (
              <div className="flex shrink-0 items-center gap-1.5">
                <Link href={person.readingHref} className={BUTTON.compact}>
                  {copy.reading}
                </Link>
                <Link href={person.compat.href} className={BUTTON.compact}>
                  {copy.compat}
                  {hasSelf && person.compat.score !== null && (
                    <span className="tabular-nums text-accent">{person.compat.score}점</span>
                  )}
                </Link>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
