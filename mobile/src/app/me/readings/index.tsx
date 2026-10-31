import { findStatus, findsInList, matchesName } from '@people/pick';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { readShelf, type DoorRefusal, type ShelfView } from '@/reading/api';
import { followRefusal, ReadFailure } from '@/reading/panel';
import { BlankBook, BookRow, MakingRow, SHELF_CHIPS, SHELF_TITLE, type ShelfChip } from '@/reading/shelf';
import { EmptyState } from '@/ui/empty-state';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { settled } from '@/ui/settled';
import { UNREACHABLE } from '@/auth/signup';
import { TopBar } from '@/ui/top-bar';
import { Card } from '@/ui/surfaces';

type Shelf = Extract<ShelfView, { view: 'shelf' }>;

/**
 * **풀이 보관함** — 웹의 `/me/readings` 와 같은 칩 넷 · 묶음 차례(인연 궁합 → 사주풀이 → 궁합풀이) · 맨 위의 「만드는 중」이다.
 * 차례도 좁힘도 DB 가 정하고(`my_readings`) 여기서는 칸으로 가르기만 한다. 표지만 온다 — 본문은 글 화면이 따로 읽는다(ADR 0033).
 */
export default function ReadingsScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const [chip, setChip] = useState<ShelfChip>(SHELF_CHIPS.find((one) => one.chip === params.kind)?.chip ?? 'all');
  const [answer, setAnswer] = useState<{ view: ShelfView } | { refused: DoorRefusal } | null>(null);
  const [typed, setTyped] = useState('');

  const load = useCallback(() => {
    void settled(readShelf(), 'readShelf', () => ({ ok: false, refused: { refused: 'unavailable', message: UNREACHABLE } }) as const).then((read) => {
      if (read.ok) setAnswer({ view: read.value });
      else {
        followRefusal(read.refused);
        setAnswer({ refused: read.refused });
      }
    });
  }, []);

  /* 글을 받고 돌아오면 표지가 새 글을 든다 */
  useFocusEffect(load);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <TopBar title={SHELF_TITLE} fallback="/me" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {answer !== null && 'refused' in answer && <ReadFailure refused={answer.refused} onRetry={load} />}
        {answer !== null && 'view' in answer && answer.view.view === 'blocked' && (
          <Card>
            <Text style={styles.noticeTitle}>{answer.view.title}</Text>
            <Text style={styles.line}>{answer.view.detail}</Text>
          </Card>
        )}
        {answer !== null && 'view' in answer && answer.view.view === 'shelf' && (
          <ShelfBody shelf={answer.view} chip={chip} setChip={setChip} typed={typed} setTyped={setTyped} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ShelfBody({
  shelf,
  chip,
  setChip,
  typed,
  setTyped,
}: {
  shelf: Shelf;
  chip: ShelfChip;
  setChip: (chip: ShelfChip) => void;
  typed: string;
  setTyped: (typed: string) => void;
}) {
  const { books, making, hasSelf } = shelf;

  if (books.length === 0 && making.length === 0) {
    return (
      <EmptyState
        icon="reading"
        title="아직 만든 풀이가 없어요"
        action={hasSelf ? { label: '사주풀이 받기', onPress: () => router.push('/me/readings/self' as never) } : { label: '내 사주 등록하기', onPress: () => router.push('/me' as never) }}
      >
        내 사주와 저장한 사람의 풀이는 홈 탭에서,{'\n'}두 사람의 궁합은 궁합 탭에서 시작할 수 있어요.
      </EmptyState>
    );
  }

  const finds = findsInList(books.length + making.length);
  const wanted = finds ? typed.trim() : '';
  const shows = (names: readonly string[]) => wanted === '' || names.some((name) => matchesName(name, wanted));
  const shownBooks = books.filter((book) => shows(book.names));
  const shownMaking = making.filter((one) => shows(one.names));
  const inChip = <T extends { shelf: string }>(rows: readonly T[]) => (chip === 'all' ? rows : rows.filter((row) => row.shelf === chip));
  const count = inChip(shownBooks).length + inChip(shownMaking).length;
  const found = findStatus(wanted, count);

  const fated = shownBooks.filter((book) => book.shelf === 'match');
  const singles = shownBooks.filter((book) => book.shelf === 'saju');
  const privates = shownBooks.filter((book) => book.shelf === 'compat');
  const hasSelfReading = books.some((book) => book.href === '/me/readings/self');
  const makingSelf = making.some((one) => one.href === '/me/readings/self');
  const makingOf = (slot: ShelfChip) => making.filter((one) => one.shelf === slot).length > 0;

  const label = (slot: ShelfChip) => SHELF_CHIPS.find((one) => one.chip === slot)?.label;

  const sajuBlank = wanted !== '' ? null : !hasSelf ? (
    <BlankBook element="木" label="내 사주 등록하기" onPress={() => router.push('/me' as never)} />
  ) : (
    !hasSelfReading && !makingSelf && <BlankBook element="木" label="사주풀이 받기" onPress={() => router.push('/me/readings/self' as never)} />
  );
  const compatBlank = wanted === '' && privates.length === 0 && !makingOf('compat') && (
    <BlankBook element="火" label="궁합 보러 가기" onPress={() => router.push('/me/compat' as never)} />
  );
  const matchBlank = wanted === '' && fated.length === 0 && !makingOf('match') && (
    <BlankBook element="水" label="오늘의 인연" onPress={() => router.push('/me/matching' as never)} />
  );

  return (
    <View style={styles.body}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SHELF_CHIPS.map((one) => {
          const on = one.chip === chip;
          return (
            <Pressable
              key={one.chip}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setChip(one.chip)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{one.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {finds && (
        <View>
          <TextInput
            accessibilityLabel="이름으로 찾기"
            placeholder="이름으로 찾기"
            placeholderTextColor={COLOR.secondary}
            value={typed}
            onChangeText={setTyped}
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.find}
          />
          {found.kind === 'none' && <Text style={styles.found}>찾는 사람이 없어요</Text>}
          {found.kind === 'some' && <Text style={styles.found}>검색 결과 {found.count}권</Text>}
        </View>
      )}

      {chip === 'all' ? (
        <>
          {shownMaking.length > 0 && (
            <View>
              <Text style={styles.makingHead}>만드는 중</Text>
              {shownMaking.map((one) => (
                <MakingRow key={one.href} making={one} kind={label(one.shelf)} />
              ))}
            </View>
          )}
          {fated.length > 0 && (
            <Group title="인연 궁합" note="서로 동의해 두 사람이 함께 보는 궁합풀이예요.">
              {fated.map((book) => (
                <BookRow key={book.key} book={book} />
              ))}
            </Group>
          )}
          {(singles.length > 0 || wanted === '') && (
            <Group title="사주풀이" note="나와 저장한 사람을 한 사람씩 본 풀이예요.">
              {singles.map((book) => (
                <BookRow key={book.key} book={book} />
              ))}
              {sajuBlank}
            </Group>
          )}
          {(privates.length > 0 || wanted === '') && (
            <Group title="궁합풀이" note="두 사람을 함께 맞대어 본 풀이예요.">
              {privates.map((book) => (
                <BookRow key={book.key} book={book} />
              ))}
              {compatBlank}
            </Group>
          )}
        </>
      ) : (
        <View>
          {inChip(shownMaking).map((one) => (
            <MakingRow key={one.href} making={one} />
          ))}
          {inChip(shownBooks).map((book) => (
            <BookRow key={book.key} book={book} />
          ))}
          {chip === 'saju' && sajuBlank}
          {chip === 'compat' && compatBlank}
          {chip === 'match' && matchBlank}
        </View>
      )}
    </View>
  );
}

function Group({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.groupTitle}>
        {title}
      </Text>
      <Text style={styles.groupNote}>{note}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { gap: 16, padding: 16, paddingBottom: 48 },
  body: { gap: 24 },
  noticeTitle: { fontFamily: FONT.bold, fontSize: TYPE.lead, color: COLOR.foreground },
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
  chips: { gap: 8 },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: COLOR.border, borderRadius: RADIUS.pill, backgroundColor: COLOR.surface },
  chipOn: { borderColor: COLOR.foreground, backgroundColor: COLOR.foreground },
  chipLabel: { fontFamily: FONT.bold, fontSize: TYPE.note, color: COLOR.secondary },
  chipLabelOn: { color: COLOR.background },
  find: { height: 44, paddingHorizontal: 16, borderWidth: 1, borderColor: COLOR.border, borderRadius: RADIUS.pill, backgroundColor: COLOR.surface, fontFamily: FONT.medium, fontSize: TYPE.field, color: COLOR.foreground },
  found: { marginTop: 6, paddingHorizontal: 8, fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary },
  makingHead: { marginBottom: 4, fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.secondary },
  group: { gap: 2 },
  groupTitle: { fontFamily: FONT.bold, fontSize: TYPE.heading, color: COLOR.foreground },
  groupNote: { marginBottom: 8, fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
});
