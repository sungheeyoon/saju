import Link from 'next/link';

import { storedChartOf, type StoredInput } from '@/src/lib/input/stored';
import type { PersonSlots } from '@/src/lib/people';

import { Icon } from '../../ui/icons';
import { TYPE_SECTION } from '../../ui/surfaces';
import type { ReadingEntry } from '@/src/lib/reading';
import type { Circle } from './circle';
import { compatHrefOf, pairWithSelf, readingOf, type HomePerson } from './map/model';
import { HOME_HEAD, HOME_HEAD_COUNT, HOME_HEAD_LINK, HOME_LIST, HOME_ROW, HOME_ROW_INNER, HOME_ROW_LINK } from './home-list';
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
 * **홈 탭의 저장한 사람** — 흰 판 안의 줄 목록(2026-10-25 홈 위계 정리). 줄의 결과 링크는 `from=me` 를 든다(`from-me.ts`). 넓은 화면은
 * 줄이 두 열로 선다 — 화면 폭을 다 쓰는 한 줄은 이름과 끝 단추 사이가 너무 멀었다.
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
 * 저장한 사람 — 사람마다 흰 판 안의 줄 하나(`PersonTile`), 끝에 「사람 추가」 줄. 넓은 화면(`lg`)은 두 열이다.
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
    <section aria-labelledby="home-people" className="flex min-w-0 flex-col gap-2 sm:gap-4">
      <div className={HOME_HEAD}>
        <h2 id="home-people" className={`${TYPE_SECTION} flex items-baseline gap-1.5`}>
          저장한 사람
          {slots !== null && (
            <span className={HOME_HEAD_COUNT}>
              {slots.used}/{slots.limit}명
            </span>
          )}
        </h2>
        {people.length > 0 && (
          /* 바로 위 제목이 「저장한 사람」이라 화면 글자는 「관리」, 읽는 이름은 온전히 */
          <Link href="/me/people" className={HOME_HEAD_LINK} aria-label="저장한 사람 관리">
            관리
            <Icon name="chevron" className="size-4" />
          </Link>
        )}
      </div>

      {people.length === 0 ? (
        /* 아무도 없으면 같은 판에 설명 한 줄과 「사람 추가」 줄 — 주 단추(먹색)는 내 사주 카드에만 선다 */
        <ul className={HOME_LIST}>
          <li className={HOME_ROW}>
            <p className={`${HOME_ROW_INNER} break-keep text-pretty text-body leading-6 text-secondary`}>가족이나 친구의 출생 정보를 저장하고 관리하세요.</p>
          </li>
          <AddRow />
        </ul>
      ) : (
        <ul className={`${HOME_LIST} lg:grid lg:grid-cols-2`}>
          {people.map((person) => (
            <PersonTile key={person.personId} person={person} {...tileOf(person)} fromMe={fromMe} />
          ))}
          {!full && <AddRow />}
        </ul>
      )}
      {slots !== null && full && <p className="break-keep text-pretty text-small text-secondary">저장할 수 있는 {slots.limit}명을 다 채웠어요.</p>}
    </section>
  );
}

/**
 * 목록 끝의 「사람 추가」 줄 — 사람 줄과 같은 높이 · 같은 표시 자리라 「한 자리 더」로 읽힌다(카카오톡 친구 탭의 「친구 추가」 꼴).
 * 몇 자리를 썼는지는 바로 위 머리(「5/10명」)가 말한다 — 이 줄에 같은 수를 또 세우지 않는다(2026-10-26 2차)
 */
function AddRow() {
  return (
    <li className={HOME_ROW}>
      <Link href="/me/people" className={HOME_ROW_LINK}>
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-sunken text-foreground">
          <Icon name="plus" className="size-5" />
        </span>
        <span className="min-w-0 flex-1 text-body font-semibold">사람 추가</span>
      </Link>
    </li>
  );
}
