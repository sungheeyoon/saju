'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useRef, useState, useTransition } from 'react';

import { calculateChart } from '@/src/lib/input/chart';
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

import { BirthFields } from './birth-form';
import { SIDE_LABEL, SIDE_PERSON, SIDES } from './compat-view';
import { useHashParams, writeParams } from './hash-query';
import { openPairScreen, pairRelationFor, type PairAnswers, type PairSide } from './me/compat/actions';
import { PersonCombobox, type Choosable } from './person-combobox';
import { RelationChoice } from './relation-choice';
import {
  SameChartAsk,
  settleSaveOutcome,
  type SaveOutcome,
  type SameChartQuestion,
} from './same-chart-ask';
import { BUTTON_PRIMARY, SEGMENT, SEGMENT_ON, SEGMENTS } from './ui/buttons';
import { Icon } from './ui/icons';
import { reducedMotion } from './ui/motion';
import { CARD_FRAME, TYPE_META, TYPE_NAME } from './ui/surfaces';

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
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const now = params.toString();
    if (now === shown.current) return;
    shown.current = now;
    const a = slotFrom(params, 'a', people);
    const b = slotFrom(params, 'b', people);
    setSlots({ a: a ?? firstSlot(people), b: b ?? secondSlot(people) });
    /*
      **주소가 칸을 채웠으면 그 칸을 화면에 들인다**(ADR 0129 「2026-09-29 e+」). 같은 화면 아래의 관계 지도 · 사람
      타일의 「나와 궁합」이 이 칸을 채우는데, 칸은 맨 위라 누른 자리에서는 안 보인다 — 채워진 것을 보여 주고 초점을
      구역 제목에 옮긴다. 주소의 `#` 뒤는 id 가 아니라 Next 가 스스로 스크롤하지 않는다.
    */
    if (a === null && b === null) return;
    const section = root.current?.closest('section') ?? root.current;
    section?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'instant' : 'smooth' });
    section?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
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
  /**
   * **비어 있다는 말은 처음엔 도움말이고, 누르려 했거나 그 칸을 떠난 뒤에야 오류다**(2026-10-10 화면 점검 B19). 막 연
   * 화면이 ⚠ 를 단 「두 번째 사람을 골라 주세요」로 서면 아직 아무것도 안 한 사람을 나무란다.
   */
  const [tried, setTried] = useState(false);
  const [left, setLeft] = useState<Record<CompatSide, boolean>>({ a: false, b: false });

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

    if (opened.kind === 'failed') {
      /*
        **한 사람의 입력이 거절됐으면 그 칸으로 데려간다**(B10). 빈 칸은 누르기 전에 화면이 잡지만, 없는 음력 날 · 모르는
        출생지처럼 서버만 아는 거절은 단추 아래 알림 한 줄로만 섰다 — 폰에서 그 칸은 한 화면 위다.
      */
      if (opened.side !== undefined) bringTo(opened.side);
      return { failed: opened.message };
    }

    return {
      ask: {
        label: opened.same.label,
        answer: (sameperson) =>
          open({ ...answers, [opened.side]: sameperson ? opened.same.personId : null }),
      },
    };
  };

  const settle = (outcome: SaveOutcome) => settleSaveOutcome(outcome, setFailure, setQuestion);

  /**
   * **비어 있는 칸으로 데려간다**(B10). 단추는 잠긴 모양이어도 누름을 받는다(`aria-disabled`) — 받지 않으면 왜 안 되는지를
   * 단추 곁의 한 줄에서 찾아야 하고, 그 칸은 폰에서 한 화면 위에 있다. 초점은 붉어진 입력 → 아직 빈 입력 → 다 찼는데
   * 엔진이 거절했으면(없는 윤달 등) 생년월일의 첫 숫자 칸이다 — 화면에서 고를 수 있는 값 가운데 계산이 거절하는 것은 날짜뿐이다.
   */
  const bringTo = (side: CompatSide) => {
    const card = root.current?.querySelector<HTMLElement>(`[data-side="${side}"]`);
    if (card == null) return;
    card.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'instant' : 'smooth' });
    const fields = [...card.querySelectorAll<HTMLInputElement>('input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not(:disabled)')];
    const target =
      fields.find((one) => one.getAttribute('aria-invalid') === 'true') ??
      fields.find((one) => one.value === '') ??
      fields.find((one) => one.inputMode === 'numeric') ??
      card.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled)');
    target?.focus({ preventScroll: true });
  };

  const press = () => {
    if (!chosen || sameTwice) {
      setTried(true);
      const gap = missing(slots);
      bringTo(gap?.side ?? 'b');
      return;
    }
    setFailure(null);
    startOpening(async () => settle(await open({})));
  };

  const gap = missing(slots);
  const reason = !opening && (gap !== null || sameTwice)
    ? sameTwice ? '같은 사람은 한 번만 고를 수 있어요. 서로 다른 두 사람을 골라 주세요.' : gap?.text ?? null
    : null;
  /** 오류 모양은 누르려 했거나 빈 칸을 떠난 뒤 — 같은 사람 둘은 처음부터 고친 값이 아니라 틀린 값이라 오류다 */
  const reasonIsError = sameTwice || tried || (gap !== null && left[gap.side]);

  return (
    <div ref={root} className={CARD_FRAME}>
      <h3 className={`px-5 pt-6 sm:px-6 ${TYPE_NAME}`}>누구와 누구를 볼까요?</h3>
      <div className="grid items-start sm:grid-cols-[1fr_auto_1fr]">
        {SIDES.map((side) => (
          <Fragment key={side}>
            {side === 'b' && <span aria-hidden="true" className="self-center text-center text-2xl text-secondary">×</span>}
            <SlotCard
              side={side}
              slot={slots[side]}
              people={people}
              /* 다른 칸에서 고른 사람은 여기서 뺀다 — 같은 사람 둘은 애초에 못 고른다 */
              taken={otherSaved(slots, side)}
              onChange={(next) => setSlot(side, next)}
              onLeave={() => setLeft((now) => (now[side] ? now : { ...now, [side]: true }))}
            />
          </Fragment>
        ))}
      </div>

      {/*
        **「궁합 보기」는 사이를 묻는 칩 줄의 오른쪽 끝이다**(운영자 2026-09-29). 칩 아래 따로 선 줄이면 사이를 고른 손이
        다시 아래로 내려가야 했다. 같은 이름의 확인(`SameChartAsk`)이 서는 동안에는 단추가 비키고 확인이 칩 줄 아래, 이 띠
        안에 선다 — 실패 알림도 같은 자리다. 판 바로 아래(띠 밖)에 두면 제 테두리가 판의 테에 붙어 두 줄로 겹쳤다(2026-10-08).
      */}
      <div className="border-t border-border bg-surface-soft/60 p-5 sm:p-6">
        <RelationChoice
          value={relation}
          onChange={(next) => {
            answered.current = pairKey;
            setRelation(next);
          }}
          idPrefix="pair"
          action={
            question === null ? (
              <button
                type="button"
                onClick={press}
                disabled={opening}
                aria-disabled={!chosen || sameTwice || undefined}
                aria-describedby={reason !== null ? 'compat-locked-reason' : undefined}
                className={`${BUTTON_PRIMARY} min-w-40 sm:min-w-44`}
              >
                <Icon name="taiji" className="size-[18px]" />
                {opening ? '여는 중…' : '궁합 보기'}
              </button>
            ) : undefined
          }
        />

        {/* 왜 눌리지 않는지 단추 곁에서 말한다 — 잠긴 단추만 두면 이유를 찾아야 한다 */}
        {question === null && reason !== null && (
          <p
            id="compat-locked-reason"
            className={`mt-2 flex items-center justify-end gap-1.5 text-right text-[13px] leading-5 ${
              reasonIsError ? 'font-medium text-danger' : 'text-secondary'
            }`}
          >
            {reasonIsError && <Icon name="alert" className="size-4 shrink-0" />}
            {reason}
          </p>
        )}

        {question !== null && (
          <div className="mt-4">
            <SameChartAsk
              question={question}
              busy={opening}
              onAnswer={(sameperson) => {
                setFailure(null);
                startOpening(async () => settle(await question.answer(sameperson)));
              }}
            />
          </div>
        )}

        {failure !== null && (
          <p role="alert" className="mt-4 rounded-[1.5rem] border border-danger/30 bg-surface px-5 py-4 text-[15px] leading-6 text-danger">
            {failure}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * 한 칸 — 저장한 이름을 먼저 보여 주고, 바로 아래에서 직접 입력으로 바꿀 수 있다.
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
  onLeave,
}: {
  side: CompatSide;
  slot: Slot;
  people: Choosable[];
  taken: string | null;
  onChange: (next: Slot) => void;
  /** 초점이 이 칸 밖으로 나갔다 — 비어 있는 말을 오류 모양으로 바꾸는 신호 */
  onLeave: () => void;
}) {
  return (
    <fieldset
      data-side={side}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onLeave();
      }}
      className="flex min-w-0 flex-col gap-3 p-5 sm:p-6"
    >
      {/*
        **두 칸의 머리 표지**(B10) — 둘 다 직접 입력이면 같은 폼 두 벌이 위아래로 서서 어느 쪽을 적는지 칸만 보고는 몰랐다.
        결과 판이 쓰는 글자와 같은 상수다.
      */}
      <legend className="contents">
        <span className={`block ${TYPE_META}`}>{SIDE_PERSON[side]}</span>
      </legend>

      {slot.from === 'saved' && (
        <div className="min-w-0">
          {/* 찾아 고르는 칸 — 저장한 사람이 스물 · 백이어도 읽히게(ADR 0102) */}
          <PersonCombobox
            label={SIDE_LABEL[side]}
            hideLabel
            placeholder="상대를 골라 주세요"
            people={people}
            taken={taken}
            chosenId={slot.personId}
            onChoose={(personId) => onChange({ from: 'saved', personId })}
          />
          {people.length === 0 && <span className={TYPE_META}>아직 저장한 사람이 없어요.</span>}
        </div>
      )}

      <div className={`${SEGMENTS} grid-cols-2`}>
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
            /*
              **누르는 동안 위 이름 칸이 초점을 잃지 않게**(목록의 옵션과 같은 까닭). 이 단추는 펼친 목록 **아래**에 선다 —
              누르는 순간 칸이 초점을 잃으면 목록이 닫히며 단추가 위로 올라가고, 손을 뗀 자리에 단추가 없어 누름이 사라졌다
              (2026-10-09 운영자 재현, #543 이 칸을 단추 위로 올리며 생겼다). 초점은 누른 뒤 이 단추에 준다 — 직접 입력으로
              바뀌면 이름 칸이 사라져 초점이 갈 곳을 잃는다.
            */
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.currentTarget.focus();
              onChange(from === 'saved' ? { from, personId: '' } : { from, query: DEFAULT_QUERY });
            }}
            className={slot.from === from ? SEGMENT_ON : SEGMENT}
          >
            {label}
          </button>
        ))}
      </div>

      {slot.from === 'typed' && (
        <div className="min-w-0">
          <BirthFields
            value={slot.query}
            onChange={(next) => onChange({ from: 'typed', query: next })}
            namePlaceholder="이름"
            surface="flat"
          />
        </div>
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

/**
 * 그 칸이 다 찼고 **계산도 되는가** — 없는 윤달처럼 다 적었어도 엔진이 거절하는 입력이 있다. 그 까닭은 칸 아래(`BirthFields`)가
 * 이미 말하는데, 여기서 안 보면 단추가 서버까지 갔다가 판 맨 아래에 같은 말을 한 번 더 세웠다(B10).
 */
const complete = (slot: Slot): boolean =>
  slot.from === 'saved' ? slot.personId !== '' : calculateChart(slot.query).ok && missingAnswer(slot.query) === null;

/** 먼저 비어 있는 칸 하나 — 둘을 한꺼번에 늘어놓지 않는다. 어느 칸인지도 준다(그 칸으로 데려가려고) */
const missing = (slots: Record<CompatSide, Slot>): { side: CompatSide; text: string } | null => {
  for (const side of SIDES) {
    const slot = slots[side];
    if (slot.from === 'saved') {
      if (slot.personId === '') return { side, text: `${SIDE_PERSON[side]}을 골라 주세요.` };
      continue;
    }
    const gap = missingAnswer(slot.query);
    if (gap !== null) return { side, text: `${SIDE_PERSON[side]}의 ${gap}` };
    /* 계산이 거절한 까닭은 엔진의 문장 그대로다 — 「첫 번째 사람의」를 앞에 붙이면 문장이 깨진다. 칸이 어느 사람인지는 데려간 칸이 말한다 */
    const refused = calculateChart(slot.query);
    if (!refused.ok) return { side, text: refused.message };
  }
  return null;
};

const otherSaved = (slots: Record<CompatSide, Slot>, side: CompatSide): string | null => {
  const other = slots[side === 'a' ? 'b' : 'a'];
  return other.from === 'saved' && other.personId !== '' ? other.personId : null;
};

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
