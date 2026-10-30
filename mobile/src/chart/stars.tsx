import { StyleSheet, View } from 'react-native';

import type { Saju } from '@saju';
import { HIT_POSITION_KO, PILLAR_COLUMNS, missingSpiritNotes, starNamesByNature, starsAt } from '@saju-view';
import { STAR_BASIS_NOTE, STAR_NATURE_NOTE } from '@saju-view/notes';

import { COLOR, RADIUS } from '@/ui/tokens';

import { Disclosure, Fold, Rich, T } from './parts';

/** 신살 — 어느 자리에 걸렸는지가 본론이라 기둥별 카드로 세로로 놓는다(웹 `stars.tsx`) */
export function StarTable({ saju }: { saju: Saju }) {
  const { stars } = saju.sinsal;
  const missingSpirits = missingSpiritNotes(saju);

  return (
    <Fold title="신살" meta={stars.length > 0 ? `${stars.length}개` : undefined} note="어떤 신살이 어느 자리에 걸렸는지 모아봅니다">
      {stars.length === 0 ? (
        <View style={styles.empty}>
          <T tone="secondary" style={styles.center}>걸린 신살이 없습니다</T>
        </View>
      ) : (
        <View style={styles.columns}>
          {PILLAR_COLUMNS.map(({ key, label }) => {
            const found = starsAt(saju, key);
            return (
              <View key={key} accessibilityLabel={`${label}에 걸린 신살`} style={[styles.column, key === 'day' && styles.columnDay]}>
                <View style={styles.columnHead}>
                  <T bold>{label}</T>
                  <T size="xs" tone="secondary">{found.length}개</T>
                </View>
                {found.length === 0 ? (
                  <T size="small" tone="secondary" style={styles.none}>걸린 항목 없음</T>
                ) : (
                  <View style={styles.hits}>
                    {found.map(({ star, hit }) => (
                      <View key={`${star.id}:${hit.target}:${hit.char}`} style={styles.hit}>
                        <T bold>{star.ko}</T>
                        <T size="xs" tone="secondary">
                          {HIT_POSITION_KO[hit.position][hit.target]} <T size="xs" tone="secondary" glyph>{hit.char}</T>
                          {star.basis && (
                            <>
                              {' · '}{star.basis.label} <T size="xs" tone="secondary" glyph>{star.basis.char}</T>
                            </>
                          )}
                        </T>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {!saju.meta.hourKnown && (
        <T size="xs" tone="muted" style={styles.hourNote}>시주를 몰라 시주에 걸린 신살은 빠져 있습니다.</T>
      )}

      <Disclosure title="전통 분류와 산출 기준" style={styles.disclosure}>
        <View style={styles.natures}>
          {starNamesByNature(saju).map(({ nature, ko, named }) => (
            <View key={nature} style={styles.nature}>
              <T size="xs" tone="muted">{ko}</T>
              <T size="xs" tone="secondary" style={styles.flex}>{named}</T>
            </View>
          ))}
        </View>
        <T size="xs" tone="secondary" style={styles.para}>{STAR_NATURE_NOTE}</T>
        {missingSpirits.length > 0 && (
          <View style={styles.missing}>
            {missingSpirits.map((note) => (
              <T key={note} size="xs" tone="secondary">{note}</T>
            ))}
          </View>
        )}
        <Rich parts={STAR_BASIS_NOTE} tone="secondary" />
      </Disclosure>
    </Fold>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  empty: { borderRadius: RADIUS.panel, backgroundColor: COLOR.surfaceSoft, paddingHorizontal: 16, paddingVertical: 20 },
  columns: { gap: 8 },
  column: { borderRadius: RADIUS.panel, borderWidth: 1, borderColor: 'transparent', backgroundColor: COLOR.surfaceSoft, padding: 12 },
  columnDay: { borderColor: COLOR.borderStrong, backgroundColor: COLOR.cream },
  columnHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  none: { paddingVertical: 12, textAlign: 'center' },
  hits: { gap: 6 },
  hit: { borderRadius: RADIUS.control, backgroundColor: COLOR.surfaceRaised, paddingHorizontal: 12, paddingVertical: 8 },
  hourNote: { marginTop: 12 },
  disclosure: { marginTop: 16 },
  natures: { gap: 4, borderRadius: RADIUS.control, backgroundColor: COLOR.surfaceSoft, padding: 12, marginBottom: 12 },
  nature: { flexDirection: 'row', gap: 8 },
  para: { marginBottom: 12 },
  missing: { gap: 2, borderRadius: RADIUS.control, backgroundColor: COLOR.surfaceSoft, padding: 12, marginBottom: 12 },
});
