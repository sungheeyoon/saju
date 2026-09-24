import Link from 'next/link';

import { BRANCH_INFO, CALENDAR_KO, ELEMENT_KO, GENDER_KO, STEM_INFO } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import { ELEMENT_TONE } from '../../../../element-tone';
import { PILLAR_COLUMNS } from '../../../../saju/shared';
import type { FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { CardActionIcon } from '../../shared/person-card';

/*
  **내 자리 — 요약 카드 하나.**

  아래에 저장한 사람 카드가 열 장까지 서므로 나는 **같은 모양의 한 장이면 묻힌다.** 그래서 셋이 다르다:
  강조 테두리(`border-accent`)와 옅은 바탕(`bg-accent-wash`), 이름 앞의 「나」 표식, 그리고 아래 띠에
  길 둘(자세히 · 사주풀이). 여덟 글자는 저장한 사람 카드의 표와 같은 모양이라 두 카드가 한 식구로 읽힌다.
  오행 막대 · 출생 정보 표는 싣지 않는다 — 그것은 `/me/people/<내 id>` 가 든다.
*/

export function SelfCard({ self }: { self: FixtureSelf }) {
  const { query, saju, reading } = self;
  const { pillars } = saju;
  const dayPillar = pillars.day;
  const dayStem = STEM_INFO[dayPillar.stem];
  const dayBranch = BRANCH_INFO[dayPillar.branch];
  const stemTone = ELEMENT_TONE[dayStem.element];
  const branchTone = ELEMENT_TONE[dayBranch.element];

  return (
    <section
      aria-label="내 사주"
      className="relative rounded-[1.75rem] border border-accent bg-surface shadow-[var(--shadow-card)]"
    >
      <div className="grid gap-5 rounded-t-[1.75rem] bg-accent-wash/40 p-5 sm:p-6 md:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)] md:items-center md:gap-8">
        <div className="min-w-0">
          <div
            className="flex items-center gap-1.5"
            aria-label={`${dayPillar.ko} 일주, 천간 ${dayStem.ko}${ELEMENT_KO[dayStem.element]}, 지지 ${dayBranch.ko}${ELEMENT_KO[dayBranch.element]}`}
          >
            <span className={`glyph grid size-8 place-items-center rounded-lg border text-lg font-bold ${stemTone.border} ${stemTone.surface} ${stemTone.text}`} aria-hidden="true">
              {dayPillar.stem}
            </span>
            <span className={`glyph grid size-8 place-items-center rounded-lg border text-lg font-bold ${branchTone.border} ${branchTone.surface} ${branchTone.text}`} aria-hidden="true">
              {dayPillar.branch}
            </span>
            <span className="ml-1 text-sm font-semibold text-secondary">{dayPillar.ko} 일주</span>
          </div>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-on-accent">나</span>
            <h2 className="min-w-0 break-keep text-xl font-bold tracking-[-0.03em]">{self.label}의 사주팔자</h2>
          </div>
          <p className="mt-1.5 text-sm text-secondary">
            {query.calendar === 'solar' ? query.date : `${CALENDAR_KO[query.calendar]} ${query.date}`}
            {query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` · ${query.time}`}
            <span className="text-muted"> · {GENDER_KO[query.gender]} · {query.city}</span>
          </p>
        </div>

        {/* 저장한 사람 카드(`ChartSummary`)의 표와 같은 모양 — 원본은 머리의 「저장한 사람」까지 함께라 못 빌린다 */}
        <table className="w-full table-fixed border-separate border-spacing-x-1.5 text-center sm:border-spacing-x-2">
          <caption className="sr-only">{self.label}의 시주, 일주, 월주, 년주</caption>
          <thead>
            <tr className="text-xs text-muted">
              {PILLAR_COLUMNS.map(({ key, label }) => (
                <th key={key} className={`pb-1.5 font-medium ${key === 'day' ? 'text-accent' : ''}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {PILLAR_COLUMNS.map(({ key, label }) => {
                const pillar = pillars[key];
                if (pillar === null) {
                  return (
                    <td key={key} className="rounded-xl bg-surface-sunken px-1 py-3 text-xs text-muted">
                      {HOUR_UNKNOWN_LABEL}
                    </td>
                  );
                }
                const stem = ELEMENT_TONE[STEM_INFO[pillar.stem].element];
                const branch = ELEMENT_TONE[BRANCH_INFO[pillar.branch].element];
                return (
                  <td
                    key={key}
                    aria-label={`${label} ${pillar.name}`}
                    className={`rounded-xl border px-1 py-2.5 ${
                      key === 'day' ? 'border-accent/30 bg-accent-wash/50' : 'border-border bg-surface'
                    }`}
                  >
                    <span className={`glyph text-2xl font-semibold ${stem.text}`}>{pillar.stem}</span>
                    <span className={`glyph text-2xl font-semibold ${branch.text}`}>{pillar.branch}</span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* 아래 띠 — 이 명식을 이어 보는 길 둘. 풀이 쪽이 주된 길이라 색을 입는다 */}
      <div className="grid gap-2 rounded-b-[1.75rem] border-t border-accent/30 bg-surface-soft/70 p-3 sm:grid-cols-2 sm:p-4">
        <Link
          href={previewHref(`/me/people/${self.personId}`)}
          className="flex min-h-[4.75rem] min-w-0 items-center gap-3 rounded-2xl border border-border-strong bg-surface px-4 py-3 hover:border-accent hover:text-accent"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">사주 자세히 보기</span>
            <span className="mt-0.5 line-clamp-2 block text-xs text-secondary">
              지장간 · 공망 · 신살과 운의 흐름까지 이어서 봅니다.
            </span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-sm">→</span>
        </Link>

        <Link
          href={previewHref('/me/readings/self')}
          className={`group flex min-h-[4.75rem] min-w-0 items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 ${
            reading === null
              ? 'bg-accent text-on-accent shadow-sm hover:bg-accent-strong'
              : 'border border-accent/25 bg-accent-wash hover:border-accent'
          }`}
        >
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-xl ${reading === null ? 'bg-white/14' : 'bg-surface text-accent shadow-sm'}`}
          >
            <CardActionIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className={`text-sm font-bold ${reading === null ? '' : 'text-accent-strong'}`}>사주풀이</span>
              {reading !== null && !reading.fromCurrentChart && (
                <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted">이전 명식</span>
              )}
            </span>
            <span className={`mt-0.5 block truncate text-xs ${reading === null ? 'text-on-accent/75' : 'text-secondary'}`}>
              {reading === null
                ? '기질과 삶의 흐름을 읽어보세요'
                : (reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요')}
            </span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-sm group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </section>
  );
}

/** 내 사주가 아직 없을 때 — 온보딩(`app/me/onboarding.tsx`)의 머리 모양을 흉내 내고 폼 대신 길 하나 */
export function SelfOnboardingCard() {
  return (
    <section
      aria-label="내 사주"
      className="flex flex-col gap-4 rounded-[1.75rem] border border-accent bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6"
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-on-accent">나</span>
          <h2 className="text-base font-semibold">내 사주 등록</h2>
        </div>
        <p className="text-sm text-secondary">
          출생 정보를 입력해 주세요. 나중에 언제든 고칠 수 있고, 고치면 그때부터 새 입력으로 계산합니다.
        </p>
      </header>
      <Link
        href={previewHref('/me#self-onboarding')}
        className="inline-flex h-11 items-center self-start rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-strong sm:h-10"
      >
        내 명식 등록
      </Link>
    </section>
  );
}
