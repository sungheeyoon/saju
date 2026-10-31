import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isoOf, solarDateOf } from '@input/chart';
import { HOUR_UNKNOWN_LABEL, type Query } from '@input/query';
import { UNREADABLE_INPUT_NOTE } from '@input/stored';
import { CALENDAR_KO, GENDER_KO } from '@saju';

import { UNREACHABLE } from '@/auth/signup';
import { readAccount, readPersonDetail } from '@/people/data';
import { EditInputForm } from '@/people/edit-input';
import { settled } from '@/ui/settled';
import { COLOR, CONTROL, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { CardFrame } from '@/ui/surfaces';

import { FailureLine } from './parts';

type MyBirth = { kind: 'none' } | { kind: 'failed' } | { kind: 'unreadable'; message: string } | { kind: 'ready'; personId: string; query: Query };

async function readMyBirth(): Promise<MyBirth> {
  const { selfPersonId } = await readAccount();
  if (selfPersonId === null) return { kind: 'none' };
  const read = await readPersonDetail(selfPersonId);
  const person = read.kind === 'ok' ? read.value.person : null;
  if (person === null) return { kind: 'none' };
  return person.chart.ok ? { kind: 'ready', personId: person.personId, query: person.chart.query } : { kind: 'unreadable', message: person.chart.message };
}

/**
 * 프로필의 **출생 정보** — 웹 `app/me/profile/birth-section.tsx`. 접어 두고 「수정」을 누르면 그 자리에 폼이 펴진다. 이름은 여기서 안 고친다 — 바로 위 닉네임 칸이 든다.
 * 여덟 글자가 바뀌는 저장은 묻는다 — 답을 기다리던 인연 요청이 무효가 된다. 내 사주가 아직 없으면 안 선다(등록은 홈이 이끈다).
 */
export function BirthSection() {
  const [birth, setBirth] = useState<MyBirth>({ kind: 'none' });
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setBirth(await settled(readMyBirth(), 'readMyBirth', () => ({ kind: 'failed' }) as const));
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 여는 때 읽는다 - setState 는 await 뒤라 렌더와 겹치지 않는다
    void load();
  }, [load]);

  if (birth.kind === 'none') return null;
  if (birth.kind === 'failed') return <FailureLine onRetry={() => void load()}>{UNREACHABLE}</FailureLine>;
  if (birth.kind === 'unreadable') {
    return (
      <CardFrame style={styles.panel}>
        <Text style={styles.value}>{birth.message}</Text>
        <Text style={styles.term}>{UNREADABLE_INPUT_NOTE}</Text>
      </CardFrame>
    );
  }

  const { query, personId } = birth;
  if (open) {
    return (
      <EditInputForm
        personId={personId}
        current={query}
        editableName={false}
        nameNote={false}
        confirmsRequests
        onDone={() => {
          setOpen(false);
          void load();
        }}
        onCancel={() => setOpen(false)}
      />
    );
  }

  const rows = [
    [
      '생년월일',
      `${query.calendar === 'solar' ? query.date : `${CALENDAR_KO[query.calendar]} ${query.date} · 양력 ${isoOf(solarDateOf(query))}`}${query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` ${query.time}`}`,
    ],
    ['성별', GENDER_KO[query.gender]],
    ['출생지', query.city],
    ['자시 규칙', query.rule === 'jo' ? '조자시 (23:00 경계)' : '야자시 (자정 경계)'],
  ] as const;

  return (
    <CardFrame style={styles.panel}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>출생 정보</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="출생 정보 수정" onPress={() => setOpen(true)} style={styles.edit}>
          <Text style={styles.editText}>수정</Text>
        </Pressable>
      </View>
      {rows.map(([term, value]) => (
        <View key={term} style={styles.row}>
          <Text style={styles.term}>{term}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </CardFrame>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 16, padding: 20 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  edit: { minHeight: CONTROL, justifyContent: 'center', paddingHorizontal: 16, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.borderStrong },
  editText: { fontFamily: FONT.bold, fontSize: TYPE.note, color: COLOR.foreground },
  row: { flexDirection: 'row', gap: 20 },
  term: { width: 64, fontFamily: FONT.medium, fontSize: TYPE.note, lineHeight: 22, color: COLOR.secondary },
  value: { flex: 1, fontFamily: FONT.medium, fontSize: TYPE.note, lineHeight: 22, color: COLOR.foreground },
});
