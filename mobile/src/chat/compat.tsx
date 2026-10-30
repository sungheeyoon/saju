import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { compatChipName, compatRowParts, type RoomCompat } from '@chat/room/compat';
import type { Element } from '@saju';

import { COLOR, CONTROL, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';

import { ChatIcon, TaijiIcon } from './icons';

const toMatch = (matchId: string) => router.push(`/me/match/${matchId}?from=chat` as never);

/** 방 머리의 궁합 단추 — 폰의 짧은 꼴이다: 만드는 중은 작은 고리, 실패는 경고, 점수는 「72점」(ADR 0155 「2026-10-11 저녁 덧」) */
export function CompatChip({ compat, matchId, tone }: { compat: RoomCompat; matchId: string; tone: Element | null }) {
  const scale = tone === null ? null : ELEMENT_TONE[tone];
  const ink = scale?.ink ?? COLOR.foreground;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={compatChipName(compat)}
      onPress={() => toMatch(matchId)}
      style={[styles.chip, { backgroundColor: scale?.soft ?? COLOR.surface }]}
    >
      {compat.kind === 'failed' ? <ChatIcon name="alert" color={COLOR.danger} size={18} /> : <TaijiIcon color={ink} />}
      {compat.kind === 'ready' && <Text style={[styles.score, { color: ink }]}>{compat.score}점</Text>}
      {compat.kind === 'making' && <ActivityIndicator size="small" color={ink} />}
    </Pressable>
  );
}

/** 프로필 시트의 궁합 한 줄 — 방 머리 알약과 같은 상태 · 같은 곳이다(대장 matching-14) */
export function CompatRow({ compat, matchId }: { compat: RoomCompat; matchId: string }) {
  const { lead, tail, name } = compatRowParts(compat);
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={name} onPress={() => toMatch(matchId)} style={styles.row}>
      <View style={styles.lead}>
        {compat.kind === 'failed' ? <ChatIcon name="alert" color={COLOR.danger} size={18} /> : <TaijiIcon color={COLOR.foreground} />}
        {lead.map((word, at) => (
          <Text key={word} style={at > 0 && compat.kind === 'making' ? styles.making : styles.word}>
            {word}
          </Text>
        ))}
      </View>
      <View style={styles.tail}>
        {tail !== null && <Text style={styles.tailText}>{tail}</Text>}
        <ChatIcon name="chevron" color={COLOR.secondary} size={16} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: CONTROL,
    minWidth: CONTROL,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  score: { fontSize: TYPE.sm, fontFamily: FONT.bold },
  row: { minHeight: CONTROL, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  lead: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  word: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  making: { fontSize: TYPE.body, fontFamily: FONT.medium, color: COLOR.secondary },
  tail: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  tailText: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.secondary },
});
