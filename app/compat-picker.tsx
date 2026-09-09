'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import type { Relation } from '@/src/lib/people';
import {
  DEFAULT_QUERY,
  mergeSearchParams,
  missingAnswer,
  PREFIX,
  queryFromSearchParams,
  toSearchParams,
  type Query,
} from '@/src/lib/input/query';
import type { CompatSide } from '@/src/lib/saju';

import { BirthFields, FIELD, SelectShell } from './birth-form';
import { CARD } from './card';
import { useHashParams, writeParams } from './hash-query';
import { openPairScreen, pairRelationFor, type PairAnswers, type PairSide } from './me/compat/actions';
import { RelationChoice } from './relation-choice';
import { SameChartAsk, type SaveOutcome, type SameChartQuestion } from './same-chart-ask';

/**
 * 궁합의 **첫 걸음** — 두 사람을 정하고 사이를 답하는 자리.
 *
 * ## 탭 둘을 없앴다
 *
 * 「두 사람 직접 입력」과 「저장한 사람 선택」이 화면 둘로 갈려 있었다. 나뉜 것은 **사람이
 * 아니라 입력 방법**인데 화면이 갈리니, 「내 사주 × 방금 들은 그 사람의 생일」처럼 섞인
 * 조합은 갈 곳이 없었다. 한 화면으로 두고 **칸마다** 어디서 올지를 고른다.
 *
 * ## 여기서 사이를 묻는다
 *
 * 두 명식을 보고 나서가 아니라 **보기 전에** 묻는다(ADR 0019). 다음 화면은 이 답이
 * 정해진 채로 서고 거기서는 다시 안 묻는다 — 한 흐름에서 같은 것을 두 번 물으면
 * 사용자는 그것을 서로 다른 두 물음으로 읽는다.
 *
 * ## 누르면 두 사람이 굳는다
 *
 * 직접 적은 쪽은 이 누름에서 사람이 된다. **사람 목록에는 안 서고 열 자리도 안 쓴다**
 * (ADR 0053) — 다음 화면이 두 사람의 대상을 들고 있어야 거기서 풀이를 만들 수 있기
 * 때문이고, 사용자가 저장한 적 없는 것이 목록에 설 이유는 없기 때문이다.
 *
 * 글은 여기서 안 만든다. 이 누름이 여는 것은 두 명식이 나란히 선 화면이고, 풀이권을
 * 쓰는 누름은 거기 있다(ADR 0028).
 */
export type Choosable = { personId: string; label: string; isSelf: boolean };

/** 한 칸이 들고 있는 것 — 고른 사람이거나 적어 넣은 입력이다 */
type Slot = { from: 'saved'; personId: string } | { from: 'typed'; query: Query };

const SIDES = ['a', 'b'] as const;
const SIDE_LABEL: Record<CompatSide, string> = { a: '첫 번째', b: '두 번째' };

/** 주소에 담긴 한 칸을 읽는다 — `a.person` 이 있으면 고른 사람이다 */
function slotFrom(params: URLSearchParams, side: CompatSide, people: Choosable[]): Slot | null {
  const chosen = params.get(`${PREFIX[side]}person`);
  if (chosen !== null && people.some((one) => one.personId === chosen)) {
    return { from: 'saved', personId: chosen };
  }

  const typed = queryFromSearchParams(params, PREFIX[side]);
  return typed === null ? null : { from: 'typed', query: typed };
}

/**
 * 처음 서는 모양 — **고를 사람이 있으면 고르는 칸에서 시작한다.**
 *
 * 첫 칸은 자기 사주로 채운다. 궁합을 보러 오는 사람은 대개 자기와 누군가를 견주려는
 * 것이고, 아니면 한 번 바꾸면 된다. 고를 사람이 없으면 그 칸은 있어 봐야 빈 목록이라
 * 적는 칸으로 선다.
 */
const firstSlot = (people: Choosable[]): Slot => {
  const self = people.find((one) => one.isSelf) ?? people[0];
  return self === undefined ? { from: 'typed', query: DEFAULT_QUERY } : { from: 'saved', personId: self.personId };
};

const secondSlot = (people: Choosable[]): Slot =>
  people.length >= 2 ? { from: 'saved', personId: '' } : { from: 'typed', query: DEFAULT_QUERY };

export function CompatPicker({ people }: { people: Choosable[] }) {
  const router = useRouter();
  const params = useHashParams();

  const [slots, setSlots] = useState<Record<CompatSide, Slot>>(() => ({
    a: slotFrom(params, 'a', people) ?? firstSlot(people),
    b: slotFrom(params, 'b', people) ?? secondSlot(people),
  }));

  /**
   * **주소가 바뀌면 칸도 따라간다.**
   *
   * 첫 렌더는 `#` 뒤를 못 읽는다 — 이 화면은 빌드 때 미리 그려지고 조각은 서버에 오지
   * 않으므로, 처음 서는 값은 「아무것도 없음」이고 주소는 그 뒤에 온다. 그래서 사람
   * 상세의 「이 사람과 궁합 보기」(`#a.person=…`)로 열면 채워진 채로 서야 할 칸이 비어
   * 있었다.
   *
   * **본 것과 다를 때만** 갈아 끼운다(`shown`). 매번 세우면 사용자가 방금 적은 것을
   * 주소가 덮는다 — 원국 화면이 같은 자리를 같은 방식으로 지킨다.
   */
  const shown = useRef(params.toString());
  useEffect(() => {
    const now = params.toString();
    if (now === shown.current) return;
    shown.current = now;
    setSlots({
      a: slotFrom(params, 'a', people) ?? firstSlot(people),
      b: slotFrom(params, 'b', people) ?? secondSlot(people),
    });
  }, [params, people]);

  const [relation, setRelation] = useState<Relation | null>(null);
  /**
   * **이 누름이 사이를 건드리는가.**
   *
   * 칸은 늘 「아직 모르겠음」에서 시작한다. 안 건드린 것을 답으로 보내면, 지난번에
   * 「가족」이라 답해 둔 두 사람을 다시 고르기만 해도 그 답이 지워진다.
   */
  const answered = useRef<string | null>(null);
  const [question, setQuestion] = useState<SameChartQuestion | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [opening, startOpening] = useTransition();

  const chosen = SIDES.every((side) => complete(slots[side]));
  const sameTwice =
    slots.a.from === 'saved' && slots.b.from === 'saved' && slots.a.personId === slots.b.personId;

  /** 차례를 안 타는 쌍 이름 — 첫째·둘째를 바꿔 골라도 같은 쌍이다(DB 와 같은 규율) */
  const pairKey =
    slots.a.from === 'saved' && slots.b.from === 'saved' && chosen && !sameTwice
      ? [slots.a.personId, slots.b.personId].sort().join('|')
      : '';

  /**
   * **적어 둔 답을 칸에 세운다.** 화면이 저장 상태를 그대로 보여 주면 그 화면을 눌러도
   * 아무것도 안 지워진다. 직접 적은 칸이 끼면 그 사람이 아직 없으므로 읽을 답도 없다.
   */
  useStoredRelation(pairKey, answered, setRelation);

  const setSlot = (side: CompatSide, next: Slot) => {
    setFailure(null);
    setSlots((now) => ({ ...now, [side]: next }));
  };

  const open = async (answers: PairAnswers): Promise<SaveOutcome> => {
    const opened = await openPairScreen(
      sideOf(slots.a),
      sideOf(slots.b),
      answered.current === pairKey || pairKey === '' ? relation : undefined,
      answers,
    );

    if (opened.ok) {
      /* 뒤로 왔을 때 고른 것이 그대로 서 있게 — 주소가 이 화면의 상태다 */
      shown.current = paramsOf(slots);
      writeParams(shown.current, 'replace');
      router.push(`/me/compat?a=${opened.personA}&b=${opened.personB}`);
      return { done: true };
    }

    if (opened.kind === 'failed') return { failed: opened.message };

    return {
      ask: {
        label: opened.same.label,
        answer: (sameperson) =>
          open({ ...answers, [opened.side]: sameperson ? opened.same.personId : null }),
      },
    };
  };

  const settle = (outcome: SaveOutcome) => {
    if ('failed' in outcome) {
      setFailure(outcome.failed);
      setQuestion(null);
      return;
    }
    setQuestion('ask' in outcome ? outcome.ask : null);
  };

  const press = () => {
    if (!chosen || sameTwice) return;
    setFailure(null);
    startOpening(async () => settle(await open({})));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {SIDES.map((side) => (
          <SlotCard
            key={side}
            side={side}
            slot={slots[side]}
            people={people}
            /* 다른 칸에서 고른 사람은 여기서 뺀다 — 같은 사람 둘은 애초에 못 고른다 */
            taken={otherSaved(slots, side)}
            onChange={(next) => setSlot(side, next)}
          />
        ))}
      </div>

      <div className={CARD}>
        <RelationChoice
          value={relation}
          onChange={(next) => {
            answered.current = pairKey;
            setRelation(next);
          }}
          idPrefix="pair"
        />
      </div>

      {question !== null ? (
        <SameChartAsk
          question={question}
          busy={opening}
          onAnswer={(sameperson) => {
            setFailure(null);
            startOpening(async () => settle(await question.answer(sameperson)));
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={press}
            disabled={!chosen || sameTwice || opening}
            className="h-11 w-full rounded-md bg-accent-strong px-5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-auto"
          >
            {opening ? '여는 중…' : '두 사람 명식 보기'}
          </button>

          {/* 왜 눌리지 않는지 버튼 옆에서 말한다 — 잠긴 버튼만 두면 이유를 찾아야 한다 */}
          {!opening && (missing(slots) !== null || sameTwice) && (
            <p className="text-sm text-secondary">
              {sameTwice ? '같은 사람 둘로는 궁합을 볼 수 없습니다.' : missing(slots)}
            </p>
          )}
        </div>
      )}

      {failure !== null && (
        <p role="alert" className={`${CARD} text-sm leading-6 text-danger`}>
          {failure}
        </p>
      )}
    </div>
  );
}

/**
 * 한 칸 — **어디서 올지를 먼저 고르고 그다음에 답한다.**
 *
 * 두 갈래가 한 카드 안에 서는 것이 요점이다. 화면을 갈라 두면 「이 사람은 저장돼 있고
 * 저 사람은 아니다」가 갈 곳이 없어진다.
 */
function SlotCard({
  side,
  slot,
  people,
  taken,
  onChange,
}: {
  side: CompatSide;
  slot: Slot;
  people: Choosable[];
  taken: string | null;
  onChange: (next: Slot) => void;
}) {
  const name = slot.from === 'typed' ? slot.query.name.trim() : labelOf(people, slot.personId);

  return (
    <fieldset className={`${CARD} flex flex-col gap-4`}>
      <legend className="px-1 text-sm font-medium">
        {name === '' ? `${SIDE_LABEL[side]} 사람` : name}
      </legend>

      <div className="flex gap-1 rounded-xl bg-surface-sunken p-1">
        {(
          [
            ['saved', '저장한 사람'],
            ['typed', '직접 입력'],
          ] as const
        ).map(([from, label]) => (
          <button
            key={from}
            type="button"
            aria-pressed={slot.from === from}
            disabled={from === 'saved' && people.length === 0}
            onClick={() =>
              onChange(from === 'saved' ? { from, personId: '' } : { from, query: DEFAULT_QUERY })
            }
            className={`h-9 flex-1 rounded-lg text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
              slot.from === from ? 'bg-surface shadow-sm' : 'text-secondary hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {slot.from === 'saved' ? (
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">{SIDE_LABEL[side]}</span>
          <SelectShell>
            <select
              value={slot.personId}
              onChange={(event) => onChange({ from: 'saved', personId: event.target.value })}
              className={`${FIELD} w-full appearance-none pr-8`}
            >
              <option value="" disabled>
                고르기
              </option>
              {people
                .filter((one) => one.personId !== taken)
                .map((one) => (
                  <option key={one.personId} value={one.personId}>
                    {one.label}
                    {one.isSelf ? ' (나)' : ''}
                  </option>
                ))}
            </select>
          </SelectShell>
          {people.length === 0 && (
            <span className="text-xs text-muted">저장한 사람이 아직 없습니다.</span>
          )}
        </label>
      ) : (
        <BirthFields
          value={slot.query}
          onChange={(next) => onChange({ from: 'typed', query: next })}
          idPrefix={side}
          namePlaceholder={SIDE_LABEL[side]}
        />
      )}
    </fieldset>
  );
}

/** 저장된 답을 칸에 세우는 일 — 렌더 밖에서 한 번만 */
function useStoredRelation(
  pairKey: string,
  answered: React.RefObject<string | null>,
  setRelation: (next: Relation | null) => void,
) {
  useEffect(() => {
    if (pairKey === '') return;

    let alive = true;
    const [first, second] = pairKey.split('|');
    void pairRelationFor(first, second).then((stored) => {
      // 못 읽었으면 칸을 안 건드린다 — 「못 읽었다」를 「모른다」로 세우지 않는다.
      // 방금 사용자가 이 쌍에서 고른 것이 있으면 그것이 저장된 값보다 뒤의 답이다.
      if (!alive || !stored.ok || answered.current === pairKey) return;
      setRelation(stored.relation);
    });

    return () => {
      alive = false;
    };
  }, [pairKey, answered, setRelation]);
}

const complete = (slot: Slot): boolean =>
  slot.from === 'saved' ? slot.personId !== '' : missingAnswer(slot.query) === null;

/** 먼저 비어 있는 칸 하나 — 둘을 한꺼번에 늘어놓지 않는다 */
const missing = (slots: Record<CompatSide, Slot>): string | null => {
  for (const side of SIDES) {
    const slot = slots[side];
    if (slot.from === 'saved') {
      if (slot.personId === '') return `${SIDE_LABEL[side]} 사람을 골라 주세요.`;
      continue;
    }
    const gap = missingAnswer(slot.query);
    if (gap !== null) return `${SIDE_LABEL[side]} 사람의 ${gap}`;
  }
  return null;
};

const otherSaved = (slots: Record<CompatSide, Slot>, side: CompatSide): string | null => {
  const other = slots[side === 'a' ? 'b' : 'a'];
  return other.from === 'saved' && other.personId !== '' ? other.personId : null;
};

const labelOf = (people: Choosable[], personId: string): string =>
  people.find((one) => one.personId === personId)?.label ?? '';

const sideOf = (slot: Slot): PairSide =>
  slot.from === 'saved'
    ? { from: 'saved', personId: slot.personId }
    : { from: 'typed', query: slot.query };

/** 고른 것을 주소에 적는다 — 새로고침하거나 뒤로 와도 같은 자리에서 다시 시작한다 */
const paramsOf = (slots: Record<CompatSide, Slot>): string => {
  const each = SIDES.map((side) => {
    const slot = slots[side];
    if (slot.from === 'typed') return toSearchParams(slot.query, PREFIX[side]);

    const one = new URLSearchParams();
    one.set(`${PREFIX[side]}person`, slot.personId);
    return one;
  });

  return mergeSearchParams(...each).toString();
};
