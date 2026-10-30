import { StyleSheet, Text, View } from 'react-native';

import { initialOf, type PhotoFocus } from '@profile';
import type { Element } from '@saju';

import { Photo } from '@/ui/photo';
import { COLOR, ELEMENT_TONE, FONT } from '@/ui/tokens';

/** 그 사람의 색 고리 두께 — 사진 위에서도 누구의 색인지 남는다(`app/me/avatar.tsx`) */
const RING = 3;

/**
 * 사람 하나가 서는 자리 — 사진이 있으면 사진, 없거나 못 받으면 그 사람의 파스텔과 첫 글자다. 볼 수 있는가는 사진 문이 답한다(`app/me/avatar.tsx`).
 * 색은 꾸밈이라 낭독기에서 숨는다. `null` 은 「모른다」의 회색 한 벌이다.
 */
export function Avatar({
  nickname,
  size,
  tone,
  dim = false,
  userId = null,
  hasPhoto = false,
  focus,
}: {
  nickname: string;
  size: number;
  tone: Element | null;
  dim?: boolean;
  /** 떠난 사람은 `null` — 그때는 첫 글자로 선다 */
  userId?: string | null;
  hasPhoto?: boolean;
  focus?: PhotoFocus;
}) {
  const scale = tone === null ? { ink: COLOR.none, soft: COLOR.noneSoft } : ELEMENT_TONE[tone];
  const initial = <Text style={{ fontSize: Math.round(size * 0.36), fontFamily: FONT.bold, color: scale.ink }}>{initialOf(nickname)}</Text>;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: scale.soft }, dim && styles.dim]}
    >
      {userId === null ? initial : <Photo userId={userId} size={size - RING * 2} hasPhoto={hasPhoto} focus={focus} fallback={initial} />}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.6 },
});
