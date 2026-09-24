import Link from 'next/link';

import type { VariantProps } from '..';
import { PERSON_LIMIT } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { ReadingRow } from '../../shared/reading-row';
import { UnreadStrip } from '../../shared/unread-strip';
import { WarningBanner } from '../../shared/warning-banner';
import { Fold } from './fold';
import { MenuMock } from './menu-mock';
import { PersonFold } from './person-fold';
import { SelfFold, SelfMissing } from './self-fold';

const PILL =
  'inline-flex min-h-10 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent';

/**
 * F · 점진적 공개형 — **처음엔 한 줄씩만, 누르면 그 자리에서 펴진다.**
 *
 * 묻는 것: 상세 화면으로 가지 않고도 홈에서 대부분이 끝나는가. 펴면 서는 것은 새로 그린 요약이 아니라
 * 지금 화면의 카드(`PillarCard` · `PersonCard`) 그대로다 — 홈이 목록과 상세 사이의 한 겹을 삼킨다.
 */
export default function Variant({ state }: VariantProps) {
  const { self, people, readings } = state;
  const full = people.length >= PERSON_LIMIT;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <MenuMock unread={state.unread} unreadChat={state.unreadChat} />

      <WarningBanner notice={state.warning} />
      <UnreadStrip count={state.unread} />

      {self === null ? <SelfMissing /> : <SelfFold self={self} />}

      <section aria-labelledby="home-f-people" className="flex min-w-0 flex-col gap-3">
        <header className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="eyebrow">사람</p>
            <h2 id="home-f-people" className="mt-0.5 text-lg font-bold tracking-[-0.03em]">
              저장한 사람
              <span className="ml-2 text-sm font-normal text-muted">
                {people.length}/{PERSON_LIMIT}명
              </span>
            </h2>
          </div>
          {!full && (
            <Link href={previewHref('/me/people')} className={PILL}>
              사람 추가
            </Link>
          )}
        </header>

        {people.length === 0 ? (
          <p className="rounded-[1.75rem] border border-border bg-surface-sunken p-5 text-sm text-muted">
            아직 저장한 사람이 없습니다. 이름과 출생 정보를 입력해 사람을 추가해 보세요.
          </p>
        ) : (
          <div className="flex min-w-0 flex-col gap-2">
            {people.map((person) => (
              <PersonFold key={person.personId} person={person} selfId={self?.personId ?? null} />
            ))}
          </div>
        )}

        {full && (
          <p className="rounded-[1.75rem] border border-border bg-surface-sunken p-5 text-sm text-muted">
            등록할 수 있는 {PERSON_LIMIT}명을 다 채웠습니다. 목록에서 누군가를 빼면 다시 등록할 수 있습니다.
          </p>
        )}
      </section>

      {readings.length > 0 && (
        <Fold
          summary={
            <span className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="font-semibold">만든 풀이</span>
              <span className="text-sm text-muted">{readings.length}</span>
            </span>
          }
        >
          <div className="flex min-w-0 flex-col gap-2">
            {readings.map((entry) => (
              <ReadingRow key={`${entry.kind}-${entry.createdAt}`} entry={entry} />
            ))}
          </div>
        </Fold>
      )}

      {self !== null && (
        <Link
          href={previewHref('/me/matching')}
          className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-accent-wash px-5 py-4 text-sm text-accent"
        >
          <span>
            <strong className="block font-semibold">매칭에서 오늘의 인연 만나기</strong>
            <span className="mt-1 block text-xs text-secondary">예측 궁합과 보완하는 기운으로, 나의 귀인을 찾아보세요.</span>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={previewHref('/')} className={PILL}>
          저장하지 않고 사주 보기 <span aria-hidden="true">→</span>
        </Link>
        <Link href={previewHref('/compat')} className={PILL}>
          궁합 보러 가기 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
