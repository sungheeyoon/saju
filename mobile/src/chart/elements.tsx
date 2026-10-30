import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ELEMENTS, ELEMENT_KO, type Saju } from '@saju';
import { blockedLine, boundSeatsLine, boundStemsOf, bureauMoveLine, countShareLine, percentOfRatio, sixCombinationsOf } from '@saju-view';
import { SIX_COMBINATION_NOTE, WEIGHT_SHIFTS_NOTE } from '@saju-view/notes';

import { ElementSymbol } from '@/ui/element-symbol';
import { COLOR, CONTROL, ELEMENT_TONE, RADIUS } from '@/ui/tokens';

import { Card, Chevron, Rich, Ruled, T, shared } from './parts';

/** 무엇이 세력을 옮겼고 무엇은 안 옮겼는가 — 답할 것이 있을 때만 서고 접힌다 */
function WeightShifts({ saju }: { saju: Saju }) {
  const [open, setOpen] = useState(false);
  const { bureaus } = saju.analysis;
  const boundStems = boundStemsOf(saju);
  const sixCombinations = sixCombinationsOf(saju);

  if (bureaus.length === 0 && boundStems.length === 0 && sixCombinations.length === 0) return null;

  return (
    <View style={styles.shifts}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.shiftsHead}>
        <Chevron open={open} size={14} closedDeg={0} />
        <T>세력에 반영한 합과 안 한 합</T>
      </Pressable>
      {open && (
        <View style={styles.shiftsBody}>
          {bureaus.map((bureau) => {
            const moved = bureauMoveLine(saju, bureau.ko);
            return (
              <View key={`${bureau.kind}-${bureau.element}`} style={shared.wrapBaseline}>
                <T>반영</T>
                <T bold>{bureau.ko}</T>
                <T tone="secondary">
                  → <T tone="secondary" glyph>{bureau.element}</T> {ELEMENT_KO[bureau.element]} {percentOfRatio(bureau.pull)} 만큼 기울임
                  {moved !== null && <T tone="muted"> {moved}</T>}
                </T>
              </View>
            );
          })}
          {boundStems.map((transformation) => (
            <View key={`${transformation.ko}-${transformation.verdict}`} style={shared.wrapBaseline}>
              <T tone="muted">안 함</T>
              <T bold>{transformation.ko}</T>
              <T tone="secondary">
                {boundSeatsLine(transformation.seats)} — {blockedLine(transformation.verdict, transformation.blockers)}
              </T>
            </View>
          ))}
          {sixCombinations.length > 0 && (
            <View style={shared.wrapBaseline}>
              <T tone="muted">안 함</T>
              <T bold>{sixCombinations.map((relation) => relation.ko).join(' · ')}</T>
              <T tone="secondary">{SIX_COMBINATION_NOTE}</T>
            </View>
          )}
          <Rich parts={WEIGHT_SHIFTS_NOTE} />
        </View>
      )}
    </View>
  );
}

/** 오행 분포 — 값을 전부 옆에 적어 표를 겸한다(웹 `element-chart.tsx`) */
export function ElementChart({ saju }: { saju: Saju }) {
  const { counts, scores, ratios, missing, strongest, glyphCount } = saju.analysis.elements;
  const max = Math.max(...ELEMENTS.map((element) => ratios[element]), 0.0001);

  return (
    <Card>
      <T size="lead" bold>오행 분포</T>
      <T size="xs" tone="secondary" style={styles.lead}>
        개수는 {glyphCount === 8 ? '여덟' : '여섯'} 글자, 점수는 지장간까지 편 값입니다
        {glyphCount !== 8 && <T size="xs" tone="muted"> · 시주 제외</T>}
      </T>

      <View style={styles.tableHead}>
        <T size="xs" tone="muted" style={styles.colName}>오행</T>
        <T size="xs" tone="muted" style={styles.colCount}>개수</T>
        <T size="xs" tone="muted" style={styles.colScore}>점수</T>
        <T size="xs" tone="muted" style={styles.colBar}>비중</T>
      </View>

      {ELEMENTS.map((element) => (
        <View key={element} style={styles.row}>
          <View style={styles.colName}>
            <View style={[styles.chip, { backgroundColor: ELEMENT_TONE[element].soft }]}>
              <View style={styles.chipIcon}>
                <ElementSymbol element={element} size={20} />
              </View>
              <T size="base" glyph bold color={ELEMENT_TONE[element].ink}>{element}</T>
              <T size="small" bold color={ELEMENT_TONE[element].ink}>{ELEMENT_KO[element]}</T>
            </View>
            {element === strongest && <T size="xs" tone="muted" style={styles.strongest}>최강</T>}
          </View>
          <T num tone={counts[element] === 0 ? 'muted' : 'foreground'} style={styles.colCount}>
            {counts[element]}
            <T size="xs" tone="muted"> {countShareLine(counts[element], glyphCount)}</T>
          </T>
          <T num tone="secondary" size="small" style={styles.colScore}>{scores[element].toFixed(2)}</T>
          <View style={[styles.colBar, styles.barCell]}>
            <View style={styles.track}>
              <View style={[styles.fill, { backgroundColor: ELEMENT_TONE[element].ink, width: `${(ratios[element] / max) * 100}%` }]} />
            </View>
            <T num size="xs" tone="secondary" style={styles.barValue}>{Math.round(ratios[element] * 100)}%</T>
          </View>
        </View>
      ))}

      <WeightShifts saju={saju} />

      {missing.length > 0 && (
        <Ruled>
          <T size="xs" tone="secondary">
            여덟 글자에 없는 오행 {missing.map((element) => ELEMENT_KO[element]).join(', ')}
            <T size="xs" tone="muted"> (지장간에는 있을 수 있습니다 — 점수 칸을 보세요)</T>
            {glyphCount !== 8 && <T size="xs" tone="muted"> · 시주에 있었을지는 알 수 없습니다</T>}
          </T>
        </Ruled>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: 4, marginBottom: 16 },
  tableHead: { flexDirection: 'row', gap: 6, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5 },
  colName: { width: 98 },
  colCount: { width: 58, textAlign: 'right' },
  colScore: { width: 30, textAlign: 'right' },
  colBar: { flex: 1, minWidth: 0 },
  barCell: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: RADIUS.pill, paddingVertical: 3, paddingLeft: 3, paddingRight: 9 },
  chipIcon: { width: 28, height: 28, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.surface },
  strongest: { marginTop: 2, marginLeft: 6 },
  track: { flex: 1, minWidth: 0, height: 10, borderRadius: RADIUS.pill, backgroundColor: COLOR.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.pill },
  barValue: { width: 28, textAlign: 'right' },
  shifts: { marginTop: 16, borderTopWidth: 1, borderTopColor: COLOR.border },
  shiftsHead: { minHeight: CONTROL, flexDirection: 'row', alignItems: 'center', gap: 6 },
  shiftsBody: { gap: 6 },
});
