import { StyleSheet, View } from 'react-native';

import type { Saju } from '@saju';
import { STRENGTH_THRESHOLD, emergencesLine, rootsLine } from '@saju-view';
import { ROOTING_NOTE, STRENGTH_OVERLAP_NOTE } from '@saju-view/notes';

import { COLOR, RADIUS } from '@/ui/tokens';

import { Disclosure, FactTag, Fold, T, shared } from './parts';

/** 신강 · 신약 — 보조세력 비율과 득령 · 득지 · 득세 판정(웹 `strength-meter.tsx`) */
export function StrengthMeter({ saju }: { saju: Saju }) {
  const { strength } = saju.analysis;
  const percent = strength.ratio * 100;
  const verdict = strength.verdict === 'strong' ? '신강' : '신약';

  return (
    <Fold title="신강 · 신약" meta={verdict} note="보조세력과 득령·득지·득세를 함께 봅니다">
      <View style={styles.summary}>
        <T size="xs" tone="muted">현재 판정</T>
        <View style={[shared.wrapBaseline, styles.verdict]}>
          <T size="big" bold>{verdict}</T>
          <T tone="secondary">세 기준 중 {strength.metCount}개 충족</T>
        </View>
        <View style={[shared.wrapBaseline, styles.ratio]}>
          <T size="big" bold num>{percent.toFixed(1)}</T>
          <T>%</T>
          <T size="xs" tone="muted">보조세력</T>
        </View>
      </View>

      <View style={styles.meter}>
        <View accessibilityRole="image" accessibilityLabel={`보조세력 ${percent.toFixed(1)}%, 신강 기준 ${STRENGTH_THRESHOLD}%`} style={styles.track}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
          <View aria-hidden style={[styles.mark, { left: `${STRENGTH_THRESHOLD}%` }]} />
        </View>
        <View style={styles.scale}>
          <T size="xs" tone="muted">소모 우세</T>
          <T size="xs" tone="muted">신강 기준 {STRENGTH_THRESHOLD}%</T>
          <T size="xs" tone="muted">보조 우세</T>
        </View>
      </View>

      <View style={styles.scores}>
        <View style={styles.score}>
          <T size="xs" tone="muted">일간을 돕는 힘</T>
          <T size="lg" bold num>{strength.supportScore.toFixed(2)}</T>
          <T size="xs" tone="secondary">비겁·인성</T>
        </View>
        <View style={styles.score}>
          <T size="xs" tone="muted">일간을 소모하는 힘</T>
          <T size="lg" bold num>{strength.opposeScore.toFixed(2)}</T>
          <T size="xs" tone="secondary">식상·재성·관성</T>
        </View>
      </View>

      <View style={styles.basis}>
        <T bold>판정 근거</T>
        <T size="xs" tone="muted">득령 · 득지 · 득세</T>
      </View>
      <View style={styles.criteria}>
        {strength.criteria.map((criterion) => (
          <View key={criterion.key} style={[styles.criterion, criterion.met && styles.criterionMet]}>
            <View style={styles.criterionHead}>
              <T bold>{criterion.label}</T>
              <View style={[styles.pill, criterion.met && styles.pillMet]}>
                <T size="xs" tone="muted" color={criterion.met ? COLOR.background : undefined}>{criterion.met ? '충족' : '미충족'}</T>
              </View>
            </View>
            <T size="xs" tone="secondary" style={styles.detail}>{criterion.detail}</T>
          </View>
        ))}
      </View>

      <T size="xs" tone="muted" style={styles.overlap}>{STRENGTH_OVERLAP_NOTE}</T>

      <RootingNote saju={saju} />
    </Fold>
  );
}

/** 통근 · 투출 — 판정이 아니라 그 재료다 */
function RootingNote({ saju }: { saju: Saju }) {
  const { dayMaster, emergences } = saju.analysis.rootedness;
  return (
    <Disclosure title="뿌리와 투출 자세히 보기" style={styles.rooting}>
      <View style={shared.wrapBaseline}>
        <FactTag>사실</FactTag>
        <T size="xs" tone="muted">일간 {dayMaster.stem}의 뿌리</T>
        {dayMaster.rooted ? (
          <>
            <T tone="secondary">{rootsLine(saju)}</T>
            <T bold num>합 {dayMaster.totalDays}일</T>
          </>
        ) : (
          <T bold>없음 — 지지 어디에도 통근하지 않았습니다</T>
        )}
      </View>
      {emergences.length > 0 && (
        <T size="xs" tone="secondary" style={styles.emergences}>투출 {emergencesLine(saju)}</T>
      )}
      <T size="xs" tone="muted" style={styles.rootingNote}>{ROOTING_NOTE}</T>
    </Disclosure>
  );
}

const styles = StyleSheet.create({
  summary: { borderRadius: RADIUS.control, backgroundColor: COLOR.surfaceSoft, padding: 16 },
  verdict: { marginTop: 4 },
  ratio: { marginTop: 16, columnGap: 4 },
  meter: { marginTop: 20 },
  track: { height: 12, borderRadius: RADIUS.pill, backgroundColor: COLOR.track },
  fill: { height: '100%', borderRadius: RADIUS.pill, backgroundColor: 'rgba(38, 36, 31, 0.55)' },
  mark: { position: 'absolute', top: -4, bottom: -4, width: 2, backgroundColor: 'rgba(38, 36, 31, 0.45)' },
  scale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  scores: { flexDirection: 'row', gap: 8, marginTop: 16 },
  score: { flex: 1, borderRadius: RADIUS.control, borderWidth: 1, borderColor: COLOR.border, paddingHorizontal: 12, paddingVertical: 10 },
  basis: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 20, borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: 16 },
  criteria: { gap: 8, marginTop: 8 },
  criterion: { borderRadius: RADIUS.control, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surfaceSoft, padding: 12 },
  criterionMet: { borderColor: COLOR.borderStrong, backgroundColor: COLOR.surfaceSunken },
  criterionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pill: { borderRadius: RADIUS.pill, backgroundColor: COLOR.surfaceSunken, paddingHorizontal: 8, paddingVertical: 2 },
  pillMet: { backgroundColor: 'rgba(38, 36, 31, 0.85)' },
  detail: { marginTop: 6 },
  overlap: { marginTop: 8 },
  rooting: { marginTop: 16 },
  emergences: { marginTop: 6 },
  rootingNote: { marginTop: 8 },
});
