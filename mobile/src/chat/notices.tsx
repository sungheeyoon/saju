import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { accountFailureOf, accountNoticeOf, type AccountState } from '@account/index';
import { SUPPORT_EMAIL } from '@brand';

import { Card } from '@/ui/surfaces';
import { PrimaryButton, TextButton } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';

/** 화면 안의 실패 줄 — 웹의 `FailureLine` 처럼 붉은 글자와 「다시 시도하기」 */
export function FailureLine({ children, onRetry }: { children: string; onRetry: () => void }) {
  return (
    <View accessibilityRole="alert" style={styles.failure}>
      <Text style={styles.failureText}>{children}</Text>
      <TextButton label="다시 시도하기" onPress={onRetry} />
    </View>
  );
}

/** 계정이 막혀 있을 때 화면 대신 보는 것 — 글자도 판정도 `src/lib/account` 가 든다(ADR 0048) */
export function AccountNotice({ state, onRetry }: { state: AccountState; onRetry: () => void }) {
  const failure = accountFailureOf(state);
  if (failure !== null) {
    if (failure.next === 'retry') return <FailureLine onRetry={onRetry}>{failure.line}</FailureLine>;
    return (
      <View accessibilityRole="alert" style={styles.failure}>
        <Text style={styles.failureText}>{failure.line}</Text>
        <TextButton label="다시 로그인" onPress={() => router.replace('/')} />
      </View>
    );
  }
  const text = accountNoticeOf(state, SUPPORT_EMAIL);
  if (text === null) return null;
  return (
    <Card style={styles.notice}>
      <Text style={styles.title}>{text.title}</Text>
      <Text style={styles.detail}>{text.detail}</Text>
    </Card>
  );
}

/** 없는 방 · 내가 볼 수 없는 방 — 있는지를 가르지 않는다(ADR 0091) */
export function NoRoom() {
  return (
    <Card style={styles.notice}>
      <Text style={styles.title}>페이지를 찾을 수 없어요</Text>
      <Text style={styles.detail}>주소가 잘못되었거나 페이지가 이동되었을 수 있어요.</Text>
      <PrimaryButton label="홈으로" onPress={() => router.replace('/me' as never)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  failure: { gap: 4, alignItems: 'flex-start' },
  failureText: { fontSize: TYPE.note, lineHeight: 22, fontFamily: FONT.medium, color: COLOR.danger },
  notice: { gap: 8 },
  title: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  detail: { fontSize: TYPE.note, lineHeight: 22, fontFamily: FONT.medium, color: COLOR.secondary },
});
