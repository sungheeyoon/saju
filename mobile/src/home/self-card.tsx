import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HOUR_UNKNOWN_LABEL } from '@input/query';
import { ELEMENT_PICTURE_KO, ELEMENTS, STEM_INFO } from '@saju';
import { withFromMe } from '@web-home/from-me';
import { SELF_READING_MAKING } from '@web-home/making';

import { ElementSymbol } from '@/ui/element-symbol';
import { Photo } from '@/ui/photo';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';

import type { SelfCardData } from './read';

type Ok = Extract<SelfCardData, { kind: 'ok' }>;

/** 내 사주 카드(줄인 판) — 홈에서 오행 면을 입는 것은 이 판 하나다. 「내 프로필」 시트는 프로필 화면과 함께 온다 */
export function SelfCard({ card }: { card: Ok }) {
  const { saju, query } = card;
  const dayElement = STEM_INFO[saju.pillars.dayMaster].element;
  const tone = ELEMENT_TONE[dayElement];
  const counts = saju.analysis.elements.counts;

  return (
    <View accessibilityLabel="내 사주" style={[styles.card, { backgroundColor: tone.soft }]}>
      <View style={styles.head}>
        <View style={styles.face}>
          {card.face === null ? (
            <ElementSymbol element={dayElement} size={32} />
          ) : (
            <Photo userId={card.face.userId} size={56} hasPhoto={card.face.hasPhoto} focus={card.face.focus} fallback={<ElementSymbol element={dayElement} size={32} />} />
          )}
        </View>
        <View style={styles.who}>
          <Text style={styles.name}>{card.label}</Text>
          <Text style={styles.birth}>
            {query.date}
            {query.hourKnown === false ? '' : ` ${query.time}`} · {query.city}
            {query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ''}
          </Text>
        </View>
      </View>

      {card.metaphor !== null && (
        <Text style={styles.metaphor} numberOfLines={2}>
          <Text style={{ color: tone.ink }}>“</Text>
          {card.metaphor}
          <Text style={{ color: tone.ink }}>”</Text>
        </Text>
      )}

      <View accessibilityLabel="오행 분포" style={styles.elements}>
        {ELEMENTS.map((element) => {
          const count = counts[element];
          const color = count === 0 ? COLOR.muted : ELEMENT_TONE[element].ink;
          return (
            <View key={element} style={styles.element}>
              <ElementSymbol element={element} size={24} />
              <Text style={[styles.elementName, { color }]}>{ELEMENT_PICTURE_KO[element]}</Text>
              <Text style={[styles.elementCount, { color }]}>{count}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Pressable accessibilityRole="link" onPress={() => router.push(withFromMe('/me/readings/self') as never)} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText} numberOfLines={1}>
            {card.hasReading ? '사주풀이 보기' : card.making ? SELF_READING_MAKING : '사주풀이 받기'}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push(`/me/people/${card.personId}?tab=chart` as never)} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryText} numberOfLines={1}>만세력 보기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, borderRadius: RADIUS.panel },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  face: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.surface },
  who: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONT.bold, fontSize: TYPE.heading, color: COLOR.foreground },
  birth: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.secondary, marginTop: 2 },
  metaphor: { fontFamily: FONT.medium, fontSize: TYPE.lead, lineHeight: 26, color: COLOR.foreground, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255, 253, 249, 0.55)' },
  elements: { flexDirection: 'row' },
  element: { flex: 1, alignItems: 'center', gap: 2 },
  elementName: { fontFamily: FONT.medium, fontSize: TYPE.fine },
  elementCount: { fontFamily: FONT.bold, fontSize: TYPE.heading },
  actions: { flexDirection: 'row', gap: 8 },
  primary: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.accent },
  primaryText: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.onAccent },
  secondary: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  secondaryText: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  pressed: { transform: [{ scale: 0.97 }] },
});
