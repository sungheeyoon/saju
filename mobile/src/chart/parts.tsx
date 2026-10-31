import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { Rich as RichParts, RichPart } from '@saju-view/notes';

import { Card as CardFace } from '@/ui/surfaces';
import { COLOR, CONTROL, FONT, RADIUS, TYPE } from '@/ui/tokens';

/** 한자 — 부산단디명조에 없어 기기 서체다(웹의 `.glyph`) */
const GLYPH_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' });

const SIZE = {
  xs: { fontSize: TYPE.fine, lineHeight: 18 },
  small: { fontSize: TYPE.small, lineHeight: 20 },
  sm: { fontSize: TYPE.note, lineHeight: 21 },
  base: { fontSize: TYPE.field, lineHeight: 24 },
  lead: { fontSize: TYPE.lead, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 26 },
  heading: { fontSize: TYPE.heading, lineHeight: 29 },
  big: { fontSize: 30, lineHeight: 36 },
} as const;

const TONE = { foreground: COLOR.foreground, secondary: COLOR.secondary, muted: COLOR.muted } as const;

/** 이 화면의 글자 한 벌 — 크기 · 색 · 굵기만 고른다 */
export function T({
  size = 'sm',
  tone = 'foreground',
  color,
  bold = false,
  glyph = false,
  num = false,
  style,
  children,
}: {
  size?: keyof typeof SIZE;
  tone?: keyof typeof TONE;
  color?: string;
  bold?: boolean;
  glyph?: boolean;
  num?: boolean;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
}) {
  return (
    <Text
      style={[
        SIZE[size],
        { color: color ?? TONE[tone], fontFamily: bold ? FONT.bold : FONT.medium },
        glyph && { fontFamily: GLYPH_FONT, fontWeight: bold ? '700' : '400' },
        num && styles.num,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

function Part({ part }: { part: RichPart }) {
  if (typeof part === 'string') return part;
  if ('b' in part) return <Text style={styles.strong}>{part.b}</Text>;
  if ('m' in part) return <Text style={styles.strong}>{part.m}</Text>;
  if ('g' in part) return <Text style={{ fontFamily: GLYPH_FONT }}>{part.g}</Text>;
  if ('n' in part) return <Text style={styles.num}>{part.n}</Text>;
  if ('s' in part) return <Text style={{ color: COLOR.secondary }}>{part.s}</Text>;
  return <Text style={{ color: COLOR.muted }}>{part.u}</Text>;
}

/** 웹과 함께 쓰는 문단을 그린다 — 글자는 `src/lib/saju/view/notes.ts` 가 든다 */
export function Rich({ parts, size = 'xs', tone = 'muted', style }: { parts: RichParts; size?: keyof typeof SIZE; tone?: keyof typeof TONE; style?: StyleProp<TextStyle> }) {
  return (
    <T size={size} tone={tone} style={style}>
      {parts.map((part, index) => (
        <Part key={index} part={part} />
      ))}
    </T>
  );
}

/** 웹 `CARD` — 흰 판 · 가는 테 */
export function Card({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return <CardFace style={[styles.card, style]}>{children}</CardFace>;
}

export function Chevron({ open, size = 16, closedDeg = 90 }: { open: boolean; size?: number; closedDeg?: number }) {
  return (
    <View aria-hidden style={{ transform: [{ rotate: `${open ? (closedDeg === 0 ? 90 : closedDeg + 180) : closedDeg}deg` }] }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="m9 5.5 6.5 6.5L9 18.5" fill="none" stroke={COLOR.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

/** 분석 표 한 장 — 접힌 채 서고, 머리에 제목 · 값 · 한 줄 설명이 선다(웹 `fold.tsx`) */
export function Fold({ title, meta, note, children }: { title: ReactNode; meta?: string; note?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <CardFace style={[styles.card, styles.foldCard]}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.foldHead}>
        <View style={styles.foldText}>
          <View style={styles.wrapBaseline}>
            <T size="lead" bold>{title}</T>
            {meta !== undefined && <T size="sm" tone="secondary" bold>{meta}</T>}
          </View>
          {note !== undefined && <T size="small" tone="secondary">{note}</T>}
        </View>
        <View style={styles.foldIcon}>
          <Chevron open={open} />
        </View>
      </Pressable>
      {open && <View style={styles.foldBody}>{children}</View>}
    </CardFace>
  );
}

/** 펼침 줄 — 웹 `details` · `DISCLOSURE_SUMMARY` */
export function Disclosure({ title, style, children }: { title: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.disclosure, style]}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.disclosureHead}>
        <T size="sm" style={styles.flex}>{title}</T>
        <Chevron open={open} />
      </Pressable>
      {open && <View style={styles.disclosureBody}>{children}</View>}
    </View>
  );
}

export type Tab = { key: string; label: string; panel: ReactNode };

/** 한 판씩 골라 보는 알약 — 웹 `card-tabs.tsx` · `pillar-details.tsx` */
export function Tabs({ tabs, initial, label, small = false }: { tabs: readonly Tab[]; initial?: string; label: string; small?: boolean }) {
  const [view, setView] = useState(initial ?? tabs[0].key);
  const shown = tabs.find((tab) => tab.key === view) ?? tabs[0];
  return (
    <View>
      <View accessibilityRole="tablist" aria-label={label} style={styles.tabs}>
        {tabs.map((tab) => {
          const selected = tab.key === shown.key;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setView(tab.key)}
              style={[styles.tab, selected && styles.tabChosen]}
            >
              <T size={small ? 'small' : 'sm'} tone={selected ? 'foreground' : 'secondary'} bold>
                {tab.label}
              </T>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.tabPanel}>{shown.panel}</View>
    </View>
  );
}

/** 탭을 든 접이칸 — 웹 `CardTabs` */
export function CardTabs({
  title,
  note,
  label,
  tabs,
  initial,
  footnote,
}: {
  title: string;
  note?: string;
  label: string;
  tabs: readonly Tab[];
  initial: string;
  footnote?: ReactNode;
}) {
  return (
    <Fold title={title} note={note}>
      <Tabs tabs={tabs} initial={initial} label={label} />
      {footnote !== undefined && <View style={styles.footnote}>{footnote}</View>}
    </Fold>
  );
}

/** 근거의 갈래 딱지 — 웹 `FACT_TAG` */
export function FactTag({ children }: { children: string }) {
  return (
    <View style={styles.factTag}>
      <T size="xs" tone="muted">{children}</T>
    </View>
  );
}

/** 위에 가는 선을 두고 서는 각주 */
export function Ruled({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return <View style={[styles.ruled, style]}>{children}</View>;
}

export function ScrollHint() {
  return (
    <T size="xs" tone="muted" style={styles.scrollHint}>
      ← 좌우로 넘겨 전체 보기 →
    </T>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  num: { fontVariant: ['tabular-nums'] },
  strong: { fontFamily: FONT.bold },
  card: { },
  foldCard: { padding: 0 },
  foldHead: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  foldText: { flex: 1, gap: 2 },
  wrapBaseline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10, rowGap: 2 },
  foldIcon: { width: 36, height: 36, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.surfaceSunken },
  foldBody: { borderTopWidth: 1, borderTopColor: COLOR.border, padding: 20 },
  disclosure: { borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: 4 },
  disclosureHead: { minHeight: CONTROL, flexDirection: 'row', alignItems: 'center', gap: 12 },
  disclosureBody: { paddingTop: 8, paddingBottom: 8 },
  tabs: { flexDirection: 'row', borderRadius: RADIUS.pill, backgroundColor: COLOR.surfaceSunken, padding: 4 },
  tab: { flex: 1, minHeight: CONTROL, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, paddingHorizontal: 2 },
  tabChosen: { backgroundColor: COLOR.surface },
  tabPanel: { paddingTop: 20 },
  footnote: { marginTop: 20, borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: 16 },
  factTag: { borderWidth: 1, borderColor: COLOR.border, borderRadius: RADIUS.cell, paddingHorizontal: 6, paddingVertical: 2 },
  ruled: { borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: 12, marginTop: 12 },
  scrollHint: { marginTop: 8, textAlign: 'right' },
});

export const shared = StyleSheet.create({
  wrapBaseline: styles.wrapBaseline,
  row: { flexDirection: 'row', alignItems: 'center' },
});
