import Link from 'next/link';

import { BRANCH_INFO, STEM_INFO, type Saju } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import type { ReadingEntry } from '../../../reading/current';
import { readingHref } from '../../../reading/line';
import { ELEMENT_TONE } from '../../../../element-tone';
import { PILLAR_COLUMNS } from '../../../../saju/shared';
import { PERSON_LIMIT, type FixturePerson, type FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { ElementHeads, UnitColumns, type Counts } from './element-chart';
import { Icon, PRIMARY, ROW_PRIMARY, ROW_SECONDARY, SECONDARY, TERTIARY } from './ui';
import styles from './viz.module.css';

/*
  **저장한 사람 — 비교 표.** 카드 격자 대신 줄을 고른 까닭: 작은 배수는 **세로로 정렬될 때** 비교가 된다.
  열 명의 木 칸이 한 세로줄에 서면 눈이 위아래로만 움직여 「누가 木 이 많은가」를 읽는다. 카드 격자는
  줄이 바뀔 때마다 그 정렬이 끊긴다.

  첫 줄은 **나(기준)** 다 — 옅은 바탕에 선다. 그 아래 사람마다 칸 위에 내 개수가 가는 선으로 겹친다.
  폰(360px)에서는 줄이 두 칸이 된다: 왼쪽에 이름 · 여덟 글자 · 풀이, 오른쪽에 차트, 아래에 단추 둘.
*/

export function PeopleTable({
  self,
  people,
  readings,
  max,
}: {
  self: FixtureSelf | null;
  people: readonly FixturePerson[];
  readings: readonly ReadingEntry[];
  max: number;
}) {
  const full = people.length >= PERSON_LIMIT;
  const reference = self === null ? null : self.saju.analysis.elements.counts;

  return (
    <section aria-labelledby="viz-people" className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex items-baseline gap-3">
          <h2 id="viz-people" className="text-[22px] font-bold tracking-[-0.03em]">
            저장한 사람
          </h2>
          <p className="text-[13px] tabular-nums text-muted">
            <span className="text-2xl font-bold tracking-[-0.03em] text-foreground">{people.length}</span>
            <span className="ml-0.5">/{PERSON_LIMIT}명</span>
          </p>
        </div>
        {people.length > 0 && (
          <div className="flex items-center gap-2">
            {!full && (
              <Link href={previewHref('/me/people')} className={SECONDARY}>
                <Icon name="plus" className="size-4" />
                사람 추가
              </Link>
            )}
            <Link href={previewHref('/me/people')} className={TERTIARY}>
              전체 관리
              <Icon name="chevron" className="size-4" />
            </Link>
          </div>
        )}
      </header>

      {people.length === 0 ? (
        <AddFirst primary={self !== null} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <Legend hasSelf={self !== null} />
          <ol>
            <HeadRow />
            {self !== null && <SelfRow self={self} max={max} />}
            {people.map((person) => (
              <PersonRow
                key={person.personId}
                person={person}
                reference={reference}
                selfId={self?.personId ?? null}
                pair={pairOf(readings, self?.personId ?? null, person)}
                max={max}
              />
            ))}
          </ol>
        </div>
      )}
      {full && <p className="text-[12px] text-muted">등록할 수 있는 10명을 다 채웠습니다.</p>}
    </section>
  );
}

/** 범례와 정렬 — 표 위 한 줄. 흐린 12px, 표를 읽기 전에 한 번 보고 지나가는 자리 */
function Legend({ hasSelf }: { hasSelf: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border px-4 py-3 text-[12px] text-muted sm:px-5">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="flex flex-col gap-[2px]">
            <span className="block h-[5px] w-3 rounded-[1px] bg-muted/70" />
            <span className="block h-[5px] w-3 rounded-[1px] bg-muted/70" />
          </span>
          한 칸 = 글자 하나
        </span>
        {hasSelf && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="block h-[2px] w-4 rounded-full bg-[var(--viz-ref)]" />
            <span>선 = 나</span>
          </span>
        )}
        <span>모두 같은 눈금</span>
      </p>
      <p>
        정렬 <span className="font-semibold text-secondary">저장한 순</span>
      </p>
    </div>
  );
}

/** 표 머리 — 넓은 폭에서는 다섯 칸의 이름, 폰에서는 차트 칸 위의 오행만 */
function HeadRow() {
  return (
    <li aria-hidden="true" className={`${styles.row} border-b border-border px-4 py-3 sm:px-5`}>
      <span data-area="name" className={`${styles.hideNarrow} text-[11px] font-semibold text-muted`}>
        이름
      </span>
      <span data-area="glyphs" className={`${styles.hideNarrow} text-[11px] font-semibold text-muted`}>
        여덟 글자 · 시일월년
      </span>
      <span data-area="chart">
        <ElementHeads />
      </span>
      <span data-area="status" className={`${styles.hideNarrow} text-[11px] font-semibold text-muted`}>
        사주풀이
      </span>
      <span data-area="actions" className={`${styles.hideNarrow} w-[14.5rem]`} />
    </li>
  );
}

function SelfRow({ self, max }: { self: FixtureSelf; max: number }) {
  return (
    <li className={`${styles.row} border-b border-border bg-accent-wash/50 px-4 py-4 sm:px-5`}>
      <div data-area="name" className="flex min-w-0 items-center gap-2">
        <span className="truncate text-base font-bold">{self.label}</span>
        <span className="shrink-0 rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-bold text-background">나 · 기준</span>
      </div>
      <div data-area="glyphs">
        <Glyphs saju={self.saju} label={self.label} />
      </div>
      <div data-area="status" className="min-w-0">
        <ReadingStatus reading={self.reading} />
      </div>
      <div data-area="chart">
        <UnitColumns counts={self.saju.analysis.elements.counts} reference={null} max={max} who={self.label} />
      </div>
      <div data-area="actions" className={`${styles.hideNarrow} w-[14.5rem]`} />
    </li>
  );
}

function PersonRow({
  person,
  reference,
  selfId,
  pair,
  max,
}: {
  person: FixturePerson;
  reference: Counts | null;
  selfId: string | null;
  pair: ReadingEntry | null;
  max: number;
}) {
  const label = person.local_label;
  const note = person.note?.trim() ?? '';
  const detailHref = previewHref(`/me/people/${person.personId}`);
  const compatHref = previewHref(
    selfId === null ? `/compat#b.person=${person.personId}` : `/compat#a.person=${selfId}&b.person=${person.personId}`,
  );
  const chart = person.chart;

  return (
    <li className={`${styles.row} border-b border-border px-4 py-4 last:border-b-0 sm:px-5`}>
      <div data-area="name" className="min-w-0">
        <Link
          href={detailHref}
          className="group inline-flex max-w-full items-center gap-0.5 rounded-md text-base font-bold hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="truncate">{label}</span>
          <Icon name="chevron" className="size-4 text-muted group-hover:text-accent" />
        </Link>
        {note !== '' && <p className="truncate text-[12px] text-muted">{note}</p>}
      </div>

      <div data-area="glyphs" className="min-w-0">
        {chart.ok ? (
          <Glyphs saju={chart.saju} label={label} />
        ) : (
          <p className="text-[13px] text-muted">{chart.message}</p>
        )}
      </div>

      <div data-area="status" className="min-w-0">
        {chart.ok && <ReadingStatus reading={person.reading} />}
      </div>

      <div data-area="chart">
        {chart.ok ? (
          <UnitColumns counts={chart.saju.analysis.elements.counts} reference={reference} max={max} who={label} />
        ) : (
          <EmptyColumns max={max} />
        )}
      </div>

      <div data-area="actions" className="flex gap-2 lg:w-[14.5rem] lg:justify-end">
        {chart.ok ? (
          <>
            <Link
              href={previewHref(`/me/readings/${person.personId}`)}
              className={`flex-1 lg:w-[5.5rem] lg:flex-none ${person.reading === null ? ROW_PRIMARY : ROW_SECONDARY}`}
            >
              {person.reading === null ? '풀이 받기' : '풀이 보기'}
            </Link>
            <Link href={pair === null ? compatHref : previewHref(readingHref(pair))} className={`flex-1 lg:w-[8.5rem] lg:flex-none ${ROW_SECONDARY}`}>
              <Icon name="compat" className="size-4 text-muted" />
              {selfId === null ? '궁합' : '나와 궁합'}
              {pair?.score != null && (
                <span className="rounded-md bg-accent-wash px-1.5 py-0.5 text-[12px] font-bold tabular-nums text-accent">
                  {pair.score}점
                </span>
              )}
            </Link>
          </>
        ) : (
          <Link href={detailHref} className={`flex-1 lg:w-[8.5rem] lg:flex-none ${ROW_SECONDARY}`}>
            자세히
          </Link>
        )}
      </div>
    </li>
  );
}

/** 못 읽는 명식 — 칸은 비워 두되 눈금은 그대로 선다(표의 세로 정렬이 안 끊긴다) */
function EmptyColumns({ max }: { max: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2 border-b border-dashed border-[var(--viz-axis)]" style={{ height: max * 9 }}>
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} className="w-5 lg:w-6" />
        ))}
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} className="w-5 text-center text-[12px] leading-none text-muted lg:w-6">
            –
          </span>
        ))}
      </div>
    </div>
  );
}

/** 여덟 글자 한 줄 — 기둥마다 두 글자, 일주만 밑줄. 명조 17px */
function Glyphs({ saju, label }: { saju: Saju; label: string }) {
  return (
    <p className="flex items-center gap-2 whitespace-nowrap" aria-label={`${label}의 네 기둥`}>
      {PILLAR_COLUMNS.map(({ key, label: column }) => {
        const pillar = saju.pillars[key];
        if (pillar === null) {
          return (
            <span key={key} className={`${styles.glyph} w-[1.2em] text-center text-[17px] leading-none text-muted`}>
              <span aria-hidden="true">··</span>
              <span className="sr-only">{HOUR_UNKNOWN_LABEL}</span>
            </span>
          );
        }
        return (
          <span
            key={key}
            className={`${styles.glyph} text-[17px] leading-none ${key === 'day' ? 'underline decoration-foreground/40 decoration-2 underline-offset-[5px]' : ''}`}
          >
            <span className="sr-only">{column} </span>
            <span className={ELEMENT_TONE[STEM_INFO[pillar.stem].element].text}>{pillar.stem}</span>
            <span className={ELEMENT_TONE[BRANCH_INFO[pillar.branch].element].text}>{pillar.branch}</span>
          </span>
        );
      })}
    </p>
  );
}

function ReadingStatus({ reading }: { reading: ReadingEntry | null }) {
  if (reading === null) return <p className="text-[12px] text-muted">풀이 없음</p>;
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-[12px]">
      {!reading.fromCurrentChart && (
        <span className="shrink-0 rounded-md bg-warning-wash px-1.5 py-0.5 text-[11px] font-semibold text-warning">이전 명식</span>
      )}
      <span className="truncate text-secondary">{reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}</span>
    </p>
  );
}

/** 사람 0명 — 내 사주가 있으면 이것이 주 단추, 없으면 「내 명식 등록」에 주를 내주고 보조로 선다. 빈 눈금이 「여기에 사람이 선다」를 먼저 보여준다 */
function AddFirst({ primary }: { primary: boolean }) {
  return (
    <div className="flex flex-col items-start gap-5 rounded-2xl border border-dashed border-border-strong bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div className="flex items-center gap-5">
        <span aria-hidden="true" className="hidden opacity-60 sm:block">
          <ElementHeads />
        </span>
        <p className="text-sm leading-relaxed text-secondary">가족이나 친구의 출생 정보를 저장하고 관리하세요.</p>
      </div>
      <Link href={previewHref('/me/people')} className={`${primary ? PRIMARY : SECONDARY} shrink-0`}>
        <Icon name="plus" className="size-4" />
        사람 추가
      </Link>
    </div>
  );
}

/** 나 × 그 사람의 궁합풀이 — 최근 것이 앞이라 처음 만난 것이 가장 최근이다 */
function pairOf(readings: readonly ReadingEntry[], selfId: string | null, person: FixturePerson): ReadingEntry | null {
  if (selfId === null) return null;
  return (
    readings.find(
      (entry) =>
        entry.kind === 'private' &&
        ((entry.personA === selfId && entry.personB === person.personId) ||
          (entry.personB === selfId && entry.personA === person.personId)),
    ) ?? null
  );
}
