import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { COLOR, FONT, TYPE } from './tokens';

/** 앞 화면으로 — 스택에 앞 화면이 없으면(주소로 바로 열렸다) 대체 경로를 연다. `router.back` 은 이 파일에만 있다(`scripts/mobile-back.test.ts`) */
export function goBack(fallback: string) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as Href);
}

/** `<` 아이콘만 — 24px, 누르는 자리 44px, 아이콘 왼쪽이 본문 여백 16px 이다(운영자 2026-10-31) */
export function BackButton({ fallback }: { fallback: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => goBack(fallback)} style={styles.back}>
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path d="M15 5 L8 12 L15 19" fill="none" stroke={COLOR.foreground} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

/**
 * 하위 화면의 맨 위 줄 — `<` + 화면 이름. 스크롤 영역 **밖**에 놓아 고정한다.
 * 맨 위 안전 영역은 이 줄이 낸다 — 이 줄을 쓰는 화면의 틀은 `edges` 에 `top` 을 넣지 않는다.
 * 이름 자리에 글자만으로 안 되는 화면(인연 궁합의 얼굴 · 이름)은 `children`, 오른쪽 단추는 `right`.
 */
export function TopBar({ title, fallback, right, children }: { title?: string; fallback: string; right?: ReactNode; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <BackButton fallback={fallback} />
      <View style={styles.middle}>
        {children ??
          (title !== undefined && title !== '' && (
            <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
              {title}
            </Text>
          ))}
      </View>
      {right !== undefined && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingRight: 16, backgroundColor: COLOR.background },
  back: { width: 44, height: 44, paddingLeft: 16, justifyContent: 'center' },
  middle: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 4 },
  title: { flex: 1, fontFamily: FONT.bold, fontSize: TYPE.lead, color: COLOR.foreground },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
});
