import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopBar } from '@/ui/top-bar';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { Card, Paper } from '@/ui/surfaces';

/** 안내 화면의 판 — 내려 읽는 한 장 */
export const InfoScreen = forwardRef<ComponentRef<typeof ScrollView>, { children: ReactNode; gap?: number; title: string; fallback: string }>(function InfoScreen({ children, gap = 16, title, fallback }, ref) {
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <TopBar title={title} fallback={fallback} />
      <ScrollView ref={ref} contentContainerStyle={[styles.content, { gap }]}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
});

/** 전문의 머리 — 크림 판에 제목 · 한 줄. 작은 글은 맨 위 줄의 이름이 맡는다 */
export function LegalHead({ title, note }: { title: string; note?: string | null }) {
  return (
    <Paper style={styles.head}>
      <Text style={styles.title}>{title}</Text>
      {note ? <Text style={styles.line}>{note}</Text> : null}
    </Paper>
  );
}

/** 조항 한 장 */
export function Clause({ title, onLayout, children }: { title: string; onLayout?: (event: LayoutChangeEvent) => void; children: ReactNode }) {
  return (
    <View onLayout={onLayout}>
      <Card style={styles.clause}>
        <Text style={styles.name}>{title}</Text>
        {children}
      </Card>
    </View>
  );
}

/** 점 목록의 한 줄 */
export function Dot({ children }: { children: ReactNode }) {
  return (
    <View style={styles.dotRow}>
      <View style={styles.dot} />
      <Text style={styles.dotText}>{children}</Text>
    </View>
  );
}

export function InfoLine({ children }: { children: ReactNode }) {
  return <Text style={styles.line}>{children}</Text>;
}

export function FinePrint({ children }: { children: ReactNode }) {
  return <Text style={styles.fine}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, padding: 16, paddingBottom: 32 },
  head: { gap: 8, paddingHorizontal: 24, paddingVertical: 28 },
  title: { fontFamily: FONT.bold, fontSize: TYPE.title, lineHeight: 35, color: COLOR.foreground },
  name: { fontFamily: FONT.bold, fontSize: TYPE.lead, lineHeight: 24, color: COLOR.foreground },
  clause: { gap: 12 },
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 28, color: COLOR.secondary },
  fine: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary, paddingHorizontal: 4 },
  dotRow: { flexDirection: 'row', gap: 10 },
  dot: { width: 6, height: 6, marginTop: 10, borderRadius: RADIUS.pill, backgroundColor: COLOR.borderStrong },
  dotText: { flex: 1, fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 26, color: COLOR.secondary },
});
