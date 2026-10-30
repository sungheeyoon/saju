import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calculateChart } from '@input/chart';
import { HOUR_UNKNOWN_LABEL, type Query } from '@input/query';
import { BRANCH_INFO, ELEMENT_KO, ELEMENT_PICTURE_KO, ELEMENTS, STEM_INFO, TEN_GOD_KO, type Element, type TenGod } from '@saju';

import { Panel } from '@/ui/parts';
import { COLOR, FONT, ELEMENT_TONE, RADIUS, TYPE } from '@/ui/tokens';

/** 전통 표기 순서 — 시주가 왼쪽, 년주가 오른쪽이다. 시기는 웹의 `PALACE` 와 같다 */
const COLUMNS = [
  { key: 'hour', label: '시주', period: '말년' },
  { key: 'day', label: '일주', period: '중년' },
  { key: 'month', label: '월주', period: '청년' },
  { key: 'year', label: '년주', period: '초년' },
] as const;

/** 사주 결과 — 이름 · 오행 분포 · 여덟 글자까지. 나머지 절은 아직 없다 */
export default function ChartScreen() {
  const params = useLocalSearchParams<{ query: string }>();
  const query = JSON.parse(params.query) as Query;
  const result = calculateChart(query);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹ 뒤로</Text>
        </Pressable>

        {!result.ok ? (
          <Text style={styles.failure}>{result.message}</Text>
        ) : (
          <>
            <Panel tone="cream">
              {query.name !== '' && <Text style={styles.name}>{query.name}</Text>}
              <Text style={styles.summary}>
                {query.date} {query.hourKnown === false ? HOUR_UNKNOWN_LABEL : query.time} · {query.city}
              </Text>
              <Text style={styles.subhead}>오행 분포</Text>
              <View style={styles.elements}>
                {ELEMENTS.map((element) => {
                  const count = result.saju.analysis.elements.counts[element];
                  return (
                    <View key={element} style={styles.element}>
                      <Text style={[styles.elementName, { color: count === 0 ? COLOR.muted : ELEMENT_TONE[element].ink }]}>
                        {ELEMENT_PICTURE_KO[element]}
                      </Text>
                      <Text style={[styles.elementCount, { color: count === 0 ? COLOR.muted : ELEMENT_TONE[element].ink }]}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </Panel>

            <Panel style={styles.card}>
              <Text style={styles.section}>사주팔자</Text>
              <View style={styles.table}>
                {COLUMNS.map(({ key, label, period }) => {
                  const pillar = result.saju.pillars[key];
                  const tenGods = result.saju.analysis.tenGods[key];
                  return (
                    <View key={key} style={styles.column}>
                      <Text style={styles.period}>{period}</Text>
                      <Text style={[styles.columnLabel, key === 'day' && styles.columnLabelDay]}>{label}</Text>
                      <View style={[styles.stack, key === 'day' && styles.stackDay]}>
                        <Glyph
                          glyph={pillar?.stem ?? null}
                          element={pillar ? STEM_INFO[pillar.stem].element : null}
                          ko={pillar ? STEM_INFO[pillar.stem].ko : null}
                          tenGod={tenGods?.stem ?? null}
                          isMe={key === 'day'}
                        />
                        <Glyph
                          glyph={pillar?.branch ?? null}
                          element={pillar ? BRANCH_INFO[pillar.branch].element : null}
                          ko={pillar ? BRANCH_INFO[pillar.branch].ko : null}
                          tenGod={tenGods?.branch ?? null}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </Panel>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Glyph({
  glyph,
  element,
  ko,
  tenGod,
  isMe = false,
}: {
  glyph: string | null;
  element: Element | null;
  ko: string | null;
  tenGod: TenGod | null;
  isMe?: boolean;
}) {
  const ink = element === null ? COLOR.none : ELEMENT_TONE[element].ink;
  const soft = element === null ? COLOR.noneSoft : ELEMENT_TONE[element].soft;
  return (
    <View style={[styles.glyphBox, { backgroundColor: soft }, glyph === null && styles.glyphUnknown]}>
      {isMe ? (
        <Text style={styles.me}>나</Text>
      ) : (
        <Text style={[styles.tenGod, { color: ink }]}>{tenGod ? TEN_GOD_KO[tenGod] : glyph === null ? '—' : ''}</Text>
      )}
      <Text style={[styles.glyph, { color: ink }]}>{glyph ?? '?'}</Text>
      <Text style={[styles.caption, { color: ink }]}>
        {element === null || ko === null ? HOUR_UNKNOWN_LABEL : `${ko}·${ELEMENT_KO[element]}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { padding: 16, gap: 12 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: 16 },
  backText: { fontSize: TYPE.field, fontFamily: FONT.bold, color: COLOR.foreground },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.danger },
  name: { fontSize: TYPE.title, fontFamily: FONT.bold, color: COLOR.foreground },
  summary: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary, marginTop: 6 },
  subhead: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.secondary, marginTop: 20 },
  elements: { flexDirection: 'row', marginTop: 12 },
  element: { flex: 1, alignItems: 'center', gap: 4 },
  elementName: { fontFamily: FONT.medium, fontSize: TYPE.small },
  elementCount: { fontSize: 24, fontFamily: FONT.bold },
  card: { borderWidth: 1, borderColor: COLOR.border },
  section: { fontSize: TYPE.heading, fontFamily: FONT.bold, color: COLOR.foreground },
  table: { flexDirection: 'row', gap: 6, marginTop: 16 },
  column: { flex: 1, alignItems: 'stretch' },
  period: { textAlign: 'center', fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.secondary },
  columnLabel: { textAlign: 'center', fontSize: 14, fontFamily: FONT.bold, color: COLOR.secondary, marginTop: 2, marginBottom: 8 },
  columnLabelDay: { color: COLOR.foreground },
  stack: { gap: 6, padding: 3, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  stackDay: { borderColor: COLOR.foreground, backgroundColor: 'rgba(38, 36, 31, 0.06)' },
  glyphBox: { minHeight: 136, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 2 },
  glyphUnknown: { borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(95, 100, 93, 0.3)' },
  me: { fontSize: TYPE.fine, fontFamily: FONT.bold, lineHeight: 20, color: COLOR.background, backgroundColor: COLOR.foreground, borderRadius: RADIUS.pill, paddingHorizontal: 8, overflow: 'hidden' },
  tenGod: { fontSize: TYPE.fine, fontFamily: FONT.bold, lineHeight: 20, minHeight: 20 },
  glyph: { fontSize: TYPE.figure, fontWeight: '700', lineHeight: 46 },
  caption: { fontSize: TYPE.fine, fontFamily: FONT.bold, textAlign: 'center' },
});
