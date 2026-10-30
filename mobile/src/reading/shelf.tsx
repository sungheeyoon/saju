import type { DoorDayMaster, ShelfBook, ShelfMaking, ShelfSlot } from '@reading/door';
import { READING_STALE_LABEL } from '@reading/notes';
import type { Element } from '@saju';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ElementSymbol } from '@/ui/element-symbol';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';

import { CoverFace } from './result';
import { FlowBand } from './waiting';

/** 칩 넷 — 값과 글자는 웹의 `app/me/(shelf)/readings/kind.ts` 와 같다 */
export type ShelfChip = 'all' | ShelfSlot;
export const SHELF_CHIPS: readonly { readonly chip: ShelfChip; readonly label: string }[] = [
  { chip: 'all', label: '전체' },
  { chip: 'saju', label: '사주풀이' },
  { chip: 'compat', label: '궁합풀이' },
  { chip: 'match', label: '인연 궁합' },
];
export const SHELF_TITLE = '풀이 보관함';

/** 그 풀이로 간다 — 온 곳을 들고 간다. 궁합 · 인연 화면의 주소는 웹 그대로이고 없는 경로여도 그대로 둔다 */
export const openBook = (href: string) =>
  router.push(`${href}${href.includes('?') ? '&' : '?'}from=shelf` as never);

const elementOf = (subject: DoorDayMaster | null | undefined) => (subject?.element ?? null) as Element | null;

/** 작은 책 표지 — 색은 일간, 왼쪽 등, 한 사람이면 그림 하나 · 두 사람이면 둘과 점수 */
function MiniCover({ subjects, score }: { subjects: readonly (DoorDayMaster | null)[]; score: number | null }) {
  const elements = subjects.map(elementOf);
  const first = elements[0] ?? null;
  return (
    <View aria-hidden style={styles.mini}>
      <CoverFace tones={elements} />
      <View style={[styles.spine, { backgroundColor: first === null ? COLOR.noneMid : ELEMENT_TONE[first].mid }]} />
      <View style={styles.faces}>
        {elements.map((element, at) => (
          <ElementSymbol key={at} element={element} size={elements.length === 1 ? 32 : 22} />
        ))}
      </View>
      {elements.length > 1 && score !== null && <Text style={styles.miniScore}>{score}</Text>}
    </View>
  );
}

function Row({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {children}
    </Pressable>
  );
}

export function BookRow({ book }: { book: ShelfBook }) {
  return (
    <Row label={book.title} onPress={() => openBook(book.href)}>
      <MiniCover subjects={book.subjects} score={book.score} />
      <View style={styles.rowText}>
        <View style={styles.rowHead}>
          <Text numberOfLines={1} style={styles.rowTitle}>
            {book.title}
          </Text>
          {book.stale && <Text style={styles.stale}>{READING_STALE_LABEL}</Text>}
        </View>
        {book.metaphor !== null && (
          <Text numberOfLines={2} style={styles.rowNote}>
            {book.metaphor}
          </Text>
        )}
        <Text style={styles.rowDate}>{book.date}</Text>
      </View>
    </Row>
  );
}

export function MakingRow({ making, kind }: { making: ShelfMaking; kind?: string }) {
  return (
    <Row label={making.name} onPress={() => openBook(making.href)}>
      <View aria-hidden style={[styles.mini, styles.miniMaking]}>
        <View style={[styles.spine, { backgroundColor: COLOR.creamInk }]} />
        <View style={styles.miniBand}>
          <FlowBand />
        </View>
      </View>
      <View style={styles.rowText}>
        {kind !== undefined && <Text style={styles.kindTag}>{kind}</Text>}
        <Text numberOfLines={1} style={styles.rowTitle}>
          {making.name}
        </Text>
        <Text style={styles.makingLine}>만드는 중…</Text>
      </View>
    </Row>
  );
}

/** 빈 자리 한 줄 — 「여기서 시작」 */
export function BlankBook({ element, label, onPress }: { element: Element; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.blank}>
      <ElementSymbol element={element} size={28} />
      <Text style={styles.blankLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mini: { width: 64, height: 88, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.control },
  miniMaking: { backgroundColor: COLOR.cream },
  miniBand: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  spine: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 6 },
  faces: { flexDirection: 'row', gap: 2 },
  miniScore: { marginTop: 4, fontFamily: FONT.bold, fontSize: TYPE.sm, color: COLOR.foreground },
  row: { flexDirection: 'row', gap: 16, paddingHorizontal: 4, paddingVertical: 16, borderTopWidth: 1, borderTopColor: COLOR.border },
  rowPressed: { backgroundColor: COLOR.surfaceSunken },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flexShrink: 1, fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  rowNote: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  rowDate: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.muted },
  stale: { paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden', borderRadius: RADIUS.pill, backgroundColor: COLOR.warningWash, fontFamily: FONT.bold, fontSize: TYPE.fine, color: ELEMENT_TONE.土.ink },
  kindTag: { fontFamily: FONT.bold, fontSize: TYPE.fine, color: COLOR.secondary },
  makingLine: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.creamInk },
  blank: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8, paddingHorizontal: 20, paddingVertical: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: COLOR.borderStrong, borderRadius: RADIUS.panel },
  blankLabel: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
});
