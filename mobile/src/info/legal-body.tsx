import type { LegalBlock, LegalDocument, LegalSection, LegalTable } from '@brand/legal-text';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { Card } from '@/ui/surfaces';

import { Clause, Dot, InfoLine } from './frame';

/** 이용약관 · 환불정책의 몸 — 웹의 `app/legal-body.tsx`: 장이 있으면 장마다 판 한 장에 조는 작은 제목, 없으면 절마다 판 한 장 */
export function LegalBody({ document }: { document: LegalDocument }) {
  return document.parts.map((part, index) =>
    part.title === null ? (
      part.sections.map((section) => (
        <Clause key={section.title} title={section.title}>
          <Blocks blocks={section.blocks} />
        </Clause>
      ))
    ) : (
      <Card key={part.title || index} style={styles.part}>
        <Text style={styles.partTitle}>{part.title}</Text>
        {part.sections.map((section) => (
          <SubClause key={section.title || 'body'} section={section} />
        ))}
      </Card>
    ),
  );
}

function SubClause({ section }: { section: LegalSection }) {
  return (
    <View style={styles.subClause}>
      {section.title ? <Text style={styles.subTitle}>{section.title}</Text> : null}
      <Blocks blocks={section.blocks} />
    </View>
  );
}

function Blocks({ blocks }: { blocks: readonly LegalBlock[] }) {
  return blocks.map((block, index) => {
    switch (block.kind) {
      case 'para':
        return <InfoLine key={index}>{block.text}</InfoLine>;
      case 'bullets':
        return <Bullets key={index} items={block.items} />;
      case 'table':
        return <Table key={index} table={block.table} />;
      case 'numbered':
        return (
          <View key={index} style={styles.list}>
            {block.items.map((item, at) => (
              <View key={item.text} style={styles.numberedRow}>
                <Text style={styles.marker}>{at + 1}.</Text>
                <View style={styles.numberedBody}>
                  <InfoLine>{item.text}</InfoLine>
                  {item.bullets ? <Bullets items={item.bullets} /> : null}
                  {item.table ? <Table table={item.table} /> : null}
                  {item.after ? <InfoLine>{item.after}</InfoLine> : null}
                </View>
              </View>
            ))}
          </View>
        );
    }
  });
}

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <Dot key={item}>{item}</Dot>
      ))}
    </View>
  );
}

const CELL_CHAR = 13;
const CELL_PADDING = 12;
/** 첫 칸은 감아 내리고, 나머지는 웹의 `whitespace-nowrap` 처럼 긴 값 그대로의 폭이다 */
const FIRST_COLUMN_CHARS = 14;

/** 표 — 폰에서 넘치면 표만 옆으로 민다 */
function Table({ table }: { table: LegalTable }) {
  const widths = table.head.map((head, column) => {
    const longest = Math.max(head.length, ...table.rows.map((row) => row[column]?.length ?? 0));
    return (column === 0 ? Math.min(longest, FIRST_COLUMN_CHARS) : longest) * CELL_CHAR + CELL_PADDING;
  });
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={[styles.tableRow, styles.tableHead]}>
          {table.head.map((cell, column) => (
            <Text key={cell} style={[styles.headCell, { width: widths[column] }]}>
              {cell}
            </Text>
          ))}
        </View>
        {table.rows.map((row) => (
          <View key={row.join('|')} style={styles.tableRow}>
            {row.map((cell, column) => (
              <Text key={column} style={[styles.cell, { width: widths[column] }]}>
                {cell}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  part: { gap: 20 },
  partTitle: { fontFamily: FONT.bold, fontSize: TYPE.lead, lineHeight: 24, color: COLOR.foreground },
  subClause: { gap: 8 },
  subTitle: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
  list: { gap: 8 },
  numberedRow: { flexDirection: 'row', gap: 6 },
  marker: { width: 20, fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 26, color: COLOR.muted, textAlign: 'right' },
  numberedBody: { flex: 1, gap: 8 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLOR.border },
  tableHead: { borderBottomColor: COLOR.borderStrong },
  headCell: { paddingVertical: 8, paddingRight: CELL_PADDING, fontFamily: FONT.bold, fontSize: TYPE.small, lineHeight: 20, color: COLOR.foreground },
  cell: { paddingVertical: 8, paddingRight: CELL_PADDING, fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
});
