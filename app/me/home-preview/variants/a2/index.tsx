import Link from 'next/link';

import type { VariantProps } from '..';
import { PERSON_LIMIT } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { UnreadStrip } from '../../shared/unread-strip';
import { WarningBanner } from '../../shared/warning-banner';
import { MenuMock } from './menu-mock';
import { PeopleRows } from './people-rows';
import { SelfCard, SelfOnboardingDoor } from './self-card';

/**
 * A2 · 통합 홈 명식형 — **지금 `/me` 를 거의 안 바꾸고 사람만 붙이면 충분한가.**
 *
 * 위는 지금 홈 그대로다(탭 · 명식 카드 · 「사주 자세히 보기」). 그 아래에 저장한 사람이 한 줄씩 서고,
 * 매칭으로 가는 띠가 맨 끝에 남는다.
 */
export default function Variant({ state }: VariantProps) {
  return (
    <div className="flex min-w-0 flex-col gap-7">
      <MenuMock unread={state.unread} unreadChat={state.unreadChat} />
      <WarningBanner notice={state.warning} />

      <header className="flex flex-col gap-2 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-[-0.04em]">나의 사주와 인연</h1>
        <p className="text-sm text-secondary">저장한 사주를 확인하고 오늘의 인연을 만나보세요.</p>
      </header>

      <UnreadStrip count={state.unread} />
      {state.self === null ? <SelfOnboardingDoor /> : <SelfCard self={state.self} />}

      <PeopleRows people={state.people} selfPersonId={state.self?.personId ?? null} limit={PERSON_LIMIT} />

      {state.self !== null && (
        <Link
          href={previewHref('/me/matching')}
          className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-accent-wash px-5 py-4 text-sm text-accent"
        >
          <span>
            <strong className="block font-semibold">매칭에서 오늘의 인연 만나기</strong>
            <span className="mt-1 block text-xs text-secondary">
              예측 궁합과 보완하는 기운으로, 나의 귀인을 찾아보세요.
            </span>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
