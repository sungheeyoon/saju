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
import type { CompatSide, Element } from '@/src/lib/saju';

import { BirthFields } from './birth-form';
import { SIDE_LABEL, SIDES } from './compat-view';
import { elementScope } from './ui/element-tone';
import { useHashParams, writeParams } from './hash-query';
import { openPairScreen, pairRelationFor, type PairAnswers, type PairSide } from './me/compat/actions';
import { PersonCombobox, type Choosable } from './person-combobox';
import { RelationChoice } from './relation-choice';
import { SameChartAsk, type SaveOutcome, type SameChartQuestion } from './same-chart-ask';
import { BUTTON_PRIMARY } from './ui/buttons';
import { ElementSymbol } from './ui/element-symbol';
import { Icon } from './ui/icons';
import { CARD, PAPER, TYPE_META, TYPE_NAME } from './ui/surfaces';

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
/** 한 칸이 들고 있는 것 — 고른 사람이거나 적어 넣은 입력이다 */
type Slot = { from: 'saved'; personId: string } | { from: 'typed'; query: Query };


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
  const self = people.find((one) => one.isSelfPerson) ?? people[0];
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

  const reason = !opening && (missing(slots) !== null || sameTwice)
    ? sameTwice ? '같은 사람 둘로는 궁합을 볼 수 없습니다.' : missing(slots)
    : null;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <PairStage
        sides={{ a: stageOf(slots.a, people, 'a'), b: stageOf(slots.b, people, 'b') }}
      />

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={press}
            disabled={!chosen || sameTwice || opening}
            aria-describedby={reason !== null ? 'compat-locked-reason' : undefined}
            className={`${BUTTON_PRIMARY} w-full sm:w-auto sm:min-w-44`}
          >
            <Icon name="heart" className="size-[18px]" />
            {opening ? '여는 중…' : '궁합 보기'}
          </button>

          {/* 왜 눌리지 않는지 버튼 옆에서 말한다 — 잠긴 버튼만 두면 이유를 찾아야 한다 */}
          {reason !== null && (
            <p id="compat-locked-reason" className="flex items-center gap-1.5 text-[15px] text-secondary">
              <Icon name="alert" className="size-4 shrink-0" />
              {reason}
            </p>
          )}
        </div>
      )}

      {failure !== null && (
        <p role="alert" className="rounded-[1.5rem] border border-danger/30 bg-surface px-5 py-4 text-[15px] leading-6 text-danger">
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
    <fieldset className={`flex min-w-0 flex-col gap-4 ${CARD}`}>
      {/*
        묶음의 이름은 **그 칸이 든 사람**이다 — 비어 있을 때만 「첫 번째 사람」. 몇 번째 칸인지는 이름이 찬 뒤에도
        보이게 위에 작게 적되(이름이 찼을 때만) 보조기기에는 이름만 읽힌다. `float-left w-full` — 안 두면 legend 가 판 위 가장자리에
        걸터앉는다.
      */}
      <legend className="float-left w-full">
        {name !== '' && (
          <span aria-hidden="true" className={`block ${TYPE_META}`}>
            {SIDE_LABEL[side]} 사람
          </span>
        )}
        <span className={`block truncate ${TYPE_NAME}`}>{name === '' ? `${SIDE_LABEL[side]} 사람` : name}</span>
      </legend>

      <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-sunken p-1">
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
            className={`min-h-11 rounded-full px-3 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${
              slot.from === from
                ? 'bg-surface text-foreground shadow-soft ring-1 ring-border'
                : 'text-secondary hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {slot.from === 'saved' ? (
        <>
          {/* 찾아 고르는 칸 — 저장한 사람이 스물 · 백이어도 읽히게(ADR 0102) */}
          <PersonCombobox
            label={SIDE_LABEL[side]}
            people={people}
            taken={taken}
            chosenId={slot.personId}
            onChoose={(personId) => onChange({ from: 'saved', personId })}
          />
          {people.length === 0 && <span className={TYPE_META}>저장한 사람이 아직 없습니다.</span>}
        </>
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

/** 두 원이 그리는 한 사람 — 이름과, 알면 일간 오행. 적는 칸의 사람은 아직 명식이 없어 물음표 원이다 */
type StageSide = { name: string; element: Element | null; filled: boolean };

const stageOf = (slot: Slot, people: Choosable[], side: CompatSide): StageSide => {
  if (slot.from === 'typed') {
    const name = slot.query.name.trim();
    return { name: name === '' ? `${SIDE_LABEL[side]} 사람` : name, element: null, filled: complete(slot) };
  }
  const one = people.find((person) => person.personId === slot.personId);
  return one === undefined
    ? { name: `${SIDE_LABEL[side]} 사람`, element: null, filled: false }
    : { name: one.label, element: one.element ?? null, filled: true };
};

/**
 * **나와 그 사람** — 고른 두 사람이 크림 종이 위에 두 원으로 마주 선다(홈의 관계 지도와 같은 말투).
 *
 * 원은 그 사람의 일간 색 · 상징을 입고, 둘 사이를 연필 선이 잇는다. 칸을 바꾸면 곧장 따라 바뀌어 「누구와
 * 누구를 보는가」를 입력칸을 읽기 전에 한눈에 말한다. 빈 칸은 점선 원이다. 그림이라 보조기기에는 안 읽히고,
 * 같은 사실은 아래 두 칸의 이름(`legend`)이 든다.
 */
function PairStage({ sides }: { sides: Record<CompatSide, StageSide> }) {
  return (
    <div aria-hidden="true" className={`${PAPER} relative overflow-hidden px-4 py-6 sm:px-8`}>
      <svg viewBox="0 0 300 60" preserveAspectRatio="none" className="absolute inset-x-[18%] top-[2.9rem] h-12 w-[64%] sm:top-[3.4rem]">
        <path
          d="M4 34 C 80 4, 220 4, 296 34"
          fill="none"
          stroke="var(--cream-ink)"
          strokeOpacity="0.45"
          strokeWidth="2"
          strokeDasharray="1 7"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <StageOne one={sides.a} />
        <span className="mt-5 grid size-11 place-items-center rounded-full bg-surface text-foreground shadow-lift ring-1 ring-border sm:mt-7">
          <Icon name="heart" className="size-5" />
        </span>
        <StageOne one={sides.b} />
      </div>
    </div>
  );
}

function StageOne({ one }: { one: StageSide }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <span
        className={`${elementScope(one.element)} grid size-20 place-items-center rounded-full sm:size-24 ${
          one.filled
            ? 'bg-[var(--tile)] shadow-raise ring-4 ring-surface'
            : 'border-2 border-dashed border-border-strong bg-[color-mix(in_srgb,var(--surface)_60%,transparent)]'
        }`}
      >
        <ElementSymbol element={one.element} className="size-10 sm:size-12" />
      </span>
      <span className={`max-w-full truncate font-rounded text-[1.15rem] leading-7 ${one.filled ? 'text-foreground' : 'text-secondary'}`}>
        {one.name}
      </span>
    </div>
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
