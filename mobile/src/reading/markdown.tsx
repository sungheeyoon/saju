import { chipsOf, CHIP_LABELS, inlineParts, markdownBlocks, type MarkdownBlock } from '@reading/markdown-blocks';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

/**
 * 풀이 원문을 그린다 — 덩이를 나누는 규칙은 웹과 같은 `markdownBlocks` 다. HTML 로 해석하지 않고 문법에 없는 것은 글자 그대로 선다.
 */
function inline(text: string): ReactNode[] {
  return inlineParts(text).map((part, at) =>
    part.kind === 'text' ? (
      part.text
    ) : (
      <Text key={at} style={part.kind === 'strong' ? styles.strong : styles.code}>
        {part.text}
      </Text>
    ),
  );
}

function Block({ block, first }: { block: Exclude<MarkdownBlock, { kind: 'point' }>; first: boolean }) {
  switch (block.kind) {
    case 'rule':
      return <View style={styles.rule} />;
    case 'summary':
      return <Text style={styles.summary}>{inline(block.text)}</Text>;
    case 'labels':
      if (block.rows.length === 1 && CHIP_LABELS.includes(block.rows[0].label)) {
        return (
          <View style={styles.chipGroup}>
            <Text style={styles.chipLabel}>{block.rows[0].label}</Text>
            <View style={styles.chips}>
              {chipsOf(block.rows[0].text).map((chip) => (
                <Text key={chip} style={styles.chip}>
                  {chip}
                </Text>
              ))}
            </View>
          </View>
        );
      }
      return (
        <View style={styles.labels}>
          {block.rows.map((row, at) => (
            <View key={at} style={styles.labelRow}>
              <Text style={styles.labelName}>{row.label}</Text>
              <Text style={styles.labelText}>{inline(row.text)}</Text>
            </View>
          ))}
        </View>
      );
    case 'bullets':
      return (
        <View style={styles.bullets}>
          {block.items.map((item, at) => (
            <View key={at} style={styles.bullet}>
              <Text style={styles.body}>•</Text>
              <Text style={[styles.body, styles.grow]}>{inline(item)}</Text>
            </View>
          ))}
        </View>
      );
    case 'paragraph':
      return <Text style={block.lead ? styles.lead : styles.body}>{inline(block.text)}</Text>;
    case 'heading':
      return block.depth <= 2 ? (
        <View style={[styles.heading, !first && styles.headingGap]}>
          <View style={styles.headingBar} />
          <Text accessibilityRole="header" style={styles.headingText}>
            {inline(block.text)}
          </Text>
        </View>
      ) : (
        <View style={styles.smallHeading}>
          <View style={styles.smallHeadingDot} />
          <Text accessibilityRole="header" style={styles.smallHeadingText}>
            {inline(block.text)}
          </Text>
        </View>
      );
  }
}

export function Markdown({ source }: { source: string }) {
  const blocks = markdownBlocks(source);
  const nodes: ReactNode[] = [];
  let points: Extract<MarkdownBlock, { kind: 'point' }>[] = [];

  const flushPoints = () => {
    if (points.length === 0) return;
    nodes.push(
      <View key={`points-${nodes.length}`} style={styles.points}>
        {points.map((point) => (
          <View key={point.number} style={styles.point}>
            <Text style={styles.pointNumber}>{point.number}</Text>
            <View style={styles.grow}>
              {point.title !== '' && <Text style={styles.pointTitle}>{inline(point.title)}</Text>}
              <Text style={point.title !== '' ? styles.pointText : styles.body}>{inline(point.text)}</Text>
            </View>
          </View>
        ))}
      </View>,
    );
    points = [];
  };

  blocks.forEach((block, at) => {
    if (block.kind === 'point') {
      points.push(block);
      return;
    }
    flushPoints();
    nodes.push(<Block key={`${block.kind}-${at}`} block={block} first={at === 0} />);
  });
  flushPoints();

  return <View style={styles.column}>{nodes}</View>;
}

const styles = StyleSheet.create({
  column: { gap: 24 },
  grow: { flex: 1, minWidth: 0 },
  body: { fontFamily: FONT.medium, fontSize: TYPE.lead, lineHeight: 31, color: COLOR.foreground },
  lead: { fontFamily: FONT.medium, fontSize: TYPE.heading, lineHeight: 35, color: COLOR.foreground },
  strong: { fontFamily: FONT.bold },
  code: { backgroundColor: COLOR.surfaceSunken },
  rule: { height: 1, backgroundColor: COLOR.border, marginVertical: 8 },
  summary: { marginTop: -14, fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 25, color: COLOR.secondary },
  chipGroup: { gap: 8 },
  chipLabel: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: RADIUS.cell,
    fontFamily: FONT.medium,
    fontSize: TYPE.note,
    lineHeight: 24,
    color: COLOR.foreground,
  },
  labels: { gap: 6, padding: 14, borderWidth: 1, borderColor: COLOR.border, borderRadius: RADIUS.cell },
  labelRow: { flexDirection: 'row', gap: 8 },
  labelName: { width: 56, paddingTop: 3, fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.secondary },
  labelText: { flex: 1, fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 26, color: COLOR.foreground },
  bullets: { gap: 10 },
  bullet: { flexDirection: 'row', gap: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headingGap: { marginTop: 16 },
  headingBar: { width: 6, height: 24, borderRadius: RADIUS.pill, backgroundColor: COLOR.borderStrong },
  headingText: { flex: 1, fontFamily: FONT.bold, fontSize: TYPE.heading, lineHeight: 29, color: COLOR.foreground },
  smallHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: -12 },
  smallHeadingDot: { width: 6, height: 6, borderRadius: RADIUS.pill, backgroundColor: COLOR.borderStrong },
  smallHeadingText: { flex: 1, fontFamily: FONT.bold, fontSize: TYPE.lead, color: COLOR.foreground },
  points: { gap: 10 },
  point: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: RADIUS.cell, backgroundColor: COLOR.surface },
  pointNumber: { width: 18, fontFamily: FONT.bold, fontSize: TYPE.lead, lineHeight: 28, color: COLOR.foreground },
  pointTitle: { fontFamily: FONT.bold, fontSize: TYPE.lead, lineHeight: 28, color: COLOR.foreground },
  pointText: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 26, color: COLOR.secondary },
});
