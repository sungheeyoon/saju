import Link from 'next/link';

import type { ReadingEntry } from '../../../reading/current';
import { readingHref } from '../../../reading/line';
import { PERSON_LIMIT, type FixturePerson } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { DayTile, GlyphLine } from './chart';
import { Icon } from './icons';
import { Button, CARD, TONE, TYPE, Tag, Text } from './ui';

/*
  **저장한 사람 — 줄 하나에 세 층.**
  누르면 상세로 가는 **줄 자체**(이름 · 여덟 글자 · 꺾쇠) / 그 사람에게 **할 일** 둘(보조 단추) / 상태 표지.

  R 의 줄은 이름이 `Link` 인데 글자색만 바뀌는 hover 뿐이라 눌리는 줄 몰랐고, 「풀이」 「궁합」은 12px
  알약이라 버튼과 표지가 구별되지 않았다. 여기서는 줄 전체가 44px 이상의 누를 자리이고 끝에 꺾쇠가 서며,
  할 일은 테두리 단추(폰 44px)로만, 상태는 6px 모서리의 표지로만 말한다. 폰에서는 할 일이 둘째 줄로 내려가
  반씩 나눠 쥔다 — 엄지가 닿는 폭이다.
*/

export function PeopleSection({
  people,
  readings,
  selfId,
}: {
  people: readonly FixturePerson[];
  readings: readonly ReadingEntry[];
  selfId: string | null;
}) {
  const full = people.length >= PERSON_LIMIT;

  return (
    <section aria-labelledby="sys-people" className="flex flex-col gap-3">
      <div className="flex min-h-11 items-center justify-between gap-3 px-1">
        <h2 id="sys-people" className="flex items-baseline gap-2">
          <span className={TYPE.heading}>저장한 사람</span>
          <span className={`${TYPE.label} ${TONE.muted} tabular-nums`}>
            {people.length}/{PERSON_LIMIT}명
          </span>
        </h2>
        {!full && people.length > 0 && (
          <Button href={previewHref('/me/people')} size="sm" icon="plus">
            사람 추가
          </Button>
        )}
      </div>

      {people.length === 0 ? (
        <AddFirst primary={selfId !== null} />
      ) : (
        <div className={`${CARD} overflow-hidden`}>
          <ol className="divide-y divide-border">
            {people.map((person) => (
              <PersonRow key={person.personId} person={person} selfId={selfId} pair={pairOf(readings, selfId, person)} />
            ))}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-x-4 border-t border-border bg-surface-soft/60 px-4 py-1 sm:px-5">
            <Text variant="caption" tone="muted">
              {full ? '등록할 수 있는 10명을 다 채웠습니다.' : ''}
            </Text>
            <Button href={previewHref('/me/people')} variant="tertiary" size="sm">
              전체 관리
            </Button>
          </div>
        </div>
      )}
    </section>
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

function PersonRow({ person, selfId, pair }: { person: FixturePerson; selfId: string | null; pair: ReadingEntry | null }) {
  const { chart, reading } = person;
  const detailHref = previewHref(`/me/people/${person.personId}`);
  const note = person.note?.trim() ?? '';

  const actions = chart.ok ? <RowActions person={person} selfId={selfId} pair={pair} /> : null;

  return (
    <li className="flex flex-col gap-2 px-2 py-2 sm:flex-row sm:items-center sm:gap-3 sm:px-3">
      <Link
        href={detailHref}
        className="group flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-soft active:bg-surface-sunken sm:grid sm:grid-cols-[2.75rem_minmax(0,9rem)_auto_minmax(0,1fr)_1.25rem] sm:gap-4"
      >
        <DayTile saju={chart.ok ? chart.saju : null} />

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className={`${TYPE.body} truncate font-semibold`}>{person.local_label}</span>
            {reading !== null && !reading.fromCurrentChart && (
              <span className="sm:hidden">
                <Tag>이전 명식</Tag>
              </span>
            )}
          </span>
          {chart.ok ? (
            <span className="sm:hidden">
              <GlyphLine saju={chart.saju} name={person.local_label} />
            </span>
          ) : (
            <span className={`${TYPE.caption} ${TONE.muted} truncate`}>{chart.message}</span>
          )}
          {note !== '' && <span className={`${TYPE.caption} ${TONE.muted} hidden truncate sm:block`}>{note}</span>}
        </span>

        {chart.ok ? (
          <span className="hidden sm:block">
            <GlyphLine saju={chart.saju} name={person.local_label} />
          </span>
        ) : (
          <span className="hidden sm:block" />
        )}

        <span className="hidden min-w-0 items-center gap-2 sm:flex">
          {chart.ok &&
            (reading === null ? (
              <span className={`${TYPE.caption} ${TONE.muted}`}>풀이 없음</span>
            ) : (
              <>
                {!reading.fromCurrentChart && <Tag>이전 명식</Tag>}
                <span className={`${TYPE.caption} ${TONE.secondary} truncate`}>
                  {reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}
                </span>
              </>
            ))}
        </span>

        <span className={`${TONE.muted} shrink-0 group-hover:translate-x-0.5 group-hover:text-foreground`}>
          <Icon name="chevron" />
        </span>
      </Link>

      {actions !== null && (
        /*
          폰에서는 두 단추가 **한 알약을 반씩** 나눠 쥔다 — 열 줄에 테두리 스무 개가 서면 목록이 단추 벽이 된다.
          넓은 폭에서는 따로 선 보조 단추 둘로 돌아간다.
        */
        <div className="mb-1 ml-[3.75rem] mr-2 grid grid-cols-2 overflow-hidden rounded-full border border-border-strong [&>a]:rounded-none [&>a]:border-0 [&>a]:shadow-none [&>a+a]:border-l [&>a+a]:border-border sm:m-0 sm:flex sm:w-[14.5rem] sm:shrink-0 sm:justify-end sm:gap-2 sm:overflow-visible sm:rounded-none sm:border-0 sm:[&>a]:rounded-full sm:[&>a]:border sm:[&>a+a]:border-border-strong sm:[&>a]:shadow-[0_1px_2px_rgba(20,30,24,0.06)]">
          {actions}
        </div>
      )}
      {/* 할 일이 없는 줄도 넓은 폭에서 같은 자리를 비워 둔다 — 꺾쇠가 한 세로줄에 서게 */}
      {actions === null && <span aria-hidden="true" className="hidden sm:block sm:w-[14.5rem] sm:shrink-0" />}
    </li>
  );
}

function RowActions({ person, selfId, pair }: { person: FixturePerson; selfId: string | null; pair: ReadingEntry | null }) {
  const compatHref =
    pair !== null
      ? readingHref(pair)
      : selfId === null
        ? `/compat#b.person=${person.personId}`
        : `/compat#a.person=${selfId}&b.person=${person.personId}`;

  return (
    <>
      <Button
        href={previewHref(`/me/readings/${person.personId}`)}
        size="sm"
        icon={person.reading === null ? 'spark' : 'book'}
        label={person.reading === null ? `${person.local_label} 사주풀이 받기` : `${person.local_label} 사주풀이 보기`}
      >
        {person.reading === null ? '풀이 받기' : '풀이 보기'}
      </Button>
      <Button href={previewHref(compatHref)} size="sm" icon="pair" label={`나와 ${person.local_label}의 궁합${pair?.score != null ? ` ${pair.score}점` : ''}`}>
        궁합
        {pair?.score != null && <span className="ml-1 font-bold tabular-nums text-[var(--sys-link)]">{pair.score}점</span>}
      </Button>
    </>
  );
}

/** 사람 0명 — 목록 대신 첫 사람을 부르는 자리. 내 사주가 없으면 주 행동을 「내 명식 등록」에 양보한다 */
function AddFirst({ primary }: { primary: boolean }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[1.75rem] border border-dashed border-border-strong bg-surface/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-wash text-[var(--sys-link)]">
          <Icon name="people" />
        </span>
        <Text variant="body" tone="secondary">
          가족이나 친구의 출생 정보를 저장하고 관리하세요.
        </Text>
      </div>
      <Button
        href={previewHref('/me/people')}
        variant={primary ? 'primary' : 'secondary'}
        icon="plus"
        className="self-stretch sm:self-auto"
      >
        사람 추가
      </Button>
    </div>
  );
}
