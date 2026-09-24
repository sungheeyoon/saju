import Link from 'next/link';

import { PERSON_LIMIT, type FixturePerson } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { DayStem } from './action-tiles';

/**
 * 저장한 사람 — **칩 한 줄.** 이름과 일간 한 글자만 서고, 누르면 그 사람의 상세로 간다.
 *
 * 이 시안에서 사람은 행동의 목적어다. 카드(`PersonCard`)를 세우면 열 명이 화면 여러 장을 먹고 타일이 밀려난다.
 * 명식 · 메모 · 풀이는 상세가 든다.
 */
export function PeopleChips({ people }: { people: readonly FixturePerson[] }) {
  return (
    <section aria-labelledby="c-people" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 id="c-people" className="text-base font-bold tracking-[-0.03em]">
          저장한 사람
          <span className="ml-2 text-sm font-normal text-muted">
            {people.length}/{PERSON_LIMIT}명
          </span>
        </h2>
        {people.length > 0 && (
          <Link
            href={previewHref('/me/people')}
            className="shrink-0 text-sm font-semibold text-accent hover:text-accent-strong"
          >
            전체 보기 <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>

      {people.length === 0 ? (
        <p className="rounded-[1.75rem] border border-border bg-surface-sunken p-5 text-sm text-muted">
          아직 저장한 사람이 없습니다. 이름과 출생 정보를 입력해 사람을 추가해 보세요.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {people.map((person) => (
            <li key={person.personId} className="min-w-0 max-w-full">
              <Link
                href={previewHref(`/me/people/${person.personId}`)}
                className={`flex min-w-0 items-center gap-1.5 rounded-full border bg-surface py-1.5 pr-3.5 text-sm font-semibold hover:border-accent hover:text-accent ${
                  person.chart.ok ? 'border-border-strong pl-1.5' : 'border-dashed border-border-strong pl-3.5 text-muted'
                }`}
              >
                <DayStem person={person} />
                <span className="truncate">{person.local_label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
