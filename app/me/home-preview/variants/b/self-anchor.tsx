import Link from 'next/link';

import { CALENDAR_KO } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import { PILLAR_COLUMNS } from '../../../../saju/shared';
import type { FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { ReadingAction } from '../../shared/person-card';
import { DayMark, dayMasterName, dayTone } from './day-mark';

/**
 * 나 — **기준점이라 사람 격자 밖에 따로 선다.**
 *
 * 데스크톱에서는 왼쪽에 붙어(sticky) 사람을 훑는 동안 늘 보이고, 모바일에서는 격자 위에 얇게 선다.
 * 자세한 명식과 풀이는 여기 안 싣고 길만 둔다 — 명식은 `/me/people/<내 id>`, 풀이는 `/me/readings/self`.
 */
export function SelfAnchor({ self }: { self: FixtureSelf }) {
  const { query, saju } = self;
  const tone = dayTone(saju);
  const reading = self.reading;

  return (
    <section
      aria-label="나"
      className="rounded-[1.75rem] border border-border bg-surface shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center gap-3 p-4 sm:p-5 lg:flex-col lg:items-start lg:gap-4">
        <DayMark saju={saju} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">내 사주</p>
          <h2 className="mt-0.5 truncate text-xl font-bold tracking-[-0.03em]">{self.label}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
            <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.surface} ${tone.text}`}>
              {dayMasterName(saju)}
            </span>
            <span className="hidden sm:inline">
              {query.calendar === 'solar' ? query.date : `${CALENDAR_KO[query.calendar]} ${query.date}`}
              {query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` · ${query.time}`}
            </span>
          </p>
        </div>

        {/* 여덟 글자 — 데스크톱의 넓은 자리에서만. 모바일에서는 얇게 둔다 */}
        <dl className="hidden w-full grid-cols-4 gap-1.5 text-center lg:grid">
          {PILLAR_COLUMNS.map(({ key, label }) => {
            const pillar = saju.pillars[key];
            return (
              <div
                key={key}
                className={`rounded-xl border px-1 py-2 ${
                  key === 'day' ? 'border-accent/30 bg-accent-wash/50' : 'border-border bg-surface-soft'
                }`}
              >
                <dt className={`text-[11px] ${key === 'day' ? 'text-accent' : 'text-muted'}`}>{label}</dt>
                <dd className="glyph mt-0.5 text-lg font-semibold">
                  {pillar === null ? <span className="text-xs text-muted">{HOUR_UNKNOWN_LABEL}</span> : pillar.name}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      <div className="flex flex-col gap-2 rounded-b-[1.75rem] border-t border-border bg-surface-soft/70 p-3 sm:p-4">
        {/* 모바일 — 두 길을 한 줄에 */}
        <div className="flex gap-2 lg:hidden">
          <Link
            href={previewHref(`/me/people/${self.personId}`)}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full border border-border-strong bg-surface px-3 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
          >
            사주 자세히 보기
          </Link>
          <Link
            href={previewHref('/me/readings/self')}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-accent px-3 py-2 text-sm font-semibold text-on-accent hover:bg-accent-strong"
          >
            {reading === null ? '사주풀이 받기' : '사주풀이 보기'}
          </Link>
        </div>

        {/* 데스크톱 — 저장한 사람 카드와 같은 풀이 띠. 경로는 `/me/readings/self` 가 된다 */}
        <div className="hidden flex-col gap-2 lg:flex">
          <ReadingAction personId="self" reading={reading} />
          <Link
            href={previewHref(`/me/people/${self.personId}`)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
          >
            사주 자세히 보기 <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/** 내 사주가 없을 때 — 기존 온보딩 카드의 모양만 흉내 내고 등록 폼은 안 그린다 */
export function SelfMissing() {
  return (
    <section className="flex flex-col gap-4 rounded-[1.75rem] border border-border bg-surface p-5 sm:p-6">
      <header className="flex flex-col gap-1">
        <p className="eyebrow">내 사주</p>
        <h2 className="text-base font-semibold">내 사주 등록</h2>
        <p className="text-sm text-secondary">
          출생 정보를 입력해 주세요. 나중에 언제든 고칠 수 있고, 고치면 그때부터 새 입력으로 계산합니다.
        </p>
      </header>
      <Link
        href={previewHref('/me')}
        className="inline-flex h-11 items-center justify-center self-start rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-strong sm:h-10"
      >
        내 명식 등록
      </Link>
    </section>
  );
}

/** 매칭으로 가는 띠 — `/me` 의 것과 같은 문구다. 데스크톱의 왼쪽 자리에만 선다 */
export function MatchingDoor() {
  return (
    <Link
      href={previewHref('/me/matching')}
      className="hidden items-center justify-between gap-4 rounded-2xl border border-border bg-accent-wash px-5 py-4 text-sm text-accent lg:flex"
    >
      <span>
        <strong className="block font-semibold">매칭에서 오늘의 인연 만나기</strong>
        <span className="mt-1 block text-xs text-secondary">
          예측 궁합과 보완하는 기운으로, 나의 귀인을 찾아보세요.
        </span>
      </span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}
