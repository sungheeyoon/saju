import { ScrollView, StyleSheet, View } from 'react-native';

import { CLAIM_STRENGTH_KO, type Saju, type Utterance } from '@saju';
import {
  NOTHING_TO_SAY,
  isRowUtterance,
  relationCells,
  relationKey,
  relationRemarks,
  silentNoteOf,
  spokenOf,
  type SpokenStrength,
} from '@saju-view';
import { RELATIONS_NOTE } from '@saju-view/notes';

import { COLOR, RADIUS } from '@/ui/tokens';

import { Fold, Ruled, ScrollHint, T, shared } from './parts';

/** L3 발화를 놓는다 — 문구를 여기서 쓰지 않고, 강도가 옆 칸으로 선다(웹 `app/utterances.tsx`) */
function UtteranceList({ utterances }: { utterances: readonly Utterance[] }) {
  const spoken = spokenOf(utterances);
  const silentNote = silentNoteOf(utterances);

  if (spoken.length === 0) return <T tone="muted">{silentNote ?? NOTHING_TO_SAY}</T>;

  return (
    <View style={styles.utterances}>
      {spoken.map((utterance, index) => (
        <View key={`${utterance.key}:${index}`} style={shared.wrapBaseline}>
          <View style={styles.strength}>
            <T size="xs" tone="secondary">{CLAIM_STRENGTH_KO[utterance.strength as SpokenStrength]}</T>
          </View>
          <T tone={isRowUtterance(utterance) ? 'foreground' : 'secondary'}>{utterance.text}</T>
        </View>
      ))}
      {silentNote !== null && (
        <Ruled>
          <T size="xs" tone="muted">{silentNote}</T>
        </Ruled>
      )}
    </View>
  );
}

/** 원국의 관계 — 웹과 같은 표를 가로로 넘겨 본다(웹 `relations.tsx`) */
export function RelationTable({ saju, coverage }: { saju: Saju; coverage: readonly Utterance[] }) {
  const { relations } = saju;
  return (
    <Fold title="원국의 관계" meta={relations.length === 0 ? '성립하는 관계가 없습니다' : `${relations.length}개`}>
      {relations.length > 0 && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.row}>
                <T size="xs" tone="secondary" bold style={styles.kind}>종류</T>
                <T size="xs" tone="secondary" bold style={styles.chars}>글자</T>
                <T size="xs" tone="secondary" bold style={styles.name}>이름</T>
                <T size="xs" tone="secondary" bold style={styles.seats}>자리</T>
                <T size="xs" tone="secondary" bold style={styles.remarks}>비고</T>
              </View>
              {relations.map((relation) => {
                const cells = relationCells(relation);
                const remarks = relationRemarks(relation);
                return (
                  <View key={relationKey(relation)} style={[styles.row, styles.rule]}>
                    <T tone="secondary" style={styles.kind}>{cells.kind}</T>
                    <T size="base" glyph style={styles.chars}>{cells.chars}</T>
                    <T style={styles.name}>
                      {relation.ko}
                      {relation.name && <T size="xs" tone="muted"> {relation.name}</T>}
                    </T>
                    <T tone="secondary" style={styles.seats}>{cells.seats}</T>
                    <View style={[styles.remarks, styles.remarkList]}>
                      {remarks.target !== null && <T size="xs" tone="secondary">{remarks.target}</T>}
                      {remarks.arrow !== null && <T size="xs" tone="muted">{remarks.arrow}</T>}
                      {remarks.cycle !== null && (
                        <T size="xs" tone="muted">
                          <T size="xs" tone="muted" glyph>{remarks.cycle}</T> 순환
                        </T>
                      )}
                      {remarks.twoLetters !== null && <T size="xs" tone="muted">{remarks.twoLetters}</T>}
                      {remarks.distance !== null && <T size="xs" tone="muted">{remarks.distance}</T>}
                      {remarks.contested !== null && <T size="xs">{remarks.contested}</T>}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
          <ScrollHint />
        </>
      )}

      {coverage.length > 0 && (
        <Ruled>
          <UtteranceList utterances={coverage} />
        </Ruled>
      )}

      <Ruled>
        <T size="xs" tone="muted">{RELATIONS_NOTE}</T>
      </Ruled>
    </Fold>
  );
}

const styles = StyleSheet.create({
  utterances: { gap: 10 },
  strength: { borderWidth: 1, borderColor: COLOR.border, borderRadius: RADIUS.control, paddingHorizontal: 6, paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 6 },
  rule: { borderTopWidth: 1, borderTopColor: COLOR.border },
  kind: { width: 56 },
  chars: { width: 64 },
  name: { width: 132 },
  seats: { width: 64 },
  remarks: { width: 180 },
  remarkList: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 2 },
});
