import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { accountFailureOf, accountNoticeOf, isBlocked, selfPersonIdOf, type AccountState } from '@account/index';
import { SUPPORT_EMAIL } from '@brand';
import { historySummary, type HistorySummary } from '@matching/history';
import type { InboxMatch, Requests } from '@matching/inbox';
import { receivedOf } from '@matching/requests';

import { readAccountState, readDeck, readMatches, readRequests, type DeckPlace, type Read } from '@/matching/doors';
import { RequestsBand } from '@/matching/requests';
import { DeckButtons, DetailSheet, EmptyDeck, Feedback, PassedConnections, QuietPlace, RequestConfirm, TodayCard, useCreditsNotice } from '@/matching/today';
import { useDeck } from '@/matching/use-deck';
import { Icon } from '@/ui/icons';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { CardFrame, RowCard } from '@/ui/surfaces';

type Loaded = { account: AccountState; deck: Read<DeckPlace>; requests: Read<Requests>; matches: Read<readonly InboxMatch[]> };

const todayLabel = () => new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' });

/**
 * 오늘의 인연 — 폰 한 화면이다(ADR 0130). 위에서부터 받은 요청 띠 → 사진 카드와 단추 줄 → 인연 기록 한 줄.
 * 후보를 뽑는 자리는 하나다(`my_discovery_board`, ADR 0037). 지나친 인연은 같은 화면의 두 번째 보기다.
 */
export default function MatchingScreen() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [round, setRound] = useState(0);

  const load = useCallback(async () => {
    const account = await readAccountState();
    const [deck, requests, matches] = await Promise.all([readDeck(selfPersonIdOf(account)), readRequests(), readMatches()]);
    setLoaded({ account, deck, requests, matches });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const again = () => {
    setRound((now) => now + 1);
    void load();
  };

  if (loaded === null) return <View style={styles.screen} />;

  const { account } = loaded;
  if (isBlocked(account)) return <Blocked state={account} onRetry={again} />;

  const { requests } = loaded;
  const received = requests.ok ? receivedOf(requests.value.requests) : [];
  const summary = historySummary(loaded.matches, requests);

  const lead = (
    <>
      {!requests.ok && <FailureLine onRetry={again}>요청을 불러오지 못했어요. {requests.reason}</FailureLine>}
      <RequestsBand received={received} onChanged={again} />
    </>
  );
  const tail = <HistoryRow summary={summary} />;

  if (!loaded.deck.ok) {
    return (
      <Frame>
        <Title />
        {lead}
        <FailureLine onRetry={again}>{loaded.deck.reason}</FailureLine>
        {tail}
      </Frame>
    );
  }
  const place = loaded.deck.value;

  if (place.kind === 'guide') {
    return (
      <Frame>
        <Title />
        {lead}
        <QuietPlace
          title="먼저 내 사주와 이름이 필요해요"
          line="나와 맞는 인연을 찾으려면 내 사주의 오행 구성이 있어야 해요. 내 사주를 저장하고 닉네임을 지으면 오늘의 인연을 볼 수 있어요."
          href="/me"
          action="내 사주로 가기"
        />
        {tail}
      </Frame>
    );
  }
  if (place.kind === 'resting') {
    return (
      <Frame>
        <Title />
        {lead}
        <QuietPlace
          title="인연 찾기를 쉬고 있습니다"
          line="지금은 다른 참여자에게 내 프로필이 공개되지 않고, 새로운 사람도 소개받지 않아요. 내 사주와 저장한 사람은 그대로 남아 있어요."
          href="/me/settings"
          action="설정 열기"
        />
        {tail}
      </Frame>
    );
  }

  /* 덱은 다시 세우지 않는다 — 다만 앱은 응답이 화면을 다시 그려 주지 않으니, 다시 읽은 그때 덱을 그 값으로 새로 세운다 */
  return <Deck key={round} place={place} lead={lead} tail={tail} />;
}

function Deck({ place, lead, tail }: { place: Extract<DeckPlace, { kind: 'deck' }>; lead: React.ReactNode; tail: React.ReactNode }) {
  const credits = useCreditsNotice();
  const deck = useDeck({ cards: place.cards, passedFromServer: place.passed, summary: place.summary, onOutOfCredits: () => void credits.offer() });
  const [view, setView] = useState<'today' | 'passed'>('today');
  const [info, setInfo] = useState(false);
  const { profile } = deck;
  const feedback = <Feedback failure={deck.failure} flash={deck.flash} />;

  return (
    <Frame>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text style={styles.date}>{todayLabel()}</Text>
          <Text style={styles.title} accessibilityRole="header">
            오늘의 인연
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setView(view === 'today' ? 'passed' : 'today')} style={styles.pill}>
          <Icon name={view === 'today' ? 'undo' : 'people'} size={16} />
          <Text style={styles.pillText}>{view === 'today' ? '지나친 인연' : '오늘의 인연'}</Text>
          <Text style={styles.pillCount}>{view === 'today' ? deck.passed.length : deck.remaining.length}</Text>
        </Pressable>
      </View>

      {lead}

      {view === 'passed' ? (
        <PassedConnections
          cards={deck.passed}
          working={deck.working}
          explorationNote={place.explorationNote}
          onRestore={async (card) => {
            const message = await deck.restoreCard(card);
            if (message === null) setView('today');
            return message;
          }}
          onBack={() => setView('today')}
          feedback={feedback}
        />
      ) : profile === undefined ? (
        <>
          {place.notice !== null && <Text style={styles.date}>{place.notice}</Text>}
          <EmptyDeck />
          {feedback}
        </>
      ) : (
        <View style={styles.deck}>
          {feedback}
          <TodayCard card={profile} onInfo={() => setInfo(true)} onBlocked={() => deck.blocked(profile)} />
          <DeckButtons
            canUndo={deck.hidden !== null && !deck.working}
            busy={deck.working}
            onUndo={deck.undo}
            onPass={() => void deck.pass()}
            onRequest={() => void deck.askToRequest()}
          />
          <DetailSheet
            card={profile}
            open={info}
            onClose={() => setInfo(false)}
            explorationNote={place.explorationNote}
            notice={place.notice}
            onBlocked={() => {
              setInfo(false);
              deck.blocked(profile);
            }}
          />
          <RequestConfirm
            card={profile}
            open={deck.asking}
            onClose={() => deck.setAsking(false)}
            onConfirm={() => {
              deck.setAsking(false);
              void deck.send();
            }}
            busy={deck.working}
          />
        </View>
      )}

      {tail}
      {credits.notice}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </View>
  );
}

function Title() {
  return (
    <Text style={styles.title} accessibilityRole="header">
      오늘의 인연
    </Text>
  );
}

function FailureLine({ children, onRetry }: { children: React.ReactNode; onRetry: () => void }) {
  return (
    <View style={styles.failureBox}>
      <Text style={styles.failure} accessibilityRole="alert">
        {children}
      </Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
        <Text style={styles.retryText}>다시 시도하기</Text>
      </Pressable>
    </View>
  );
}

function Blocked({ state, onRetry }: { state: AccountState; onRetry: () => void }) {
  const failure = accountFailureOf(state);
  const text = accountNoticeOf(state, SUPPORT_EMAIL);
  return (
    <Frame>
      {failure !== null ? (
        <FailureLine onRetry={onRetry}>{failure.line}</FailureLine>
      ) : text !== null ? (
        <CardFrame style={styles.notice}>
          <Text style={styles.noticeTitle}>{text.title}</Text>
          <Text style={styles.noticeBody}>{text.detail}</Text>
        </CardFrame>
      ) : null}
    </Frame>
  );
}

/** 덱 아래 「인연 기록 N」 한 줄 — 수가 0 이면 안 선다 */
function HistoryRow({ summary }: { summary: HistorySummary | null }) {
  if (summary === null) return null;
  return (
    <RowCard accessibilityRole="link" onPress={() => router.push('/me/matching/history')} style={styles.history}>
      <View style={styles.flex}>
        <View style={styles.historyHead}>
          <Text style={styles.historyTitle}>인연 기록</Text>
          <Text style={styles.chip}>{summary.count}</Text>
        </View>
        <Text style={styles.historyHint} numberOfLines={1}>
          {summary.hint}
        </Text>
      </View>
      <Icon name="chevron" size={16} color={COLOR.muted} />
    </RowCard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, gap: 12, padding: 16 },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  date: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.muted },
  title: { fontFamily: FONT.bold, fontSize: TYPE.title, lineHeight: 34, color: COLOR.foreground },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  pillText: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.foreground },
  pillCount: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.secondary },
  deck: { flex: 1, minHeight: 480, gap: 12 },
  failureBox: { gap: 2 },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.danger },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { fontFamily: FONT.bold, fontSize: TYPE.sm, color: COLOR.foreground },
  notice: { gap: 4, paddingHorizontal: 20, paddingVertical: 16 },
  noticeTitle: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  noticeBody: { fontFamily: FONT.medium, fontSize: TYPE.sm, lineHeight: 20, color: COLOR.secondary },
  history: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 8 },
  historyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyTitle: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 20, color: COLOR.foreground },
  historyHint: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 18, color: COLOR.secondary },
  chip: { minWidth: 28, paddingHorizontal: 8, paddingVertical: 2, textAlign: 'center', borderRadius: RADIUS.pill, overflow: 'hidden', backgroundColor: COLOR.surfaceSunken, fontFamily: FONT.bold, fontSize: TYPE.fine, color: COLOR.secondary },
});
