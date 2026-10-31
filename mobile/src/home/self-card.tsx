import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HOUR_UNKNOWN_LABEL } from '@input/query';
import { ELEMENT_PICTURE_KO, ELEMENTS, STEM_INFO } from '@saju';
import { withFromMe } from '@web-home/from-me';
import { SELF_READING_MAKING } from '@web-home/making';

import { DayMasterChip } from '@/people/parts';
import { Button } from '@/ui/buttons';
import { ElementSymbol } from '@/ui/element-symbol';
import { StemSymbol } from '@/ui/stem-symbol';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { Tile } from '@/ui/surfaces';

import type { SelfCardData } from './read';
import { SelfProfile } from './self-profile';

type Ok = Extract<SelfCardData, { kind: 'ok' }>;

/** 내 사주 카드(줄인 판) — 홈에서 오행 면을 입는 것은 이 판 하나다. 일간은 원 · 딱지 · 뒤의 그림이 든다 */
export function SelfCard({ card, actions }: { card: Ok; /** 단추 자리를 바꿔 세운다 — 아직 저장 안 된 사주에 「이 사주가 내 사주 맞나요?」를 물을 때 */ actions?: ReactNode }) {
  const { saju, query } = card;
  const dayElement = STEM_INFO[saju.pillars.dayMaster].element;
  const tone = ELEMENT_TONE[dayElement];
  const counts = saju.analysis.elements.counts;

  return (
    <Tile tone={tone.soft} accessibilityLabel="내 사주" style={styles.card}>
      <View pointerEvents="none" style={styles.watermark}>
        <StemSymbol stem={saju.pillars.dayMaster} size={160} opacity={0.15} />
      </View>
      <View style={styles.chip}>
        <DayMasterChip stem={saju.pillars.dayMaster} />
      </View>
      <View style={styles.head}>
        {card.face !== null ? (
          <SelfProfile face={card.face} stem={saju.pillars.dayMaster} />
        ) : (
          <View style={styles.face}>
            <StemSymbol stem={saju.pillars.dayMaster} size={32} />
          </View>
        )}
        <View style={styles.who}>
          <Text style={[styles.name, styles.nameRoom]}>{card.label}</Text>
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

      {actions ?? (
        <View style={styles.actions}>
          <Button accessibilityRole="link" label={card.hasReading ? '사주풀이 보기' : card.making ? SELF_READING_MAKING : '사주풀이 받기'} onPress={() => router.push(withFromMe('/me/readings/self') as never)} style={styles.action} />
          <Button accessibilityRole="link" variant="secondary" label="만세력 보기" onPress={() => router.push(`/me/people/${card.personId}?tab=chart` as never)} style={styles.action} />
        </View>
      )}
    </Tile>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -32, bottom: -40 },
  chip: { position: 'absolute', top: 16, right: 16, zIndex: 1 },
  nameRoom: { paddingRight: 80 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  face: { width: 56, height: 56, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.surface },
  who: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONT.bold, fontSize: TYPE.heading, color: COLOR.foreground },
  birth: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.secondary, marginTop: 2 },
  metaphor: { fontFamily: FONT.medium, fontSize: TYPE.lead, lineHeight: 26, color: COLOR.foreground, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.cell, backgroundColor: 'rgba(255, 253, 249, 0.55)' },
  elements: { flexDirection: 'row' },
  element: { flex: 1, alignItems: 'center', gap: 2 },
  elementName: { fontFamily: FONT.medium, fontSize: TYPE.fine },
  elementCount: { fontFamily: FONT.bold, fontSize: TYPE.heading },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, paddingHorizontal: 12 },
});
