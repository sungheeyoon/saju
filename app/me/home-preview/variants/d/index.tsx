import Link from 'next/link';

import type { VariantProps } from '..';
import { previewHref } from '../../shared/preview-href';
import { UnreadStrip } from '../../shared/unread-strip';
import { WarningBanner } from '../../shared/warning-banner';
import { MenuMock } from './menu-mock';
import { NextReadings, PeopleRow } from './people-row';
import { RecentReadings } from './recent-readings';
import { FirstReading, RegisterCard, SelfCard } from './self-card';

/**
 * D · 최근 풀이 중심형 — **돌아온 사람이 읽던 것을 이어 읽는 홈.**
 *
 * 차례가 곧 무게다: 나(작게) → 최근 풀이(주인공) → 아직 풀이가 없는 사람 → 사람 얼굴 줄 → 다른 길.
 * 풀이가 하나도 없으면 최근 풀이 자리에 첫 풀이로 이끄는 카드가 선다 — 빈 목록을 세우지 않는다.
 */
export default function Variant({ state }: VariantProps) {
  const { self, people, readings } = state;
  const empty = readings.length === 0;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <MenuMock unread={state.unread} unreadChat={state.unreadChat} />
      <WarningBanner notice={state.warning} />
      <UnreadStrip count={state.unread} />

      {empty ? (
        <>
          {self !== null && <SelfCard self={self} />}
          <FirstReading self={self} />
        </>
      ) : (
        <>
          {self !== null ? <SelfCard self={self} /> : <RegisterCard />}
          <RecentReadings readings={readings} />
        </>
      )}

      <NextReadings people={people} />
      <PeopleRow people={people} selfId={self?.personId ?? null} />

      <div className="grid gap-3 sm:grid-cols-2">
        {/* 매칭은 내 사주가 있어야 선다 — 지금 `/me` 도 등록 전에는 이 길을 안 세운다 */}
        {self !== null && (
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
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface px-5 py-4 text-sm">
          <Link
            href={previewHref('/')}
            className="flex items-center justify-between gap-3 font-semibold hover:text-accent"
          >
            모르는 사람 사주 보기 <span aria-hidden="true">→</span>
          </Link>
          <Link
            href={previewHref('/compat')}
            className="flex items-center justify-between gap-3 font-semibold hover:text-accent"
          >
            궁합 보러 가기 <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
