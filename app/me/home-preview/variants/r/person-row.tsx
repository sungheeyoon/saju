import Link from 'next/link';

import { BRANCH_INFO, ELEMENT_KO, STEM_INFO, type Saju } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import type { ReadingEntry } from '../../../reading/current';
import { ELEMENT_TONE } from '../../../../element-tone';
import { PILLAR_COLUMNS } from '../../../../saju/shared';
import { readingHref as hrefOfReading } from '../../../reading/line';
import { previewHref } from '../../shared/preview-href';

/*
  **R 의 한 줄 — E 의 줄(`variants/e/person-row.tsx`)을 옮기고 궁합 단추만 B 의 규칙으로 바꿨다.**
  나와 이 사람의 궁합풀이가 이미 있으면 단추에 점수가 붙고 그 글로 곧장 간다.

  **목록의 한 줄** — 카드(`shared/person-card.tsx`)가 한 사람에 화면 반을 쓰는 것을 한 줄로 줄였다.
  일간 타일 · 이름 · 여덟 글자 · 풀이 상태 · 행동 둘. 360px 에서는 여덟 글자가 이름 아래 둘째 줄로 내려가고
  풀이 상태 칸은 숨는다 — 그때 상태는 풀이 단추의 모양(채움 = 아직 없음, 옅음 = 있음)이 든다.
*/

type Chart = { ok: true; saju: Saju } | { ok: false; message: string };

export type RowPerson = {
  personId: string;
  label: string;
  note: string | null;
  chart: Chart;
  reading: ReadingEntry | null;
};

const ACTION =
  'inline-flex min-h-9 shrink-0 items-center justify-center rounded-full px-3 text-xs font-semibold';

export function PersonRow({
  person,
  self,
  selfPersonId,
  pair,
}: {
  /** 나 × 이 사람의 궁합풀이 — 있으면 궁합 단추가 그 글로 간다 */
  pair: ReadingEntry | null;
  person: RowPerson;
  /** 첫 줄 — 나 */
  self: boolean;
  /** 궁합을 미리 채울 내 id — 내 사주가 없으면 `null` */
  selfPersonId: string | null;
}) {
  const note = person.note?.trim() ?? '';
  const detailHref = previewHref(`/me/people/${person.personId}`);
  const readingHref = previewHref(self ? '/me/readings/self' : `/me/readings/${person.personId}`);
  const compatHref = previewHref(
    selfPersonId === null ? `/compat#b.person=${person.personId}` : `/compat#a.person=${selfPersonId}&b.person=${person.personId}`,
  );

  return (
    <li className={`flex items-center gap-3 px-3 py-3 sm:px-4 ${self ? 'bg-accent-wash' : ''}`}>
      <DayTile chart={person.chart} />

      <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,9rem)_auto_minmax(0,1fr)] sm:items-center sm:gap-4">
        <div className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5">
            <Link href={detailHref} className="truncate text-sm font-semibold hover:text-accent">
              {person.label}
            </Link>
            {self && (
              <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-on-accent">나</span>
            )}
          </span>
          {note !== '' && <span className="hidden truncate text-xs text-muted sm:block">{note}</span>}
        </div>

        {person.chart.ok ? (
          <Glyphs saju={person.chart.saju} label={person.label} />
        ) : (
          <p className="mt-0.5 truncate text-xs text-muted sm:col-span-2 sm:mt-0">{person.chart.message}</p>
        )}

        {person.chart.ok && <ReadingStatus reading={person.reading} />}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {person.chart.ok && (
          <Link
            href={readingHref}
            aria-label={person.reading === null ? '사주풀이 받기' : '사주풀이 보기'}
            className={`${ACTION} ${
              person.reading === null
                ? 'bg-accent text-on-accent hover:bg-accent-strong'
                : 'border border-accent/25 bg-surface text-accent-strong hover:border-accent'
            }`}
          >
            풀이
          </Link>
        )}
        {self || !person.chart.ok ? (
          <Link href={detailHref} className={`${ACTION} border border-border-strong bg-surface hover:border-accent hover:text-accent`}>
            자세히
          </Link>
        ) : (
          <Link
            href={pair === null ? compatHref : previewHref(hrefOfReading(pair))}
            className={`${ACTION} border border-border-strong bg-surface hover:border-accent hover:text-accent`}
          >
            궁합
            {pair?.score != null && <span className="ml-1 tabular-nums text-accent">{pair.score}점</span>}
          </Link>
        )}
      </div>
    </li>
  );
}

function DayTile({ chart }: { chart: Chart }) {
  if (!chart.ok) {
    return (
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-surface-sunken text-muted">
        ?
      </span>
    );
  }

  const { dayMaster } = chart.saju.pillars;
  const info = STEM_INFO[dayMaster];
  const tone = ELEMENT_TONE[info.element];
  return (
    <span
      role="img"
      aria-label={`일간 ${dayMaster}, ${info.ko}${ELEMENT_KO[info.element]}`}
      className={`grid size-11 shrink-0 place-items-center rounded-xl border ${tone.border} ${tone.surface}`}
    >
      <span aria-hidden="true" className={`glyph text-xl font-bold leading-none ${tone.text}`}>
        {dayMaster}
      </span>
    </span>
  );
}

/** 네 기둥 — 시 · 일 · 월 · 년, 카드의 표와 같은 차례 */
function Glyphs({ saju, label }: { saju: Saju; label: string }) {
  return (
    <p className="mt-0.5 flex items-center gap-1.5 sm:mt-0" aria-label={`${label}의 네 기둥`}>
      {PILLAR_COLUMNS.map(({ key, label: column }) => {
        const pillar = saju.pillars[key];
        if (pillar === null) {
          return (
            <span key={key} className="glyph w-[2.1em] text-center text-sm text-muted">
              <span aria-hidden="true">··</span>
              <span className="sr-only">{HOUR_UNKNOWN_LABEL}</span>
            </span>
          );
        }
        return (
          <span
            key={key}
            className={`glyph rounded-md px-0.5 text-sm font-semibold ${key === 'day' ? 'bg-accent-wash' : ''}`}
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

/** 풀이 상태 — 360px 에서는 숨는다. 비유 한 줄이거나, 없다는 말 */
function ReadingStatus({ reading }: { reading: ReadingEntry | null }) {
  return (
    <p className="hidden min-w-0 items-center gap-1.5 text-xs sm:flex">
      {reading === null ? (
        <span className="text-muted">풀이 없음</span>
      ) : (
        <>
          {!reading.fromCurrentChart && (
            <span className="shrink-0 rounded-full bg-warning-wash px-1.5 py-0.5 text-[10px] font-semibold text-warning">이전 명식</span>
          )}
          <span className="truncate text-secondary">{reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}</span>
        </>
      )}
    </p>
  );
}
