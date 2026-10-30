import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calculateChart } from '@input/chart';
import { HOUR_UNKNOWN_LABEL, type Query } from '@input/query';
import { ELEMENT_PICTURE_KO, ELEMENTS } from '@saju';
import { TOPIC_TABLE_FOOTNOTE, asOf, said, sajuViewModelOf } from '@saju-view';

import { TimeCorrections, Warnings } from '@/chart/corrections';
import { ElementChart } from '@/chart/elements';
import { FortuneTabs, NowOverlaps } from '@/chart/fortune';
import { PillarChart } from '@/chart/pillars';
import { RelationTable } from '@/chart/relations';
import { StarTable } from '@/chart/stars';
import { StrengthMeter } from '@/chart/strength';
import { YongsinCard } from '@/chart/yongsin';
import { SaveSelfCard } from '@/reading/save-self';
import { ElementSymbol } from '@/ui/element-symbol';
import { Panel } from '@/ui/parts';
import { COLOR, ELEMENT_TONE, FONT, TYPE } from '@/ui/tokens';

/** 사주 결과 — 절의 차례는 웹의 `app/saju/view.tsx` 와 같다. 값은 웹과 같은 `sajuViewModelOf` 다 */
export default function ChartScreen() {
  const params = useLocalSearchParams<{ query: string }>();
  const query = useMemo(() => JSON.parse(params.query) as Query, [params.query]);
  /* 기준 시각은 화면을 연 때 하나다 — 표의 「현재」와 옆에 적은 시각이 갈리지 않는다 */
  const [viewedAt] = useState(() => Date.now());
  const result = useMemo(() => calculateChart(query), [query]);
  const model = useMemo(() => (result.ok ? sajuViewModelOf(result.saju, viewedAt) : null), [result, viewedAt]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹ 뒤로</Text>
        </Pressable>

        {!result.ok || model === null ? (
          <Text style={styles.failure}>{result.ok ? '' : result.message}</Text>
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
                  const count = model.saju.analysis.elements.counts[element];
                  const color = count === 0 ? COLOR.muted : ELEMENT_TONE[element].ink;
                  return (
                    <View key={element} style={styles.element}>
                      <ElementSymbol element={element} size={28} />
                      <Text style={[styles.elementName, { color }]}>{ELEMENT_PICTURE_KO[element]}</Text>
                      <Text style={[styles.elementCount, { color }]}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </Panel>

            <SaveSelfCard query={query} />

            <PillarChart saju={model.saju} />
            <StarTable saju={model.saju} />
            <ElementChart saju={model.saju} />
            <StrengthMeter saju={model.saju} />
            <YongsinCard saju={model.saju} />
            <RelationTable saju={model.saju} coverage={said(model.utterances, (topic) => topic === TOPIC_TABLE_FOOTNOTE)} />
            <NowOverlaps now={model.now} />
            <FortuneTabs saju={model.saju} now={model.now} asOf={asOf(model.now)} />
            <TimeCorrections saju={model.saju} />
            <Warnings saju={model.saju} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
});
