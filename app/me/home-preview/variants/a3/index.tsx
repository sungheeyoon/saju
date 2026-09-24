import Link from 'next/link';

import type { VariantProps } from '..';
import { previewHref } from '../../shared/preview-href';
import { UnreadStrip } from '../../shared/unread-strip';
import { WarningBanner } from '../../shared/warning-banner';
import { MenuMock } from './menu-mock';
import { PeopleSection } from './people-section';
import { SelfCard, SelfOnboardingCard } from './self-card';

/**
 * **A3 · 통합 홈 전체 사람형** — `/me/people` 을 홈에 합친다.
 *
 * 묻는 것은 하나다: 사람 화면을 따로 둘 필요가 있나. 저장 자리가 열이라 열 장이 다 들어간다는 가설이고,
 * 그래서 카드는 원본 그대로 열 장까지 선다. 차례는 경고 · 소식 · 나 · 저장한 사람 · 그 밖의 길.
 * 내 사주가 없어도 목록은 선다 — 원본 `/me/people` 도 온보딩 중에 목록을 세운다.
 */
export default function Variant({ state }: VariantProps) {
  return (
    <div className="flex min-w-0 flex-col gap-7">
      <MenuMock unread={state.unread} unreadChat={state.unreadChat} />

      <WarningBanner notice={state.warning} />
      <UnreadStrip count={state.unread} />

      <header className="flex flex-col gap-2 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-[-0.04em]">나의 사주와 인연</h1>
        <p className="text-sm text-secondary">저장한 사주를 확인하고 오늘의 인연을 만나보세요.</p>
      </header>

      {state.self === null ? <SelfOnboardingCard /> : <SelfCard self={state.self} />}

      <PeopleSection people={state.people} />

      {/* 목록 뒤의 길 둘 — 매칭은 원본 홈의 띠 그대로, 모르는 사람 사주는 메뉴에서 빠진 「사주·궁합」 자리 */}
      <div className="flex flex-col gap-3 border-t border-border pt-6">
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
        <Link
          href={previewHref('/')}
          className="flex items-center justify-between gap-3 rounded-2xl border border-border-strong bg-surface px-5 py-3 text-sm font-semibold hover:border-accent hover:text-accent"
        >
          <span>저장하지 않고 사주 보기</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
