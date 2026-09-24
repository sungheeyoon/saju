import Link from 'next/link';

import { BRANCH_INFO, CALENDAR_KO, GENDER_KO, STEM_INFO } from '@/src/lib/saju';
import { isoOf, solarDateOf } from '@/src/lib/input/chart';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import { ELEMENT_TONE } from '../../../../element-tone';
import { PillarCard } from '../../../pillar-card';
import { ReadingTabs } from '../../../reading-tabs';
import type { FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { EightGlyphs, Fold } from './fold';

/**
 * 내 자리 — 접힌 한 줄은 일주 표식 · 이름 · 여덟 글자, 펴면 `/me` 의 명식 카드가 **그대로** 선다.
 *
 * 사람들의 `name` 에 들지 않는다 — 나는 기준점이라, 한 사람을 펴 보는 동안에도
 * 내 명식을 펴 둔 채 나란히 견줄 수 있어야 한다.
 */
export function SelfFold({ self }: { self: FixtureSelf }) {
  const { query, saju } = self;
  const day = saju.pillars.day;
  const stemTone = ELEMENT_TONE[STEM_INFO[day.stem].element];
  const branchTone = ELEMENT_TONE[BRANCH_INFO[day.branch].element];

  return (
    <Fold
      tone="self"
      summary={
        <>
          <span className="flex shrink-0 items-center gap-1" aria-label={`${day.ko} 일주`}>
            <span className={`glyph grid size-8 place-items-center rounded-lg border text-lg font-bold ${stemTone.border} ${stemTone.surface} ${stemTone.text}`} aria-hidden="true">
              {day.stem}
            </span>
            <span className={`glyph grid size-8 place-items-center rounded-lg border text-lg font-bold ${branchTone.border} ${branchTone.surface} ${branchTone.text}`} aria-hidden="true">
              {day.branch}
            </span>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="eyebrow shrink-0">내 사주</span>
              <span className="truncate font-bold tracking-[-0.02em]">{self.label}</span>
            </span>
            <EightGlyphs saju={saju} />
          </span>
        </>
      }
    >
      <ReadingTabs
        current="chart"
        chartHref={previewHref('/me')}
        readingHref={previewHref('/me/readings/self')}
        label="내 사주"
      />
      <PillarCard
        label={self.label}
        saju={saju}
        details={
          /* `/me` 의 「저장된 출생 정보」 사본 — 원본은 페이지 안의 JSX 라 가져올 수 없다 */
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
    </Fold>
  );
}

/** 내 사주가 아직 없을 때 — 온보딩 카드의 모양만 흉내 낸다. 폼은 그리지 않고 `/me` 로 가는 길이 선다 */
export function SelfMissing() {
  return (
    <section className="flex flex-col gap-4 rounded-[1.75rem] border border-accent/30 bg-accent-wash/40 p-5 shadow-[var(--shadow-card)] sm:p-6">
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
        출생 정보 입력하기
      </Link>
    </section>
  );
}
