import Link from 'next/link';

import { storedChartOf } from '@/src/lib/input/stored';
import type { PersonSlots } from '@/src/lib/people';

import { supabaseOnServer } from '../../auth/server-client';
import { BUTTON_PRIMARY, BUTTON_TERTIARY } from '../../ui/buttons';
import { Icon } from '../../ui/icons';
import { EMPTY_SLOT, TYPE_SECTION } from '../../ui/surfaces';
import { storedInputOf, storedInputsOf } from '../person-input';
import type { ReadingEntry } from '../reading/current';
import { myCircle } from './circle';
import { compatHrefOf, mapModelOf, pairWithSelf, readingOf, type HomePerson } from './map/model';
import { RelationMap } from './map/relation-map';
import { PersonTile } from './person-tile';

/**
 * **나와 내가 저장한 사람 — 관계 지도와 사람 타일.** 궁합 탭 첫 화면(`/compat`)의 윗부분이다(ADR 0129).
 *
 * 나 탭 홈(`/me`)에 살다가 궁합 탭으로 옮겼다 — 지도가 긋는 선이 궁합이고, 타일의 「나와 궁합」이 궁합으로 가는 길이라
 * 그 둘이 서는 곳이 궁합 탭이다. 부품은 그대로다. 지도의 원은 자바스크립트가 없으면 아래 타일(`#person-…`)로 가므로
 * 둘은 **한 화면에 함께 선다.**
 *
 * 내 사주 · 저장한 사람 · 사람들의 입력을 읽는다. 왕복은 둘이다 — 엣지와 내 입력을 겹쳐 읽고, 사람들의 입력은 엣지를
 * 알아야 하므로 뒤에 한 번 더 묶어 읽는다. 만든 풀이 목록은 부르는 화면이 이미 읽었으므로 받는다.
 */
export async function MyCircle({
  selfPersonId,
  readings,
}: {
  selfPersonId: string;
  readings: readonly ReadingEntry[];
}) {
  const supabase = await supabaseOnServer();

  const [circle, self] = await Promise.all([myCircle(supabase, selfPersonId), storedInputOf(supabase, selfPersonId)]);
  const inputs = await storedInputsOf(
    supabase,
    circle.people.map((person) => person.personId),
  );

  const people: HomePerson[] = circle.people.map((edge) => {
    const stored = inputs.get(edge.personId);
    /* 입력이 없는 사람 — 읽을 것이 없다는 말과 못 읽는다는 말을 여기서 합친다(저장한 사람 화면과 같다) */
    const stood =
      stored === undefined
        ? ({ ok: false, message: '저장된 출생 정보를 읽지 못했습니다.' } as const)
        : storedChartOf(stored, edge.label);
    return {
      personId: edge.personId,
      label: edge.label,
      note: edge.note,
      chart: stood.ok ? { ok: true, saju: stood.saju } : { ok: false, message: stood.message },
    };
  });

  /*
    **지도의 가운데는 나다** — 내 명식을 못 세우면 지도를 안 그린다. 모르는 출생지를 서울로 메워 다른 사주를 가운데에
    세우지 않는다. 내 사주를 못 읽었다는 말은 나 탭의 카드 자리가 한다 — 여기서는 사람 타일만 선다.
  */
  const stood = self !== null && circle.self !== null ? storedChartOf(self.input, circle.self.label) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-8">
      {stood !== null && stood.ok && (
        <RelationMap
          model={mapModelOf({ self: { personId: selfPersonId, label: stood.query.name, saju: stood.saju }, people, readings })}
          addHref="/me/people"
          canAdd={circle.slots === null || circle.slots.remaining > 0}
        />
      )}

      <SavedPeople
        people={people}
        slots={circle.slots}
        tileOf={(person) => {
          const pair = pairWithSelf(readings, selfPersonId, person.personId);
          return {
            reading: readingOf(readings, person.personId),
            compat: { href: compatHrefOf(pair, selfPersonId, person.personId), score: pair?.score ?? null },
          };
        }}
      />
    </div>
  );
}

/**
 * 저장한 사람 — 사람마다 제 일간 색의 타일 한 장. 폰 2열 · 태블릿 3열 · 넓은 화면은 지도 옆에서 3열.
 *
 * 몇 자리를 썼는지는 **DB 가 센다**(`my_person_slots`) — 못 읽었으면 수를 안 세운다. 빼기를 화면이 하면
 * 내 사주를 잊는 자리가 생긴다.
 */
function SavedPeople({
  people,
  slots,
  tileOf,
}: {
  people: readonly HomePerson[];
  slots: PersonSlots | null;
  tileOf: (person: HomePerson) => Omit<Parameters<typeof PersonTile>[0], 'person'>;
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
          <Link href="/me/people" className={BUTTON_TERTIARY}>
            전체 관리
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
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {people.map((person) => (
            <PersonTile key={person.personId} person={person} {...tileOf(person)} />
          ))}
          {!full && <AddTile slots={slots} />}
        </ul>
      )}
      {slots !== null && full && <p className="text-[13px] text-secondary">등록할 수 있는 {slots.limit}명을 다 채웠습니다.</p>}
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
