import Link from 'next/link';

import type { FixturePerson } from '../../fixtures';
import { PersonCard } from '../../shared/person-card';
import { previewHref } from '../../shared/preview-href';
import { DayMasterMark, EightGlyphs, Fold } from './fold';

/** 사람들이 함께 쓰는 이름 — 같은 이름의 `<details>` 는 하나만 펴진다 */
const PEOPLE_GROUP = 'home-f-person';

const PILL =
  'inline-flex min-h-10 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent';

/**
 * 저장한 사람 한 줄 — 펴면 사람 목록의 카드(`PersonCard`)가 **그 자리에** 선다.
 *
 * 카드 아래 띠가 이미 풀이 받기 · 보기를 들고 있어서, 홈에서 한 번 펴면 풀이까지 닿는다. 카드가 못 드는
 * 길 둘(상세 · 나와의 궁합)만 그 아래 알약으로 붙인다. 내 사주가 없으면 궁합 알약은 안 선다 — 짝이 없다.
 */
export function PersonFold({ person, selfId }: { person: FixturePerson; selfId: string | null }) {
  const { chart } = person;

  return (
    <Fold
      name={PEOPLE_GROUP}
      summary={
        <>
          {chart.ok ? (
            <DayMasterMark saju={chart.saju} />
          ) : (
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-surface-sunken text-muted">
              ?
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-semibold">{person.local_label}</span>
            {chart.ok ? (
              <EightGlyphs saju={chart.saju} />
            ) : (
              <span className="truncate text-xs text-muted">{chart.message}</span>
            )}
          </span>
        </>
      }
    >
      <PersonCard person={person} reading={person.reading} />
      <div className="flex flex-wrap gap-2 px-1">
        <Link href={previewHref(`/me/people/${person.personId}`)} className={PILL}>
          사주 자세히 보기 <span aria-hidden="true">→</span>
        </Link>
        {chart.ok && selfId !== null && (
          <Link href={previewHref(`/compat#a.person=${selfId}&b.person=${person.personId}`)} className={PILL}>
            나와 궁합 보기 <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </Fold>
  );
}
