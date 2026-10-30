import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ELEMENTS } from '@saju';

import { signOut } from '@/auth/sign-in';
import { listenLive } from '@/chat/live';
import { OtherSaju, ReceivedReadings, RunningReadings, SavedPeople } from '@/home/lists';
import { readHome, readRunning, type Home } from '@/home/read';
import { SelfCard } from '@/home/self-card';
import { ElementSymbol } from '@/ui/element-symbol';
import { Panel, PrimaryButton, SecondaryButton } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';

/** 홈 — 차례는 웹의 `app/me/(home)/page.tsx` 와 같다. 다른 화면에서 돌아올 때마다 다시 읽는다 */
export default function HomeScreen() {
  const [home, setHome] = useState<Home | null>(null);

  const load = useCallback(() => {
    void readHome().then(setHome);
  }, []);
  useFocusEffect(load);

  /* 다 된 풀이는 소식으로 온다(ADR 0155) — 계정 채널이 들으면 홈을 다시 읽는다. 다른 탭에 있어도 돌아오면 어차피 다시 읽는다 */
  useEffect(() => listenLive((signal) => {
    if (signal.kind === 'resync' || signal.change.area === 'notifications') load();
  }), [load]);

  /* 만드는 동안은 5초마다 줄만 다시 묻는다(웹의 `RUNNING_ASK_EVERY_MS`). 줄이 사라지면 홈을 다시 읽어 결과가 선다 */
  const watching = home?.kind === 'home' && home.running.length > 0;
  useFocusEffect(useCallback(() => {
    if (!watching) return;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      void readRunning().then((lines) => {
        if (lines === null) return;
        if (lines.length === 0) load();
        else setHome((now) => (now?.kind === 'home' ? { ...now, running: lines } : now));
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [watching, load]));

  return <ScrollView contentContainerStyle={styles.content}>{home === null ? null : <Body home={home} retry={load} />}</ScrollView>;
}

function Body({ home, retry }: { home: Home; retry: () => void }) {
  switch (home.kind) {
    case 'failed':
      return (
        <View style={styles.failure}>
          <Text style={styles.failureText}>{home.message}</Text>
          <SecondaryButton label="다시 시도하기" onPress={retry} />
        </View>
      );
    case 'sign-in':
      return (
        <View style={styles.failure}>
          <Text style={styles.failureText}>{home.message}</Text>
          <SecondaryButton label="다시 로그인" onPress={() => void signOut()} />
        </View>
      );
    case 'notice':
      return (
        <Panel>
          <Text style={styles.noticeTitle}>{home.title}</Text>
          <Text style={styles.noticeDetail}>{home.detail}</Text>
        </Panel>
      );
    case 'no-self':
      return <NoSelf />;
    case 'home':
      break;
  }

  const self =
    home.self.kind === 'ok' ? (
      <SelfCard card={home.self} />
    ) : home.self.kind === 'unreadable' ? (
      <Panel>
        <Text style={styles.noticeDetail}>{home.self.message}</Text>
        <Text style={styles.meta}>{home.self.note}</Text>
      </Panel>
    ) : (
      <View style={styles.failure}>
        <Text style={styles.failureText}>{home.self.message}</Text>
        <SecondaryButton label="다시 시도하기" onPress={retry} />
      </View>
    );

  if (home.firstVisit) {
    return (
      <>
        {self}
        <SavedPeople people={home.people} slots={home.slots} />
        <OtherSaju />
      </>
    );
  }
  return (
    <>
      <RunningReadings running={home.running} />
      <View style={styles.stack}>
        {self}
        <OtherSaju />
      </View>
      <ReceivedReadings readings={home.received} />
      <SavedPeople people={home.people} slots={home.slots} />
    </>
  );
}

/**
 * 내 사주가 없을 때 — 웹의 등록 폼 자리다. **저장 단추를 세우지 않는다**: 등록 문(`create_self_person`)이 서비스 키에만 열려 있어
 * 앱이 못 부른다(ADR 0136). 저장 없는 계산으로만 잇는다.
 */
function NoSelf() {
  return (
    <Panel tone="cream" style={styles.paper}>
      <View style={styles.symbols}>
        {ELEMENTS.map((element) => (
          <ElementSymbol key={element} element={element} size={40} />
        ))}
      </View>
      <Text style={styles.paperTitle}>내 사주 등록</Text>
      <PrimaryButton label="사주 보기" onPress={() => router.push('/?another=1' as never)} />
    </Panel>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24 },
  stack: { gap: 12 },
  failure: { gap: 8, alignItems: 'flex-start' },
  failureText: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.danger },
  noticeTitle: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  noticeDetail: { fontFamily: FONT.medium, fontSize: TYPE.sm, lineHeight: 22, color: COLOR.secondary, marginTop: 4 },
  meta: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.muted, marginTop: 4 },
  paper: { gap: 20 },
  symbols: { flexDirection: 'row', gap: 8 },
  paperTitle: { fontFamily: FONT.bold, fontSize: TYPE.title, color: COLOR.foreground },
});
