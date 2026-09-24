import type { ReactNode } from 'react';
import Link from 'next/link';

import { CALENDAR_KO } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';
import { UNREADABLE_INPUT_NOTE } from '@/src/lib/input/stored';

import type { ReadingEntry } from '../../../reading/current';
import { readingHref } from '../../../reading/line';
import type { FixturePerson, FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { DayMark, dayMasterName } from './day-mark';

/**
 * 한 사람 — **나와의 관계가 먼저 읽히게** 선다.
 *
 * 카드의 가운데는 일간 둘(나 · 그 사람)이고, 가장 앞선 누름은 「나와 궁합」이다. 이미 궁합풀이를 봤으면
 * 그 점수가 단추에 붙고 단추는 그 글로 간다. 두 일간이 맞는지 안 맞는지는 판정하지 않는다 — 있는 값만 둔다.
 */
export function RelationCard({
  person,
  self,
  pair,
}: {
  person: FixturePerson;
  self: FixtureSelf | null;
  /** 나 × 이 사람의 궁합풀이 — 가장 최근 것 하나 */
  pair: ReadingEntry | null;
}) {
  const note = person.note?.trim() ?? '';
  const detail = previewHref(`/me/people/${person.personId}`);

  return (
    <article className="flex min-w-0 flex-col rounded-[1.75rem] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <Link href={detail} className="group min-w-0">
          <h3 className="text-lg font-bold tracking-[-0.03em] [overflow-wrap:anywhere] group-hover:text-accent">
            {person.local_label}
          </h3>
          {person.chart.ok && (
            <p className="mt-0.5 text-xs text-muted">
              {person.chart.query.calendar === 'solar'
                ? person.chart.query.date
                : `${CALENDAR_KO[person.chart.query.calendar]} ${person.chart.query.date}`}
              {person.chart.query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` · ${person.chart.query.time}`}
            </p>
          )}
        </Link>

        {person.chart.ok ? (
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-2xl border border-border bg-surface-soft/60 p-2.5">
            {self === null ? (
              <Side label="나" sub="등록 전" />
            ) : (
              <Side label="나" sub={dayMasterName(self.saju)} mark={<DayMark saju={self.saju} />} />
            )}
            <span aria-hidden="true" className="text-sm text-muted">×</span>
            <Side
              label={person.local_label}
              sub={dayMasterName(person.chart.saju)}
              mark={<DayMark saju={person.chart.saju} />}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface-soft/60 p-3">
            <p className="text-sm">{person.chart.message}</p>
            <p className="text-xs text-muted">{UNREADABLE_INPUT_NOTE}</p>
          </div>
        )}

        {note !== '' && (
          <p className="line-clamp-2 text-xs text-secondary" title={note}>
            <span className="mr-1.5 font-semibold tracking-[0.08em] text-muted">메모</span>
            {note}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-b-[1.75rem] border-t border-border bg-surface-soft/70 p-3">
        {person.chart.ok && self !== null && <CompatAction self={self} person={person} pair={pair} />}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={detail}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-border-strong bg-surface px-3 py-2 text-xs font-semibold hover:border-accent hover:text-accent"
          >
            사주 보기
          </Link>
          {person.chart.ok ? (
            <Link
              href={previewHref(`/me/readings/${person.personId}`)}
              className="inline-flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-full border border-border-strong bg-surface px-3 py-2 text-xs font-semibold hover:border-accent hover:text-accent"
            >
              <span className="truncate">{person.reading === null ? '사주풀이 받기' : '사주풀이 보기'}</span>
              {person.reading !== null && !person.reading.fromCurrentChart && (
                <span className="shrink-0 rounded-full bg-warning-wash px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                  이전 명식
                </span>
              )}
            </Link>
          ) : (
            <span />
          )}
        </div>
      </div>
    </article>
  );
}

function Side({ label, sub, mark }: { label: string; sub: string; mark?: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {mark ?? (
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-2xl border border-dashed border-border-strong text-muted"
        >
          ?
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className="block truncate text-[11px] text-secondary">{sub}</span>
      </span>
    </span>
  );
}

/** 가장 앞선 누름 — 본 궁합풀이가 있으면 그 글로, 없으면 두 칸이 채워진 궁합 첫 화면으로 */
function CompatAction({ self, person, pair }: { self: FixtureSelf; person: FixturePerson; pair: ReadingEntry | null }) {
  const href =
    pair === null
      ? previewHref(`/compat#a.person=${self.personId}&b.person=${person.personId}`)
      : previewHref(readingHref(pair));

  return (
    <Link
      href={href}
      className="group flex min-h-11 items-center gap-3 rounded-2xl bg-accent px-4 py-2.5 text-on-accent shadow-sm hover:bg-accent-strong"
    >
      <span className="min-w-0 flex-1 text-sm font-bold">나와 궁합</span>
      {pair !== null && pair.score !== null && (
        <span className="shrink-0 rounded-full bg-white/14 px-2 py-0.5 text-sm font-semibold tabular-nums">
          {pair.score}
          <span className="ml-0.5 text-xs font-normal text-on-accent/75">점</span>
        </span>
      )}
      <span aria-hidden="true" className="shrink-0 text-sm text-on-accent/70 group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}

/** 격자 안의 빈 자리 — 사람 추가. 다 찼으면 `AddPerson` 의 안내 문구가 대신 선다 */
export function AddSlot({ used, limit, alone }: { used: number; limit: number; alone: boolean }) {
  if (used >= limit) {
    return (
      <p className="flex min-h-40 items-center rounded-[1.75rem] border border-dashed border-border-strong p-5 text-sm text-muted">
        등록할 수 있는 {limit}명을 다 채웠습니다. 목록에서 누군가를 빼면 다시 등록할 수 있습니다.
      </p>
    );
  }

  return (
    <Link
      href={previewHref('/me/people')}
      className={`group flex min-h-40 flex-col items-center justify-center gap-2 rounded-[1.75rem] border border-dashed border-border-strong p-5 text-center hover:border-accent hover:bg-accent-wash/40 ${
        alone ? 'sm:col-span-2' : ''
      }`}
    >
      <span
        aria-hidden="true"
        className="grid size-11 place-items-center rounded-full border border-border-strong bg-surface text-xl text-muted group-hover:border-accent group-hover:text-accent"
      >
        +
      </span>
      <span className="text-sm font-semibold group-hover:text-accent">사람 추가</span>
      <span className="text-xs text-muted">
        {alone ? '가족이나 친구의 출생 정보를 저장하고 관리하세요.' : `${used}/${limit}명`}
      </span>
    </Link>
  );
}
