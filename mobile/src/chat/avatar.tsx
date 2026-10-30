import { StyleSheet, Text, View } from 'react-native';

import { initialOf } from '@profile';
import type { Element } from '@saju';

import { COLOR, ELEMENT_TONE, FONT } from '@/ui/tokens';

/**
 * 사람 하나가 서는 자리 — 그 사람의 파스텔과 첫 글자. 웹이 사진을 못 받았을 때의 모양 그대로다(`app/me/avatar.tsx`). 앱은 사진 문이 아직 없다(`reads.ts`).
 * 색은 꾸밈이라 낭독기에서 숨는다. `null` 은 「모른다」의 회색 한 벌이다.
 */
export function Avatar({ nickname, size, tone, dim = false }: { nickname: string; size: number; tone: Element | null; dim?: boolean }) {
  const scale = tone === null ? { ink: COLOR.none, soft: COLOR.noneSoft } : ELEMENT_TONE[tone];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: scale.soft }, dim && styles.dim]}
    >
      <Text style={{ fontSize: Math.round(size * 0.36), fontFamily: FONT.bold, color: scale.ink }}>{initialOf(nickname)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.6 },
});
