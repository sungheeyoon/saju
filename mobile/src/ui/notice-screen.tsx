import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from './logo';
import { COLOR, FONT, RADIUS, TYPE } from './tokens';

/** 안내 화면의 틀 하나 — 웹의 `app/ui/notice-screen.tsx`: 가운데 크림 판에 로고 · 제목 · 설명 · 단추 · 보조 줄 */
export function NoticeScreen({
  title,
  description,
  children,
  actions,
  note,
}: {
  title: string;
  /** 문단을 나누려면 `NoticeLine` 여럿을 넘긴다 */
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.head}>
            <View style={styles.badge}>
              <Logo size={40} />
            </View>
            <Text style={styles.title}>{title}</Text>
            {description !== undefined && <View style={styles.description}>{description}</View>}
          </View>
          {children}
          {actions !== undefined && <View style={styles.actions}>{actions}</View>}
          {note !== undefined && <View style={styles.note}>{note}</View>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function NoticeLine({ children }: { children: ReactNode }) {
  return <Text style={styles.line}>{children}</Text>;
}

export function NoticeNote({ children }: { children: ReactNode }) {
  return <Text style={styles.noteLine}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 16, paddingVertical: 48 },
  card: { gap: 24, padding: 24, borderRadius: RADIUS.panel, backgroundColor: COLOR.cream },
  head: { gap: 8 },
  badge: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.surface, marginBottom: 12 },
  title: { fontFamily: FONT.bold, fontSize: TYPE.title, lineHeight: 34, color: COLOR.foreground },
  description: { gap: 12 },
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 26, color: COLOR.secondary },
  actions: { gap: 8 },
  note: { gap: 4 },
  noteLine: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
});
