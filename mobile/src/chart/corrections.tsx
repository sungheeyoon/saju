import { StyleSheet, View } from 'react-native';

import { TIME_BASIS } from '@input/query';
import type { Saju } from '@saju';
import { appliedBasisOf, clockLine, signedMinutes } from '@saju-view';
import { HOUR_UNKNOWN_CORRECTION_NOTE } from '@saju-view/notes';

import { COLOR } from '@/ui/tokens';

import { Card, Fold, T } from './parts';

/** 적용된 보정 — 폰에서는 세 칸을 가로로 못 두어 줄마다 값 아래에 설명이 선다(웹 `corrections.tsx`) */
export function TimeCorrections({ saju }: { saju: Saju }) {
  const { meta, pillars } = saju;
  const civil = pillars.meta.civilTime;

  return (
    <Fold
      title={
        <>
          적용된 보정 <T size="lead" bold tone="secondary">{TIME_BASIS[appliedBasisOf(saju)].label}</T>
        </>
      }
    >
      {meta.inputTime.hour === null ? (
        <T tone="secondary" style={styles.lead}>{HOUR_UNKNOWN_CORRECTION_NOTE}</T>
      ) : (
        <T style={styles.lead}>
          <T num>{clockLine(meta.inputTime.hour, meta.inputTime.minute)}</T>
          <T tone="muted"> → </T>
          <T bold num>{clockLine(civil.hour, civil.minute)}</T>
          <T tone="secondary">  총 {signedMinutes(meta.totalCorrectionMinutes)}</T>
        </T>
      )}

      {meta.corrections.map((correction) => (
        <View key={correction.kind} style={styles.row}>
          <View style={styles.rowHead}>
            <T style={styles.label}>{correction.label}</T>
            {correction.minutes === 0 ? <T tone="muted">—</T> : <T num>{signedMinutes(correction.minutes)}</T>}
          </View>
          <T tone="secondary">{correction.detail}</T>
        </View>
      ))}
    </Fold>
  );
}

export function Warnings({ saju }: { saju: Saju }) {
  if (saju.meta.warnings.length === 0) return null;
  return (
    <Card style={styles.warning}>
      <T size="lead" bold>경계 주의</T>
      <View style={styles.warnings}>
        {saju.meta.warnings.map((warning) => (
          <View key={warning} style={styles.warningRow}>
            <T tone="secondary">•</T>
            <T tone="secondary" style={styles.flex}>{warning}</T>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lead: { marginBottom: 12 },
  row: { borderTopWidth: 1, borderTopColor: COLOR.border, paddingVertical: 6, gap: 2 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { flex: 1 },
  warning: { borderColor: COLOR.warningBorder, backgroundColor: COLOR.warningWash },
  warnings: { marginTop: 8, gap: 6 },
  warningRow: { flexDirection: 'row', gap: 6 },
});
