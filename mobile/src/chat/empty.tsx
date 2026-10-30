import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { CHAT_EMPTY_DETAIL, CHAT_EMPTY_TITLE } from '@chat/copy';

import { Paper } from '@/ui/surfaces';
import { PrimaryButton } from '@/ui/parts';
import { COLOR, ELEMENT_TONE, FONT, TYPE } from '@/ui/tokens';

/** 아직 방이 없을 때 — 갈 길은 하나다. 내 사주가 아직 없으면 그 자리에 등록이 선다(대장 matching-13) */
export function EmptyChat({ hasSelf }: { hasSelf: boolean }) {
  return (
    <Paper style={styles.panel}>
      <ChatIllustration />
      <View style={styles.words}>
        <Text style={styles.title}>{CHAT_EMPTY_TITLE}</Text>
        <Text style={styles.detail}>{CHAT_EMPTY_DETAIL}</Text>
      </View>
      {hasSelf ? (
        <PrimaryButton label="오늘의 인연 보기" onPress={() => router.push('/me/matching' as never)} />
      ) : (
        <PrimaryButton label="내 사주 등록하기" onPress={() => router.push('/me' as never)} />
      )}
    </Paper>
  );
}

/** 말풍선 둘이 서로를 향해 기운다 — 웹의 `ChatIllustration` 과 같은 경로 값이다. 꾸밈이라 낭독기에서 숨는다 */
function ChatIllustration() {
  const wood = ELEMENT_TONE.木;
  const fire = ELEMENT_TONE.火;
  const metal = ELEMENT_TONE.金;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.art}>
      <Svg width={224} height={146} viewBox="0 0 260 170">
        <Circle cx="130" cy="92" r="72" fill={COLOR.surface} opacity={0.7} />
        <G rotation={-6} originX={78} originY={78}>
          <Path
            d="M34 52a18 18 0 0 1 18-18h56a18 18 0 0 1 18 18v28a18 18 0 0 1-18 18H66l-16 14v-14a18 18 0 0 1-16-18Z"
            fill={wood.soft}
            stroke={wood.ink}
            strokeWidth={2}
          />
          <Circle cx="82" cy="66" r="3" fill={wood.ink} />
          <Circle cx="94" cy="66" r="3" fill={wood.ink} opacity={0.6} />
          <Circle cx="106" cy="66" r="3" fill={wood.ink} opacity={0.3} />
        </G>
        <G rotation={5} originX={182} originY={104}>
          <Path
            d="M226 88a18 18 0 0 0-18-18h-56a18 18 0 0 0-18 18v26a18 18 0 0 0 18 18h40l16 13v-13a18 18 0 0 0 18-18Z"
            fill={fire.soft}
            stroke={fire.ink}
            strokeWidth={2}
          />
          <Path d="M152 96h40M152 108h26" stroke={fire.ink} strokeWidth={3} fill="none" opacity={0.45} />
        </G>
        <Path d="M132 17 135.4 26.6 145 30l-9.6 3.4L132 43l-3.4-9.6L119 30l9.6-3.4Z" fill={metal.mid} stroke={metal.ink} strokeWidth={1.8} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 16, alignItems: 'stretch' },
  art: { alignItems: 'center' },
  words: { gap: 6 },
  title: { fontSize: TYPE.lead, fontFamily: FONT.bold, color: COLOR.foreground },
  detail: { fontSize: TYPE.note, lineHeight: 22, fontFamily: FONT.medium, color: COLOR.creamInk },
});
