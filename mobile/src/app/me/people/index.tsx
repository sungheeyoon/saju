import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { isBlocked } from '@account/index';
import { findStatus, findsInList, pickable } from '@people/pick';

import { readPeopleList, type MyReading, type PeopleList, type Read } from '@/people/data';
import { AddPerson } from '@/people/manage';
import { AccountNotice, FailureLine, ScreenFrame, go, styles as shared } from '@/people/parts';
import { PersonCard } from '@/people/person-card';
import { Field, Panel, SecondaryButton } from '@/ui/parts';
import { COLOR } from '@/ui/tokens';
import { settled } from '@/ui/settled';
import { UNREACHABLE } from '@/auth/signup';
import { TopBar } from '@/ui/top-bar';

/** 저장한 사람 — 가족 · 친구를 관리하는 자리. 나는 여기 없다(`app/me/people/page.tsx`) */
export default function PeopleScreen() {
  const params = useLocalSearchParams<{ add?: string }>();
  const [read, setRead] = useState<Read<PeopleList> | null>(null);
  const [typed, setTyped] = useState('');

  const load = useCallback(() => {
    void settled(readPeopleList(), 'readPeopleList', () => ({ kind: 'failed', message: UNREACHABLE }) as const).then((next) => {
      if (next.kind === 'signed-out') router.replace('/');
      else setRead(next);
    });
  }, []);
  /* 다른 화면을 다녀오면 다시 읽는다 — 거기서 사람이 빠졌거나 풀이가 났을 수 있다 */
  useFocusEffect(load);

  if (read === null || read.kind === 'signed-out') {
    return (
      <ScreenFrame bar={<TopBar title="저장한 사람" fallback="/me" />}>
        <ActivityIndicator color={COLOR.secondary} style={styles.loading} />
      </ScreenFrame>
    );
  }
  if (read.kind === 'failed') {
    return (
      <ScreenFrame bar={<TopBar title="저장한 사람" fallback="/me" />}>
        <FailureLine onRetry={load}>{read.message}</FailureLine>
      </ScreenFrame>
    );
  }

  const { state, slots, people, readings, making, selfPersonId } = read.value;
  /* 사람 하나에 지금 글 하나 — 차례는 DB 가 정한 그대로다. 나 × 그 사람의 궁합은 최근 것이 앞이다 */
  const readingOf = (personId: string) => readings.find((one) => one.kind === 'person' && one.personA === personId) ?? null;
  const pairOf = (personId: string): MyReading | null =>
    selfPersonId === null
      ? null
      : (readings.find(
          (one) => one.kind === 'private' && ((one.personA === selfPersonId && one.personB === personId) || (one.personB === selfPersonId && one.personA === personId)),
        ) ?? null);

  const finds = findsInList(people.length);
  const wanted = finds ? typed : '';
  const shown = pickable(people, wanted, null);
  const status = findStatus(wanted, shown.length);

  return (
    <ScreenFrame keyboard bar={<TopBar title="저장한 사람" fallback="/me" right={<SecondaryButton label="궁합 보러 가기" onPress={() => go('/me/compat')} />} />}>
      <Text style={shared.body}>
        가족이나 친구의 출생 정보를 저장하고 관리하세요.
        {slots !== null && <Text style={shared.bodyStrong}>{`  ${slots.used}/${slots.limit}명`}</Text>}
      </Text>

      {isBlocked(state) ? (
        <AccountNotice state={state} onRetry={load} />
      ) : (
        <>
          <AddPerson slots={slots} startOpen={params.add !== undefined} onSaved={load} />
          {people.length === 0 ? (
            <Panel style={styles.empty}>
              <Text style={shared.noticeTitle}>아직 저장한 사람이 없어요</Text>
              <Text style={shared.noticeBody}>이름과 출생 정보를 입력해 사람을 추가해 보세요.</Text>
            </Panel>
          ) : (
            <>
              {finds && (
                <View style={styles.find}>
                  <Field value={typed} onChange={setTyped} placeholder="이름으로 찾기" label="이름으로 찾기" />
                  {status.kind !== 'idle' && <Text style={shared.meta}>{status.kind === 'none' ? '찾는 사람이 없어요' : `검색 결과 ${status.count}명`}</Text>}
                </View>
              )}
              {shown.map((person) => (
                <PersonCard
                  key={person.personId}
                  person={person}
                  reading={readingOf(person.personId)}
                  pair={pairOf(person.personId)}
                  making={making.has(person.personId)}
                  selfPersonId={selfPersonId}
                  onChanged={load}
                />
              ))}
            </>
          )}
        </>
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 48 },
  empty: { gap: 4, padding: 20, alignItems: 'center' },
  find: { gap: 6 },
});
