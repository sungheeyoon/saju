import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PREFER_GENDER_ORDER, type PreferGender } from '@discovery';
import { PREFER_GENDER_KO } from '@discovery/copy';

import { saveFailureOf, setParticipation } from '@/reading/chart-writes';
import { followRefusal } from '@/reading/panel';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

import { FailureLine, SwitchRow, useDoneNote } from './parts';
import { savePreferGender } from './settings';

/**
 * 「인연 찾기」 스위치 — 가입 고지가 「설정에서 언제든 끌 수 있습니다」라고 약속한 자리다. 누르면 곧 바뀌고 앱의 문을 지난다 — 요약은 서버가 짓는다(ADR 0211).
 * 실패하면 서버가 든 마지막 값으로 돌아오고 까닭이 선다(웹 `ParticipationToggle`).
 */
export function ParticipationRow({ resting }: { resting: boolean }) {
  const [on, setOn] = useState(!resting);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const toggle = async (next: boolean) => {
    setFailure(null);
    setOn(next);
    setWorking(true);
    const answer = await setParticipation(next);
    setWorking(false);
    if (answer.ok && answer.value.ok) return;
    setOn(!next);
    setFailure(saveFailureOf(answer));
    if (!answer.ok) followRefusal(answer.refused);
  };

  return (
    <>
      <SwitchRow
        label="인연 찾기"
        help={on ? '내 프로필과 오행 요약이 다른 사람에게 소개되고 있어요.' : '켜면 내 프로필과 오행 요약이 다른 사람에게 소개돼요.'}
        checked={on}
        onChange={(next) => void toggle(next)}
        busy={working}
      />
      {failure !== null && <FailureLine inset>{failure}</FailureLine>}
    </>
  );
}

/**
 * 소개받을 성별 — 고르면 곧 저장한다. 차례는 웹 `app/me/discovery/save-latest.ts` 와 같다: 한 번에 하나씩 보내고, 가는 동안 고른 값은
 * 마지막 하나만 남겼다가 보낸다. 실패하면 서버가 든 마지막 값으로 돌아오고 까닭이 선다.
 */
export function PreferenceRow({ current }: { current: PreferGender }) {
  const [chosen, setChosen] = useState(current);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const done = useDoneNote();
  const held = useRef(current);
  const sending = useRef(false);
  const waiting = useRef<PreferGender | null>(null);

  const send = async (first: PreferGender) => {
    sending.current = true;
    setSaving(true);
    let next: PreferGender | null = first;
    let refused: string | null = null;
    while (next !== null) {
      const value: PreferGender = next;
      next = null;
      const result = await savePreferGender(value);
      if (!result.ok) {
        refused = result.message;
        break;
      }
      held.current = value;
      const queued: PreferGender | null = waiting.current;
      waiting.current = null;
      if (queued !== null && queued !== value) next = queued;
    }
    waiting.current = null;
    sending.current = false;
    setSaving(false);
    if (refused !== null) {
      setChosen(held.current);
      setFailure(refused);
    } else {
      done.say('저장했어요');
    }
  };

  const choose = (value: PreferGender) => {
    setFailure(null);
    done.clear();
    setChosen(value);
    if (sending.current) waiting.current = value;
    else if (value !== held.current) void send(value);
  };

  return (
    <>
      <View style={styles.box}>
        <View style={styles.head}>
          <Text style={styles.label}>소개받을 성별</Text>
          <Text accessibilityLiveRegion="polite" style={styles.progress}>
            {saving ? '저장하는 중…' : done.note}
          </Text>
        </View>
        <View style={styles.choices} accessibilityRole="radiogroup">
          {PREFER_GENDER_ORDER.map((value) => {
            const on = chosen === value;
            return (
              <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => choose(value)} style={[styles.choice, on && styles.chosen]}>
                <Text style={[styles.choiceText, on && styles.chosenText]}>{PREFER_GENDER_KO[value]}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.help}>서로 고른 성별이 맞을 때 소개돼요.</Text>
      </View>
      {failure !== null && <FailureLine inset>{`저장하지 못했어요. ${failure}`}</FailureLine>}
    </>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, paddingHorizontal: 24, paddingVertical: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  progress: { fontSize: TYPE.fine, fontFamily: FONT.medium, color: COLOR.muted },
  choices: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: RADIUS.cell, backgroundColor: COLOR.surfaceSunken },
  choice: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.cell },
  chosen: { backgroundColor: COLOR.surfaceRaised },
  choiceText: { fontSize: TYPE.note, fontFamily: FONT.medium, color: COLOR.secondary },
  chosenText: { color: COLOR.foreground, fontFamily: FONT.bold },
  help: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
});
