import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { calculateChart } from '@input/chart';
import { DEFAULT_QUERY, missingAnswer, type Query } from '@input/query';
import { RELATIONS, RELATION_LABEL, type Relation } from '@people';
import { findsInList, pickable } from '@people/pick';
import type { CompatSide } from '@saju';

import { BirthFields, useBirthForm } from '@/people/birth-fields';
import { FailureLine, styles as shared } from '@/people/parts';
import { SameChartAsk, type SameChartQuestion } from '@/people/same-chart-ask';
import { StemSymbol } from '@/people/stem-symbol';
import { ElementSymbol } from '@/ui/element-symbol';
import { Choices, Field, Panel, PrimaryButton } from '@/ui/parts';
import { COLOR, CONTROL, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { settled } from '@/ui/settled';

import { openPair, readPairRelation, type Choosable, type PairAnswers, type PairSide } from './data';

const SIDES: readonly CompatSide[] = ['a', 'b'];
const SIDE_LABEL: Record<CompatSide, string> = { a: '첫 번째', b: '두 번째' };
const SIDE_PERSON: Record<CompatSide, string> = { a: `${SIDE_LABEL.a} 사람`, b: `${SIDE_LABEL.b} 사람` };

/** 한 칸이 들고 있는 것 — 고른 사람이거나 적어 넣은 입력이다 */
type Slot = { from: 'saved'; personId: string } | { from: 'typed'; query: Query };

/** 처음 서는 모양 — 주소가 채운 사람, 없으면 첫 칸은 나, 고를 사람이 없으면 적는 칸(`app/compat-picker.tsx`) */
const firstSlot = (people: readonly Choosable[], asked: string | undefined): Slot => {
  if (asked !== undefined && people.some((one) => one.personId === asked)) return { from: 'saved', personId: asked };
  const self = people.find((one) => one.isSelfPerson) ?? people[0];
  return self === undefined ? { from: 'typed', query: DEFAULT_QUERY } : { from: 'saved', personId: self.personId };
};

const secondSlot = (people: readonly Choosable[], asked: string | undefined, askedFirst: string | undefined): Slot => {
  if (asked !== undefined && people.some((one) => one.personId === asked)) return { from: 'saved', personId: asked };
  /* 사람 화면에서 이 사람만 앉혔으면 그 칸만 찬다 — 내 칸은 비워 두고 사용자가 고른다(운영자 2026-10-26) */
  return askedFirst !== undefined || people.length >= 2 ? { from: 'saved', personId: '' } : { from: 'typed', query: DEFAULT_QUERY };
};

const complete = (slot: Slot): boolean =>
  slot.from === 'saved' ? slot.personId !== '' : calculateChart(slot.query).ok && missingAnswer(slot.query) === null;

const gapOf = (slots: Record<CompatSide, Slot>): string | null => {
  for (const side of SIDES) {
    const slot = slots[side];
    if (slot.from === 'saved') {
      if (slot.personId === '') return `${SIDE_PERSON[side]}을 골라 주세요.`;
      continue;
    }
    const gap = missingAnswer(slot.query);
    if (gap !== null) return `${SIDE_PERSON[side]}의 ${gap}`;
    const refused = calculateChart(slot.query);
    if (!refused.ok) return refused.message;
  }
  return null;
};

const sideOf = (slot: Slot): PairSide => (slot.from === 'saved' ? { from: 'saved', personId: slot.personId } : { from: 'typed', query: slot.query });

/**
 * 궁합의 **첫 걸음** — 두 사람을 정하고 사이를 답한다(`app/compat-picker.tsx`, ADR 0053 · 0054).
 * 칸마다 저장한 사람과 직접 입력을 고르고, 글은 여기서 안 만든다. 잠긴 모양이어도 누름을 받아 왜 안 되는지 곁에서 말한다.
 */
export function CompatPicker({ people, pickA, pickB }: { people: readonly Choosable[]; pickA?: string; pickB?: string }) {
  const [slots, setSlots] = useState<Record<CompatSide, Slot>>(() => ({
    a: firstSlot(people, pickA),
    b: secondSlot(people, pickB, pickA),
  }));
  const [relation, setRelation] = useState<Relation | null>(null);
  /** 이 누름이 사이를 건드리는가 — 안 건드린 「모른다」를 답으로 보내면 적어 둔 답이 지워진다 */
  const answered = useRef<string | null>(null);
  const [question, setQuestion] = useState<SameChartQuestion | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [tried, setTried] = useState(false);

  const chosen = SIDES.every((side) => complete(slots[side]));
  const sameTwice = slots.a.from === 'saved' && slots.b.from === 'saved' && slots.a.personId !== '' && slots.a.personId === slots.b.personId;
  const pairKey = slots.a.from === 'saved' && slots.b.from === 'saved' && chosen && !sameTwice ? [slots.a.personId, slots.b.personId].sort().join('|') : '';

  /* 적어 둔 답을 칸에 세운다 — 못 읽었으면 칸을 안 건드린다. 「못 읽었다」를 「모른다」로 세우지 않는다 */
  useEffect(() => {
    if (pairKey === '') return;
    let alive = true;
    const [first, second] = pairKey.split('|');
    void settled(readPairRelation(first, second), 'pair_relation_of', () => ({ ok: false }) as const).then((stored) => {
      if (!alive || !stored.ok || answered.current === pairKey) return;
      setRelation(stored.relation);
    });
    return () => {
      alive = false;
    };
  }, [pairKey]);

  const setSlot = (side: CompatSide, next: Slot) => {
    setFailure(null);
    setSlots((now) => ({ ...now, [side]: next }));
  };

  const open = async (answers: PairAnswers) => {
    setOpening(true);
    setFailure(null);
    const opened = await openPair(sideOf(slots.a), sideOf(slots.b), answered.current === pairKey || pairKey === '' ? relation : undefined, answers);
    setOpening(false);
    setQuestion(null);

    if (opened.ok) {
      router.push({ pathname: '/me/compat', params: { a: opened.personA, b: opened.personB } });
      return;
    }
    if (opened.kind === 'failed') {
      setFailure(opened.message);
      return;
    }
    setQuestion({
      label: opened.same.label,
      answer: (sameperson) => void open({ ...answers, [opened.side]: sameperson ? opened.same.personId : null }),
    });
  };

  const press = () => {
    if (!chosen || sameTwice) {
      setTried(true);
      return;
    }
    void open({});
  };

  const gap = gapOf(slots);
  const reason = opening ? null : sameTwice ? '같은 사람은 한 번만 고를 수 있어요. 서로 다른 두 사람을 골라 주세요.' : gap;
  const reasonIsError = sameTwice || tried;

  return (
    <Panel style={styles.frame}>
      <Text style={shared.name}>누구와 누구를 볼까요?</Text>
      {SIDES.map((side) => (
        <View key={side} style={styles.side}>
          {side === 'b' && <Text style={styles.times}>×</Text>}
          <Text style={shared.meta}>{SIDE_PERSON[side]}</Text>
          {slots[side].from === 'saved' && (
            <PersonChoice
              people={people}
              taken={(() => {
                const other = slots[side === 'a' ? 'b' : 'a'];
                return other.from === 'saved' && other.personId !== '' ? other.personId : null;
              })()}
              chosenId={(slots[side] as { personId: string }).personId}
              onChoose={(personId) => setSlot(side, { from: 'saved', personId })}
            />
          )}
          {people.length === 0 && slots[side].from === 'saved' && <Text style={shared.meta}>아직 저장한 사람이 없어요.</Text>}
          <Choices
            value={slots[side].from}
            onPick={(from) => setSlot(side, from === 'saved' ? { from, personId: '' } : { from, query: DEFAULT_QUERY })}
            options={[
              { value: 'saved', label: '저장한 사람' },
              { value: 'typed', label: '직접 입력' },
            ]}
          />
          {slots[side].from === 'typed' && <TypedSlot onChange={(query) => setSlot(side, { from: 'typed', query })} />}
        </View>
      ))}

      <View style={styles.relation}>
        <Text style={shared.name}>두 분은 무슨 사이인가요?</Text>
        <Text style={shared.meta}>
          사이에 따라 읽어 드릴 방향이 달라져요. 가족에게 할 말과 연인에게 할 말이 다르기 때문이에요. <Text style={shared.bodyStrong}>점수의 기준도 이 답을 따라요.</Text>
        </Text>
        <View style={styles.chips}>
          {[...RELATIONS, null].map((choice) => {
            const picked = relation === choice;
            return (
              <Pressable
                key={choice ?? 'unknown'}
                accessibilityRole="radio"
                accessibilityState={{ checked: picked }}
                onPress={() => {
                  answered.current = pairKey;
                  setRelation(choice);
                }}
                style={[styles.chip, picked && styles.chipOn]}
              >
                <Text style={[styles.chipText, picked && styles.chipTextOn]}>{choice === null ? '아직 모르겠음' : RELATION_LABEL[choice]}</Text>
              </Pressable>
            );
          })}
        </View>

        {question !== null ? (
          <SameChartAsk question={question} busy={opening} />
        ) : (
          <>
            <PrimaryButton label={opening ? '여는 중…' : '궁합 보기'} onPress={press} disabled={opening} />
            {reason !== null && <Text style={reasonIsError ? styles.reasonError : styles.reason}>{reason}</Text>}
          </>
        )}
        {failure !== null && <FailureLine>{failure}</FailureLine>}
      </View>
    </Panel>
  );
}

function TypedSlot({ onChange }: { onChange: (query: Query) => void }) {
  const form = useBirthForm();
  const key = JSON.stringify(form.query);
  const latest = useRef(onChange);
  latest.current = onChange;
  /* 칸의 값이 바뀌면 판에 알린다 — 값은 이 칸이 들고 판은 그 답만 본다 */
  useEffect(() => {
    latest.current(JSON.parse(key) as Query);
  }, [key]);
  return <BirthFields form={form} namePlaceholder="이름" />;
}

/** 찾아 고르는 칸 — 이름을 누르면 펼치고, 여섯부터 찾는 칸이 선다. 다른 칸에서 고른 사람은 빠진다(`app/person-combobox.tsx`) */
function PersonChoice({ people, taken, chosenId, onChoose }: { people: readonly Choosable[]; taken: string | null; chosenId: string; onChoose: (personId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const chosen = people.find((one) => one.personId === chosenId) ?? null;
  const candidates = pickable(people, findsInList(people.length) ? typed : '', taken);

  return (
    <View style={styles.choice}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={[styles.choiceHead, open && styles.choiceOpen]}>
        {chosen !== null && <Face person={chosen} />}
        <Text style={[styles.choiceText, chosen === null && styles.choiceEmpty]} numberOfLines={1}>{chosen?.label ?? '상대를 골라 주세요'}</Text>
        <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open && (
        <View style={styles.menu}>
          {findsInList(people.length) && (
            <View style={styles.menuFind}>
              <Field value={typed} onChange={setTyped} placeholder="이름으로 찾기" label="이름으로 찾기" />
            </View>
          )}
          {candidates.length === 0 && people.length > 0 && <Text style={[shared.meta, styles.menuEmpty]}>찾는 사람이 없어요</Text>}
          {candidates.map((one) => (
            <Pressable
              key={one.personId}
              onPress={() => {
                onChoose(one.personId);
                setOpen(false);
                setTyped('');
              }}
              style={[styles.menuItem, one.personId === chosenId && styles.menuChosen]}
            >
              <Face person={one} />
              <Text style={styles.choiceText} numberOfLines={1}>{one.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function Face({ person }: { person: Choosable }) {
  return person.stem !== null ? <StemSymbol stem={person.stem} size={24} /> : <ElementSymbol element={person.element} size={24} />;
}

const styles = StyleSheet.create({
  frame: { padding: 16, gap: 14 },
  side: { gap: 8 },
  times: { alignSelf: 'center', fontSize: 24, fontFamily: FONT.medium, color: COLOR.secondary },
  relation: { gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLOR.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: CONTROL, justifyContent: 'center', paddingHorizontal: 14, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  chipOn: { borderColor: COLOR.borderStrong, backgroundColor: COLOR.accentWash },
  chipText: { fontSize: TYPE.sm, fontFamily: FONT.medium, color: COLOR.secondary },
  chipTextOn: { fontFamily: FONT.bold, color: COLOR.foreground },
  reason: { fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.medium, color: COLOR.secondary, textAlign: 'right' },
  reasonError: { fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.bold, color: COLOR.danger, textAlign: 'right' },
  choice: { gap: 6 },
  choiceHead: { minHeight: CONTROL + 4, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: RADIUS.control, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  choiceOpen: { borderColor: COLOR.creamInk },
  choiceText: { flex: 1, fontSize: TYPE.field, fontFamily: FONT.medium, color: COLOR.foreground },
  choiceEmpty: { color: COLOR.muted },
  chevron: { fontSize: TYPE.body, fontFamily: FONT.medium, color: COLOR.secondary },
  menu: { borderRadius: RADIUS.control, borderWidth: 1, borderColor: COLOR.borderStrong, overflow: 'hidden', backgroundColor: COLOR.surface },
  menuFind: { padding: 8 },
  menuEmpty: { padding: 14 },
  menuItem: { minHeight: CONTROL, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  menuChosen: { backgroundColor: COLOR.accentWash },
});
