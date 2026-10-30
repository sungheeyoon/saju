import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

export type SameChartQuestion = { readonly label: string; readonly answer: (sameperson: boolean) => void };

/** 「이미 저장된 그 사람인가요?」 — 거절이 아니라 물음이고 두 답이 나란히 선다(`app/same-chart-ask.tsx`, ADR 0034) */
export function SameChartAsk({ question, busy }: { question: SameChartQuestion; busy: boolean }) {
  return (
    <View accessibilityLabel="같은 사람인지 확인" style={styles.box}>
      <Text style={styles.title}>저장된 {question.label} 님과 같은 사람인가요?</Text>
      <Text style={styles.body}>여덟 글자와 태어난 시각이 같습니다. 같은 분이면 저장하지 않고 그분의 화면으로 갑니다 — 따로 저장하면 풀이권을 한 번 더 쓰게 됩니다.</Text>
      <PrimaryButton label="네, 같은 사람입니다" disabled={busy} onPress={() => question.answer(true)} />
      <SecondaryButton label="아니요, 다른 사람입니다" disabled={busy} onPress={() => question.answer(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10, padding: 16, borderRadius: RADIUS.panel, borderWidth: 1, borderColor: COLOR.warningBorder, backgroundColor: COLOR.warningWash },
  title: { fontSize: TYPE.body, lineHeight: 23, fontFamily: FONT.bold, color: COLOR.foreground },
  body: { fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.medium, color: COLOR.secondary },
});
