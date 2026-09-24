import Link from 'next/link';

import { ELEMENT_KO, STEM_INFO } from '@/src/lib/saju';

import { ELEMENT_TONE } from '../../../../element-tone';
import type { FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { CardActionIcon, ReadingAction } from '../../shared/person-card';

/*
  **나는 작게 선다.** 이 시안의 주인공은 풀이라, 내 자리는 누구인지(일간 · 일주)와 두 갈래 길만 든다.
  자세한 명식은 사람 상세(`/me/people/<내 id>`), 내 풀이는 `/me/readings/self` 다.
*/

export function SelfCard({ self }: { self: FixtureSelf }) {
  const { pillars } = self.saju;
  const info = STEM_INFO[pillars.dayMaster];
  const tone = ELEMENT_TONE[info.element];

  return (
    <section
      aria-label="내 사주"
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[1.75rem] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-full border ${tone.border} ${tone.surface}`}
          aria-label={`일간 ${pillars.dayMaster}, ${info.ko}${ELEMENT_KO[info.element]}`}
        >
          <span className={`glyph text-xl font-bold leading-none ${tone.text}`} aria-hidden="true">
            {pillars.dayMaster}
          </span>
        </span>
        <div className="min-w-0">
          <p className="eyebrow">내 사주</p>
          <p className="truncate text-base font-bold tracking-[-0.03em]">
            {self.label}
            <span className="ml-2 text-sm font-semibold text-secondary">{pillars.day.ko} 일주</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={previewHref(`/me/people/${self.personId}`)}
          className="inline-flex min-h-9 items-center rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent"
        >
          사주 자세히 보기
        </Link>
        <Link
          href={previewHref('/me/readings/self')}
          className="inline-flex min-h-9 items-center rounded-full border border-accent/25 bg-accent-wash px-3.5 py-1.5 text-sm font-semibold text-accent hover:border-accent"
        >
          {self.reading === null ? '사주풀이 받기' : '사주풀이 보기'}
        </Link>
      </div>
    </section>
  );
}

/** 내 사주가 없을 때 내 자리 — 등록 폼은 안 그리고 `/me` 온보딩의 머리만 흉내 낸다 */
export function RegisterCard() {
  return (
    <section className="flex flex-col gap-3 rounded-[1.75rem] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
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

/**
 * 풀이가 하나도 없을 때 — **최근 풀이 자리를 비우지 않고 첫 풀이로 이끈다.**
 * 내 사주가 없으면 등록이 첫 걸음이고, 있으면 곧장 내 풀이를 받는다.
 */
export function FirstReading({ self }: { self: FixtureSelf | null }) {
  if (self !== null) {
    return (
      <section className="flex flex-col gap-3 rounded-[1.75rem] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div>
          <p className="eyebrow">첫 풀이</p>
          <h2 className="mt-1 text-xl font-bold tracking-[-0.03em]">내 사주풀이부터 받아 보세요</h2>
        </div>
        <ReadingAction personId="self" reading={null} />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5 rounded-[1.75rem] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div>
        <p className="eyebrow">첫 풀이</p>
        <h2 className="mt-1 text-xl font-bold tracking-[-0.03em]">내 사주를 등록하면 첫 풀이를 받을 수 있습니다</h2>
      </div>

      <ol className="flex flex-col gap-2">
        <li>
          <Link
            href={previewHref('/me')}
            className="group flex min-h-[4.75rem] items-center gap-3 rounded-2xl bg-accent px-4 py-3 text-on-accent shadow-sm hover:bg-accent-strong"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/14 text-sm font-bold">1</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">내 명식 등록</span>
              <span className="mt-0.5 block text-xs text-on-accent/75">
                나중에 언제든 고칠 수 있고, 고치면 그때부터 새 입력으로 계산합니다.
              </span>
            </span>
            <span className="shrink-0 text-sm text-on-accent/70" aria-hidden="true">
              →
            </span>
          </Link>
        </li>
        <li className="flex min-h-[4.75rem] items-center gap-3 rounded-2xl border border-border bg-surface-soft px-4 py-3 text-muted">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface">
            <CardActionIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">사주풀이 받기</span>
            <span className="mt-0.5 block text-xs">기질과 삶의 흐름을 읽어보세요</span>
          </span>
        </li>
      </ol>

      <Link href={previewHref('/')} className="self-start text-sm font-semibold text-accent hover:text-accent-strong">
        등록 전에 모르는 사람 사주 먼저 보기 <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
