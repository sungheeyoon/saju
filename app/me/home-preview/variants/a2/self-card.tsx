import Link from 'next/link';

import { isoOf, solarDateOf } from '@/src/lib/input/chart';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';
import { CALENDAR_KO, GENDER_KO } from '@/src/lib/saju';

import { PillarCard } from '../../../pillar-card';
import { ReadingTabs } from '../../../reading-tabs';
import type { FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';

/*
  **지금 `/me` 의 `SelfChart` 를 거의 그대로 옮겼다** — 탭 · 명식 카드 · 저장된 출생 정보 · 「사주 자세히
  보기」 띠. 다른 점은 둘이다: 고치는 손잡이(`EditInput`)는 서버 액션이라 모양만 선 자리가 되고, 링크는
  `previewHref` 로 가지 않는다.
*/
export function SelfCard({ self }: { self: FixtureSelf }) {
  const { query, saju } = self;

  return (
    <section className="flex min-w-0 flex-col gap-6">
      <ReadingTabs
        current="chart"
        chartHref={previewHref('/me')}
        readingHref={previewHref('/me/readings/self')}
        label="내 사주"
      />
      <PillarCard
        label={self.label}
        saju={saju}
        corner={
          <span
            aria-hidden="true"
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-border bg-surface text-muted sm:right-5 sm:top-5"
          >
            ✎
          </span>
        }
        details={
          <section className="mt-5 rounded-2xl border border-border bg-surface-soft/60 px-4 py-3">
            <h3 className="text-xs font-semibold tracking-[0.08em] text-muted">저장된 출생 정보</h3>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-sm">
              <dt className="text-muted">생년월일</dt>
              <dd>
                {query.calendar === 'solar'
                  ? query.date
                  : `${CALENDAR_KO[query.calendar]} ${query.date} · 양력 ${isoOf(solarDateOf(query))}`}
                {query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` ${query.time}`}
              </dd>
              <dt className="text-muted">성별</dt>
              <dd>{GENDER_KO[query.gender]}</dd>
              <dt className="text-muted">출생지</dt>
              <dd>{query.city}</dd>
              <dt className="text-muted">자시 규칙</dt>
              <dd>{query.rule === 'jo' ? '조자시 (23:00 경계)' : '야자시 (자정 경계)'}</dd>
            </dl>
          </section>
        }
        footer={
          <div className="flex flex-col gap-3 rounded-b-[1.75rem] border-t border-border bg-surface-soft/70 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="eyebrow">사주 상세</p>
              <p className="mt-0.5 text-sm text-secondary">지장간 · 공망 · 신살과 운의 흐름까지 이어서 봅니다.</p>
            </div>
            <Link
              href={previewHref(`/me/people/${self.personId}`)}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent sm:self-auto"
            >
              사주 자세히 보기 <span aria-hidden="true">→</span>
            </Link>
          </div>
        }
      />
    </section>
  );
}

/**
 * 내 사주가 없을 때 — 기존 온보딩(`app/me/onboarding.tsx`)의 머리를 흉내 내고, 폼 대신 길 하나를 세운다.
 * 폼은 서버 액션을 부르므로 여기서 그리지 않는다.
 */
export function SelfOnboardingDoor() {
  return (
    <section className="flex flex-col gap-4 rounded-[1.75rem] border border-border bg-surface p-5 sm:p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">내 사주 등록</h2>
        <p className="text-sm text-secondary">
          출생 정보를 입력해 주세요. 나중에 언제든 고칠 수 있고, 고치면 그때부터 새 입력으로 계산합니다.
        </p>
      </header>
      <Link
        href={previewHref('/me')}
        className="inline-flex h-11 items-center self-start rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-strong sm:h-10"
      >
        내 명식 등록
      </Link>
    </section>
  );
}
