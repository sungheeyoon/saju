import Link from 'next/link';

import { ELEMENT_KO, STEM_INFO } from '@/src/lib/saju';

import { ELEMENT_TONE } from '../../../../element-tone';
import { PERSON_LIMIT, type FixturePerson } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';

/*
  **사람은 아래의 얼굴 줄이다.** 이 시안에서 사람은 풀이를 여는 두 번째 입구라 카드 대신 일간 글자 원 하나로 선다.
  넘치면 줄을 바꾼다 — 가로 스크롤 칸을 두면 360px 에서 페이지째 밀리기 쉽다.
*/

export function PeopleRow({ people, selfId }: { people: readonly FixturePerson[]; selfId: string | null }) {
  const full = people.length >= PERSON_LIMIT;
  const pairable = selfId === null ? [] : people.filter((person) => person.chart.ok);

  return (
    <section aria-labelledby="d-people" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 id="d-people" className="text-base font-semibold">
          저장한 사람
          <span className="ml-2 text-sm font-normal text-muted">
            {people.length}/{PERSON_LIMIT}명
          </span>
        </h2>
        <Link
          href={previewHref('/me/people')}
          className="shrink-0 text-sm font-semibold text-accent hover:text-accent-strong"
        >
          사람 전체 보기 <span aria-hidden="true">→</span>
        </Link>
      </div>

      {people.length === 0 && (
        <p className="rounded-[1.75rem] border border-border bg-surface-sunken p-5 text-sm text-muted">
          아직 저장한 사람이 없습니다. 이름과 출생 정보를 입력해 사람을 추가해 보세요.
        </p>
      )}

      <ul className="flex flex-wrap gap-x-3 gap-y-4">
        {people.map((person) => (
          <li key={person.personId}>
            <PersonAvatar person={person} />
          </li>
        ))}
        {!full && (
          <li>
            <Link href={previewHref('/me/people')} className="group flex w-16 flex-col items-center gap-1.5">
              <span className="grid size-14 place-items-center rounded-full border border-dashed border-border-strong bg-surface text-2xl text-muted group-hover:border-accent group-hover:text-accent">
                +
              </span>
              <span className="text-xs font-semibold text-muted group-hover:text-accent">사람 추가</span>
            </Link>
          </li>
        )}
      </ul>

      {/* 나 × 그 사람 궁합 — 펴서 고르면 두 칸이 채워진 채 궁합이 열린다 */}
      {selfId !== null && pairable.length > 0 && (
        <details className="rounded-2xl border border-border bg-surface px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold">나와 궁합 보기</summary>
          <ul className="mt-3 flex flex-wrap gap-2">
            {pairable.map((person) => (
              <li key={person.personId} className="min-w-0 max-w-full">
                <Link
                  href={previewHref(`/compat#a.person=${selfId}&b.person=${person.personId}`)}
                  className="block truncate rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent"
                >
                  {person.local_label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function PersonAvatar({ person }: { person: FixturePerson }) {
  if (!person.chart.ok) {
    return (
      <Link
        href={previewHref(`/me/people/${person.personId}`)}
        className="group flex w-16 flex-col items-center gap-1.5"
      >
        <span
          className="grid size-14 place-items-center rounded-full border border-border bg-surface-sunken text-lg font-bold text-muted group-hover:border-accent"
          aria-label="명식을 읽지 못함"
        >
          ?
        </span>
        <span className="w-full truncate text-center text-xs font-semibold group-hover:text-accent">
          {person.local_label}
        </span>
      </Link>
    );
  }

  const stem = person.chart.saju.pillars.dayMaster;
  const info = STEM_INFO[stem];
  const tone = ELEMENT_TONE[info.element];

  return (
    <Link href={previewHref(`/me/people/${person.personId}`)} className="group flex w-16 flex-col items-center gap-1.5">
      <span
        className={`grid size-14 place-items-center rounded-full border ${tone.border} ${tone.surface} group-hover:border-accent`}
        aria-label={`일간 ${stem}, ${info.ko}${ELEMENT_KO[info.element]}`}
      >
        <span className={`glyph text-2xl font-bold leading-none ${tone.text}`} aria-hidden="true">
          {stem}
        </span>
      </span>
      <span
        className="w-full truncate text-center text-xs font-semibold group-hover:text-accent"
        title={person.local_label}
      >
        {person.local_label}
      </span>
    </Link>
  );
}

/**
 * 아직 풀이가 없는 사람 — 이 홈이 「다음에 읽을 것」을 권하는 자리.
 * 못 읽는 명식에는 풀이를 권하지 않는다(사람 카드도 그때 풀이 띠를 안 세운다).
 */
export function NextReadings({ people }: { people: readonly FixturePerson[] }) {
  const waiting = people.filter((person) => person.chart.ok && person.reading === null).slice(0, 2);
  if (waiting.length === 0) return null;

  return (
    <section aria-labelledby="d-next" className="flex flex-col gap-2">
      <h2 id="d-next" className="text-sm font-semibold text-secondary">
        아직 풀이가 없는 사람
      </h2>
      <ul className="flex flex-col gap-2">
        {waiting.map((person) => (
          <li key={person.personId}>
            <Link
              href={previewHref(`/me/readings/${person.personId}`)}
              className="flex items-center gap-3 rounded-xl border border-border-strong bg-surface px-4 py-3 text-sm hover:border-accent hover:text-accent"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{person.local_label} 사주</span>
              <span className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-on-accent">
                사주풀이 받기
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
