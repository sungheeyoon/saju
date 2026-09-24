import Link from 'next/link';

import { BRANCH_INFO, ELEMENT_KO, STEM_INFO, type Saju } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import type { ReadingEntry } from '../../../reading/current';
import { readingHref } from '../../../reading/line';
import { ELEMENT_TONE } from '../../../../element-tone';
import { PILLAR_COLUMNS } from '../../../../saju/shared';
import { PERSON_LIMIT, type FixturePerson } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import styles from './fin.module.css';
import { OldChart } from './self-block';
import { BUTTON, Block, Chevron, Icon, IconCircle, TYPE } from './ui';

/*
  **저장한 사람 — 토스의 계좌 목록처럼 한 사람이 한 줄이다.**

  줄 전체가 상세로 가는 자리다(이름 링크의 `::after` 가 줄을 덮는다). 그 위로 칩 둘만 올라선다:
  사주풀이(없으면 옅은 초록 「받기」, 있으면 회색 「보기」)와 나와 궁합(이미 봤으면 점수가 굵게 붙고 그 글로 간다).
  폰에서는 칩이 이름 아래 셋째 줄로 가되 셰브론 칸까지 넓게 쓰고(360px 에서 「이전 명식」이 붙어도 한 줄), 넓은 화면에서는 오른쪽 끝으로 간다.
*/

export function PeopleBlock({
  people,
  readings,
  selfId,
  primaryAdd,
}: {
  people: readonly FixturePerson[];
  readings: readonly ReadingEntry[];
  selfId: string | null;
  /** 사람 추가가 이 화면의 주 행동인가 — 내 사주가 있고 사람이 0명일 때만 */
  primaryAdd: boolean;
}) {
  const full = people.length >= PERSON_LIMIT;

  return (
    <Block label="저장한 사람" className="flex flex-col pb-3 pt-6">
      <header className="flex items-center justify-between gap-3 px-5 sm:px-6">
        <h2 className={TYPE.heading}>
          저장한 사람
          <span className="ml-2 tabular-nums">
            <span className="text-[var(--fin-accent-text)]">{people.length}</span>
            <span className="text-[var(--fin-faint)]">/{PERSON_LIMIT}</span>
          </span>
        </h2>
        {people.length > 0 && (
          <Link href={previewHref('/me/people')} className={`${BUTTON.tertiary} -mr-2`}>
            전체 관리
            <Chevron className="size-4" />
          </Link>
        )}
      </header>

      {people.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 pb-3 pt-8 text-center sm:px-6">
          <IconCircle>
            <Icon name="people" className="size-6" />
          </IconCircle>
          <p className={`max-w-[18rem] ${TYPE.body}`}>가족이나 친구의 출생 정보를 저장하고 관리하세요.</p>
        </div>
      ) : (
        <ol className="mt-3 flex flex-col">
          {people.map((person) => (
            <PersonRow key={person.personId} person={person} selfId={selfId} pair={pairOf(readings, selfId, person)} />
          ))}
        </ol>
      )}

      <div className="px-5 pt-3 sm:px-6">
        {full ? (
          <p className={`py-3 text-center ${TYPE.caption}`}>등록할 수 있는 10명을 다 채웠습니다.</p>
        ) : (
          <Link href={previewHref('/me/people')} className={primaryAdd ? BUTTON.primary : BUTTON.secondary}>
            <Icon name="plus" className="size-5" stroke={2.2} />
            사람 추가
          </Link>
        )}
      </div>
    </Block>
  );
}

function PersonRow({ person, selfId, pair }: { person: FixturePerson; selfId: string | null; pair: ReadingEntry | null }) {
  const note = person.note?.trim() ?? '';
  const detailHref = previewHref(`/me/people/${person.personId}`);
  const compatHref = previewHref(
    pair !== null
      ? readingHref(pair)
      : selfId === null
        ? `/compat#b.person=${person.personId}`
        : `/compat#a.person=${selfId}&b.person=${person.personId}`,
  );

  return (
    <li
      className={`relative mx-2 grid grid-cols-[3rem_minmax(0,1fr)_1.25rem] items-center gap-x-4 gap-y-3 rounded-2xl px-3 py-3.5 sm:grid-cols-[3rem_minmax(0,1fr)_auto_1.25rem] sm:px-4 ${styles.row}`}
    >
      <Avatar person={person} />

      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <Link href={detailHref} className={`max-w-full shrink-0 truncate ${TYPE.label} ${styles.rowLink}`}>
            {person.local_label}
          </Link>
          {note !== '' && <span className={`hidden min-w-0 flex-1 truncate sm:block ${TYPE.caption}`}>{note}</span>}
        </div>
        {person.chart.ok ? (
          <Glyphs saju={person.chart.saju} label={person.local_label} />
        ) : (
          <p className={`mt-0.5 ${TYPE.caption}`}>{person.chart.message}</p>
        )}
      </div>

      <Chevron className="col-start-3 row-start-1 sm:col-start-4" />

      {person.chart.ok && (
        <div className="col-span-2 col-start-2 flex items-center gap-2 sm:col-span-1 sm:col-start-3 sm:row-start-1">
          <ReadingChip personId={person.personId} reading={person.reading} />
          <Link href={compatHref} className={`${BUTTON.chip} ${styles.hit}`}>
            {selfId === null ? '궁합 보기' : '나와 궁합'}
            {pair?.score != null && <span className="ml-0.5 font-bold tabular-nums text-[var(--fin-accent-text)]">{pair.score}점</span>}
          </Link>
        </div>
      )}
    </li>
  );
}

function ReadingChip({ personId, reading }: { personId: string; reading: ReadingEntry | null }) {
  const href = previewHref(`/me/readings/${personId}`);
  if (reading === null) {
    return (
      <Link href={href} className={`${BUTTON.chipAccent} ${styles.hit}`}>
        <Icon name="spark" className="size-4" stroke={2} />
        사주풀이 받기
      </Link>
    );
  }
  return (
    <Link href={href} className={`${BUTTON.chip} ${styles.hit}`}>
      사주풀이 보기
      {!reading.fromCurrentChart && <OldChart />}
    </Link>
  );
}

/** 일간 글자 원 — 오행 옅은 면에 그 색 글자. 못 읽는 명식은 물음표 */
function Avatar({ person }: { person: FixturePerson }) {
  if (!person.chart.ok) {
    return (
      <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--fin-weak)] text-lg font-bold text-[var(--fin-faint)]">
        ?
      </span>
    );
  }
  const { dayMaster } = person.chart.saju.pillars;
  const element = STEM_INFO[dayMaster].element;
  const tone = ELEMENT_TONE[element];
  return (
    <span
      role="img"
      aria-label={`일간 ${dayMaster}, ${ELEMENT_KO[element]}`}
      className={`grid size-12 shrink-0 place-items-center rounded-full ${tone.surface}`}
    >
      <span aria-hidden="true" className={`glyph text-[1.5rem] font-bold leading-none ${tone.text}`}>
        {dayMaster}
      </span>
    </span>
  );
}

/** 여덟 글자 한 줄 — 둘째 줄의 흐린 설명 자리에 선다. 일주만 진하다 */
function Glyphs({ saju, label }: { saju: Saju; label: string }) {
  return (
    <p className="mt-0.5 flex items-center gap-2 text-[0.9375rem] tabular-nums" aria-label={`${label}의 네 기둥`}>
      {PILLAR_COLUMNS.map(({ key, label: column }) => {
        const pillar = saju.pillars[key];
        if (pillar === null) {
          return (
            <span key={key} className="glyph text-[var(--fin-faint)]">
              <span aria-hidden="true">－－</span>
              <span className="sr-only">{HOUR_UNKNOWN_LABEL}</span>
            </span>
          );
        }
        const day = key === 'day';
        return (
          <span key={key} className={`glyph ${day ? 'font-bold' : 'font-medium'}`}>
            <span className="sr-only">{column} </span>
            <span className={ELEMENT_TONE[STEM_INFO[pillar.stem].element].text}>{pillar.stem}</span>
            <span className={ELEMENT_TONE[BRANCH_INFO[pillar.branch].element].text}>{pillar.branch}</span>
          </span>
        );
      })}
    </p>
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
