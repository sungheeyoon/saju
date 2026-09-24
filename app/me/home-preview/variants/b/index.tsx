import Link from 'next/link';

import type { VariantProps } from '..';
import type { ReadingEntry } from '../../../reading/current';
import { PERSON_LIMIT, type FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { UnreadStrip } from '../../shared/unread-strip';
import { WarningBanner } from '../../shared/warning-banner';
import { MenuMock } from './menu-mock';
import { AddSlot, RelationCard } from './relation-card';
import { MatchingDoor, SelfAnchor, SelfMissing } from './self-anchor';

/**
 * B · 사람 중심형 — **홈의 주인공은 「나와 사람들」이다.**
 *
 * 나는 격자 밖의 기준점(데스크톱은 왼쪽에 붙고, 모바일은 위에 얇게), 저장한 사람은 그 옆의 격자.
 * 사람 카드마다 일간 둘을 나란히 두고 「나와 궁합」이 앞선다. 사람 추가는 격자의 마지막 빈 자리다.
 */
export default function Variant({ state }: VariantProps) {
  const { self, people } = state;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <MenuMock unread={state.unread} unreadChat={state.unreadChat} />
      <WarningBanner notice={state.warning} />
      <UnreadStrip count={state.unread} />

      <div className="grid min-w-0 gap-5 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start lg:gap-7">
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24">
          {self === null ? <SelfMissing /> : <SelfAnchor self={self} />}
          {self !== null && <MatchingDoor />}
        </aside>

        <section aria-labelledby="b-people" className="flex min-w-0 flex-col gap-4">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">나와 사람들</p>
              <h2 id="b-people" className="mt-1 text-2xl font-bold tracking-[-0.04em]">
                저장한 사람
                <span className="ml-2 text-sm font-normal text-muted">
                  {people.length}/{PERSON_LIMIT}명
                </span>
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={previewHref('/compat')}
                className="rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
              >
                궁합 보러 가기
              </Link>
              <Link
                href={previewHref('/')}
                className="rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
              >
                모르는 사람 사주 보기
              </Link>
            </div>
          </header>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {people.map((person) => (
              <RelationCard
                key={person.personId}
                person={person}
                self={self}
                pair={pairOf(state.readings, self, person.personId)}
              />
            ))}
            <AddSlot used={people.length} limit={PERSON_LIMIT} alone={people.length === 0} />
          </div>
        </section>
      </div>
    </div>
  );
}

/** 나 × 그 사람의 궁합풀이 — 풀이 목록에 이미 있는 줄에서 찾는다. 최근 것이 앞이라 첫 줄이다 */
function pairOf(readings: readonly ReadingEntry[], self: FixtureSelf | null, personId: string): ReadingEntry | null {
  if (self === null) return null;
  const ids = new Set([self.personId, personId]);
  return (
    readings.find(
      (entry) =>
        entry.kind === 'private' &&
        entry.personA !== entry.personB &&
        ids.has(entry.personA ?? '') &&
        ids.has(entry.personB ?? ''),
    ) ?? null
  );
}
