import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { pastRequests } from '@matching/history';
import type { InboxMatch, Requests } from '@matching/inbox';
import { receivedOf } from '@matching/requests';

import { readMatchBooks, readMatches, readRequests, type MatchBook, type Read } from '@/matching/doors';
import { PastRequestList } from '@/matching/requests';
import { Icon } from '@/ui/icons';
import { EmptyState } from '@/ui/empty-state';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { TopBar } from '@/ui/top-bar';
import { CardFrame } from '@/ui/surfaces';

type Loaded = { books: Read<readonly MatchBook[]>; matches: Read<readonly InboxMatch[]>; requests: Read<Requests> };

/** 인연 기록 — 인연 궁합 전부와 지난 요청. 둘은 나란히 읽고 따로 비운다(ADR 0078) */
export default function MatchHistoryScreen() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const [books, matches, requests] = await Promise.all([readMatchBooks(), readMatches(), readRequests()]);
    setLoaded({ books, matches, requests });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (note === '') return;
    const clear = setTimeout(() => setNote(''), 4000);
    return () => clearTimeout(clear);
  }, [note]);

  const bar = <TopBar title="인연 기록" fallback="/me/matching" />;
  if (loaded === null) return <View style={styles.screen}>{bar}</View>;

  const { books, matches, requests } = loaded;
  const shelf = books.ok ? books.value : [];
  const madeIds = new Set(shelf.map((book) => book.matchId));
  const making = books.ok && matches.ok ? matches.value.filter((match) => !madeIds.has(match.matchId)) : [];
  const matchCount = shelf.length + making.length;
  const past = requests.ok ? pastRequests(requests.value, matches.ok ? matches.value : null) : null;
  const pastCount = past === null ? 0 : past.sent.length + past.decided.length;
  const whole = books.ok && matches.ok;
  const empty = whole && requests.ok && matchCount === 0 && pastCount === 0 && past?.blocked === 0;
  /* 표지 글은 상대 이름이 든 `my_matches` 에서 찾는다 — 못 찾으면 그 책의 이름표다 */
  const nameOf = (book: MatchBook) => (matches.ok ? matches.value.find((match) => match.matchId === book.matchId)?.nickname : undefined) ?? book.label;

  return (
    <View style={styles.screen}>
      {bar}
      <ScrollView contentContainerStyle={styles.content}>
        {note !== '' && (
          <View style={styles.snack} accessibilityLiveRegion="polite">
            <Text style={styles.snackText}>{note}</Text>
          </View>
        )}

        {empty && (
          <EmptyState icon="people" title="아직 인연 기록이 없어요" action={{ label: '오늘의 인연 보기', onPress: () => router.navigate('/me/matching') }}>
            인연 요청을 주고받으면 여기에 기록이 남아요.
          </EmptyState>
        )}

        {(!whole || matchCount > 0) && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>인연 궁합</Text>
              {whole && <Text style={styles.chip}>{matchCount}</Text>}
            </View>
            {books.ok ? (
              <>
                {making.map((match) => (
                  <CardFrame key={match.matchId} accessibilityRole="link" onPress={() => router.push(`/me/match/${match.matchId}?from=history` as never)} style={styles.book}>
                    <Text style={[styles.bookName, styles.flex]} numberOfLines={1}>
                      {match.nickname}
                    </Text>
                    <Icon name="chevron" size={16} color={COLOR.muted} />
                  </CardFrame>
                ))}
                {shelf.map((book) => (
                  <CardFrame key={book.key} accessibilityRole="link" onPress={() => router.push(book.href as never)} style={styles.book}>
                    <Text style={[styles.bookName, styles.flex]} numberOfLines={1}>
                      {nameOf(book)}
                    </Text>
                    <Icon name="chevron" size={16} color={COLOR.muted} />
                  </CardFrame>
                ))}
                {!matches.ok && <Failure onRetry={load}>만드는 중인 인연 궁합을 불러오지 못했어요.</Failure>}
              </>
            ) : (
              <Failure onRetry={load}>인연 궁합을 불러오지 못했어요. {books.reason}</Failure>
            )}
          </View>
        )}

        {(!requests.ok || (past !== null && (pastCount > 0 || past.blocked > 0))) && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>지난 요청</Text>
              {requests.ok && <Text style={styles.chip}>{pastCount}</Text>}
            </View>
            {requests.ok ? (
              past !== null && <PastRequestList past={past} guide={receivedOf(requests.value.requests).length === 0} onChanged={load} onNote={setNote} />
            ) : (
              <Failure onRetry={load}>요청을 불러오지 못했어요. {requests.reason}</Failure>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Failure({ children, onRetry }: { children: React.ReactNode; onRetry: () => void }) {
  return (
    <View>
      <Text style={styles.failure} accessibilityRole="alert">
        {children}
      </Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
        <Text style={styles.retryText}>다시 시도하기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, gap: 28, padding: 16 },
  flex: { flex: 1, minWidth: 0 },
  snack: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLOR.accent },
  snackText: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.onAccent },
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
  section: { gap: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontFamily: FONT.bold, fontSize: TYPE.heading, color: COLOR.foreground },
  chip: { minWidth: 28, paddingHorizontal: 8, paddingVertical: 2, textAlign: 'center', borderRadius: RADIUS.pill, overflow: 'hidden', backgroundColor: COLOR.surfaceSunken, fontFamily: FONT.bold, fontSize: TYPE.fine, color: COLOR.secondary },
  book: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, padding: 16 },
  bookName: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.danger },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { fontFamily: FONT.bold, fontSize: TYPE.sm, color: COLOR.foreground },
});
