import Link from 'next/link';

import { storedChartOf, type StoredInput } from '@/src/lib/input/stored';
import type { PersonSlots } from '@/src/lib/people';

import { BUTTON_PRIMARY, BUTTON_TERTIARY } from '../../ui/buttons';
import { Icon } from '../../ui/icons';
import { EMPTY_SLOT, TYPE_SECTION } from '../../ui/surfaces';
import type { ReadingEntry } from '../reading/current';
import type { Circle } from './circle';
import { compatHrefOf, pairWithSelf, readingOf, type HomePerson } from './map/model';
import { PersonTile } from './person-tile';

/**
 * **나와 내가 저장한 사람 — 관계 지도와 사람 타일이 같이 쓰는 것.**
 *
 * 둘은 다른 탭에 선다(u2, 운영자 2026-09-29). **저장한 사람 타일은 홈 탭(`/me`)** 의 맨 아래 — 프로덕션 홈(`a45e34e`)의
 * 타일 그대로다(`MyPeople`). **관계 지도는 궁합 탭(`/compat`)** 의 아래에 남는다(`app/compat/relation-map-section.tsx`,
 * ADR 0129 「2026-09-29 u2」 — 궁합 탭에는 타일이 없다).
 *
 * **여기서 읽지 않는다**(2026-09-30). 엣지(`myCircle`)와 사람들의 입력(`storedInputsOf`)은 부르는 화면이 제 읽기와 겹쳐 한 번씩
 * 읽어 넘긴다 — 이 자리가 스스로 읽던 동안 홈 탭은 엣지 · 내 입력을 두 번 읽고 그 뒤에 한 물결을 더 기다렸고, 궁합 탭도 같았다.
 */
export function circlePeopleOf(circle: Circle, inputs: ReadonlyMap<string, StoredInput>): HomePerson[] {
  return circle.people.map((edge) => {
    const stored = inputs.get(edge.personId);
    /* 입력이 없는 사람 — 읽을 것이 없다는 말과 못 읽는다는 말을 여기서 합친다(저장한 사람 화면과 같다) */
    const stood =
      stored === undefined
        ? ({ ok: false, message: '출생 정보를 불러오지 못했어요.' } as const)
        : storedChartOf(stored, edge.label);
    return {
      personId: edge.personId,
      label: edge.label,
      note: edge.note,
      chart: stood.ok ? { ok: true, saju: stood.saju } : { ok: false, message: stood.message },
    };
  });
}

function tileOfWith(readings: readonly ReadingEntry[], selfPersonId: string, making: ReadonlySet<string>) {
  return (person: HomePerson) => {
    const pair = pairWithSelf(readings, selfPersonId, person.personId);
    return {
      reading: readingOf(readings, person.personId),
      making: making.has(person.personId),
      compat: { href: compatHrefOf(pair, selfPersonId, person.personId), score: pair?.score ?? null },
    };
  };
}

/**
 * **홈 탭의 저장한 사람** — 타일만(u2). 타일의 결과 링크는 `from=me` 를 든다(`from-me.ts`). 넓은 화면은 4열이다 — 지도 옆이
 * 아니라 화면 폭을 다 쓴다(프로덕션 홈과 같다).
 */
export function MyPeople({
  selfPersonId,
  readings,
  circle,
  people,
  making = new Set(),
}: {
  selfPersonId: string;
  readings: readonly ReadingEntry[];
  circle: Circle;
  people: readonly HomePerson[];
  /** 사주풀이를 지금 만드는 중인 사람들(ADR 0157) */
  making?: ReadonlySet<string>;
}) {
  return <SavedPeople people={people} slots={circle.slots} tileOf={tileOfWith(readings, selfPersonId, making)} fromMe />;
}

/**
 * 저장한 사람 — 사람마다 제 일간 색의 타일 한 장. 폰 2열 · 태블릿 3열 · 넓은 화면 4열.
 *
 * 몇 자리를 썼는지는 **DB 가 센다**(`my_person_slots`) — 못 읽었으면 수를 안 세운다. 빼기를 화면이 하면
 * 내 사주를 잊는 자리가 생긴다.
 */
function SavedPeople({
  people,
  slots,
  tileOf,
  fromMe = false,
}: {
  people: readonly HomePerson[];
  slots: PersonSlots | null;
  tileOf: (person: HomePerson) => Omit<Parameters<typeof PersonTile>[0], 'person' | 'fromMe'>;
  fromMe?: boolean;
}) {
  const full = slots !== null && slots.remaining <= 0;

  return (
    <section aria-labelledby="home-people" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 id="home-people" className={`${TYPE_SECTION} flex items-baseline gap-2`}>
          저장한 사람
          {slots !== null && (
            <span className="font-sans text-[13px] font-semibold tabular-nums text-secondary">
              {slots.used}/{slots.limit}명
            </span>
          )}
        </h2>
        {people.length > 0 && (
          /* 바로 위 제목이 「저장한 사람」이라 화면 글자는 「관리」, 읽는 이름은 온전히 */
          <Link href="/me/people" className={BUTTON_TERTIARY} aria-label="저장한 사람 관리">
            관리
            <Icon name="arrow" className="size-4" />
          </Link>
        )}
      </div>

      {people.length === 0 ? (
        <div className={`${EMPTY_SLOT} flex flex-col items-start gap-4`}>
          <p className="text-[15px] leading-6 text-secondary">가족이나 친구의 출생 정보를 저장하고 관리하세요.</p>
          <Link href="/me/people" className={BUTTON_PRIMARY}>
            <Icon name="plus" className="size-[18px]" />
            사람 추가
          </Link>
        </div>
      ) : (
        <ul className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${fromMe ? 'lg:grid-cols-4' : ''}`}>
          {people.map((person) => (
            <PersonTile key={person.personId} person={person} {...tileOf(person)} fromMe={fromMe} />
          ))}
          {!full && <AddTile slots={slots} />}
        </ul>
      )}
      {slots !== null && full && <p className="text-[13px] text-secondary">저장할 수 있는 {slots.limit}명을 다 채웠어요.</p>}
    </section>
  );
}

/** 목록 끝의 빈 타일 — 다른 타일과 같은 크기라 「한 자리 더」로 읽힌다 */
function AddTile({ slots }: { slots: PersonSlots | null }) {
  return (
    <li>
      <Link
        href="/me/people"
        className="flex h-full min-h-44 flex-col items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-border-strong p-4 text-center text-foreground hover:bg-surface active:scale-[0.98]"
      >
        <span className="grid size-12 place-items-center rounded-full bg-accent text-on-accent">
          <Icon name="plus" />
        </span>
        <span className="text-[15px] font-semibold">사람 추가</span>
        {slots !== null && (
          <span className="text-[13px] tabular-nums text-secondary">
            {slots.used}/{slots.limit}명
          </span>
        )}
      </Link>
    </li>
  );
}
