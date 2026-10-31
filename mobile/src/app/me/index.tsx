import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DEFAULT_QUERY, missingAnswer } from '@input/query';
import { ELEMENTS } from '@saju';

import { signOut } from '@/auth/sign-in';
import { listenLive } from '@/chat/live';
import { OtherSaju, ReceivedReadings, RunningReadings, SavedPeople } from '@/home/lists';
import { homeUnreachable, readHome, readRunning, type Home } from '@/home/read';
import { SelfCard } from '@/home/self-card';
import { BirthFields, useBirthForm } from '@/people/birth-fields';
import { openParticipation, saveFailureOf, saveSelfPerson } from '@/reading/chart-writes';
import { followRefusal } from '@/reading/panel';
import { ElementSymbol } from '@/ui/element-symbol';
import { PrimaryButton, SecondaryButton } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { CardFrame, Paper } from '@/ui/surfaces';
import { settled } from '@/ui/settled';

/** 홈 — 차례는 웹의 `app/me/(home)/page.tsx` 와 같다. 다른 화면에서 돌아올 때마다 다시 읽는다 */
export default function HomeScreen() {
  const [home, setHome] = useState<Home | null>(null);

  const load = useCallback(() => {
    void settled(readHome(), 'readHome', homeUnreachable).then((next) => {
      setHome(next);
      /* 참여를 여는 문은 아무것도 안 그린다 — 끈 사람은 안 열리고, 못 열어도 홈은 선다(웹의 `openDiscoveryParticipation`) */
      if (next.kind === 'home') void openParticipation();
    });
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
      void settled(readRunning(), 'readRunning', () => null).then((lines) => {
        if (lines === null) return;
        if (lines.length === 0) load();
        else setHome((now) => (now?.kind === 'home' ? { ...now, running: lines } : now));
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [watching, load]));

  if (home === null) return <ActivityIndicator color={COLOR.secondary} style={styles.loading} />;
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Body home={home} retry={load} />
    </ScrollView>
  );
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
        <CardFrame style={styles.notice}>
          <Text style={styles.noticeTitle}>{home.title}</Text>
          <Text style={styles.noticeDetail}>{home.detail}</Text>
        </CardFrame>
      );
    case 'no-self':
      return <NoSelf nickname={home.nickname} onSaved={retry} />;
    case 'home':
      break;
  }

  const self =
    home.self.kind === 'ok' ? (
      <SelfCard card={home.self} />
    ) : home.self.kind === 'unreadable' ? (
      <CardFrame style={styles.unreadable}>
        <Text style={styles.noticeDetail}>{home.self.message}</Text>
        <Text style={styles.meta}>{home.self.note}</Text>
      </CardFrame>
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

/** 내 사주가 없을 때 — 웹의 등록 폼 그대로다(`app/me/onboarding.tsx`). 저장은 앱의 문을 지나고 여덟 글자는 서버가 센다(ADR 0211). 저장하면 홈을 다시 읽어 내 사주 카드가 선다 */
function NoSelf({ nickname, onSaved }: { nickname: string; onSaved: () => void }) {
  const form = useBirthForm({ ...DEFAULT_QUERY, name: nickname });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const missing = missingAnswer(form.query);

  const save = async () => {
    setSaving(true);
    setFailure(null);
    const answer = await saveSelfPerson(form.query);
    setSaving(false);
    if (answer.ok && answer.value.ok) {
      onSaved();
      return;
    }
    setFailure(saveFailureOf(answer));
    if (!answer.ok) followRefusal(answer.refused);
  };

  return (
    <Paper style={styles.paper}>
      <View style={styles.symbols}>
        {ELEMENTS.map((element) => (
          <ElementSymbol key={element} element={element} size={40} />
        ))}
      </View>
      <View style={styles.paperHead}>
        <Text accessibilityRole="header" style={styles.paperTitle}>내 사주 등록</Text>
        <Text style={styles.paperDetail}>
          <Text style={styles.strong}>{nickname}</Text> 님의 출생 정보를 입력해 주세요.
        </Text>
      </View>
      <BirthFields form={form} showName={false} />
      <PrimaryButton label={saving ? '저장하는 중…' : '내 사주로 저장'} onPress={() => void save()} disabled={missing !== null || saving} />
      {missing !== null && <Text style={styles.meta}>{missing}</Text>}
      {failure !== null && <Text accessibilityRole="alert" style={styles.failureText}>저장하지 못했어요. {failure}</Text>}
    </Paper>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 48 },
  content: { padding: 16, gap: 24 },
  stack: { gap: 12 },
  failure: { gap: 8, alignItems: 'flex-start' },
  failureText: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.danger },
  noticeTitle: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  noticeDetail: { fontFamily: FONT.medium, fontSize: TYPE.sm, lineHeight: 20, color: COLOR.secondary },
  meta: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  paper: { gap: 24 },
  symbols: { flexDirection: 'row', gap: 8 },
  paperHead: { gap: 8 },
  strong: { fontFamily: FONT.bold, color: COLOR.foreground },
  paperTitle: { fontFamily: FONT.bold, fontSize: TYPE.title, lineHeight: 35, color: COLOR.foreground },
  notice: { gap: 4, paddingHorizontal: 20, paddingVertical: 16 },
  unreadable: { gap: 8, padding: 20 },
  paperDetail: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
});
