import { READING_LEAVE_SAFE_NOTE, READING_OUTLINE_STATE } from '@reading/notes';
import type { OutlineRow } from '@reading/outline';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Paper, Tile } from '@/ui/surfaces';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';

/**
 * 기다리는 칸 — 줄마다 서버가 적은 진행 그대로다(ADR 0127). 시간으로 단계를 짓지 않고, 흐르는 띠는 차오르지 않는다.
 */
export function LoadingState({ rows, waitNote }: { rows: readonly OutlineRow[]; waitNote: string }) {
  return (
    <Paper style={styles.panel}>
      <View accessibilityRole="progressbar" accessibilityLiveRegion="polite">
        <Text style={styles.title}>사주의 흐름을 이어 읽고 있어요</Text>
        <Text style={styles.note}>근거를 확인하고, 단정하지 않는 문장으로 옮기고 있어요.</Text>
      </View>
      <Text style={styles.note}>
        {waitNote} {READING_LEAVE_SAFE_NOTE}
      </Text>
      <FlowBand />
      <View accessibilityLabel="풀이 목차" style={styles.rows}>
        {rows.map((row, at) => (
          <Tile tone={COLOR.surface} key={`${at}-${row.label}`} style={styles.row}>
            <Text style={[styles.rowLabel, row.state === 'waiting' && styles.rowWaiting]}>{row.label}</Text>
            <Mark state={row.state} />
          </Tile>
        ))}
      </View>
    </Paper>
  );
}

function Mark({ state }: { state: OutlineRow['state'] }) {
  switch (state) {
    case 'done':
      return <Text style={styles.done}>{READING_OUTLINE_STATE.done}</Text>;
    case 'writing':
    case 'reviewing':
      return <Text style={styles.writing}>{READING_OUTLINE_STATE[state]}</Text>;
    case 'waiting':
      return <Text style={styles.waiting}>{READING_OUTLINE_STATE.waiting}</Text>;
  }
}

/** 끝을 모른다는 띠 — 길이가 늘지 않고 흐르기만 한다(`app/me/reading/flow.module.css`) */
export function FlowBand() {
  const [at] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(at, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [at]);

  return (
    <View aria-hidden style={styles.band}>
      <Animated.View style={[styles.bandFlow, { left: at.interpolate({ inputRange: [0, 1], outputRange: ['-40%', '100%'] }) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12, padding: 20 },
  title: { fontFamily: FONT.bold, fontSize: TYPE.lead, color: COLOR.foreground },
  note: { marginTop: 2, fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.creamInk },
  band: { height: 8, borderRadius: RADIUS.pill, backgroundColor: COLOR.track, overflow: 'hidden' },
  bandFlow: { position: 'absolute', top: 0, bottom: 0, width: '40%', borderRadius: RADIUS.pill, backgroundColor: COLOR.creamInk },
  rows: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowLabel: { flex: 1, fontFamily: FONT.medium, fontSize: TYPE.note, color: COLOR.foreground },
  rowWaiting: { color: COLOR.secondary },
  done: { paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden', borderRadius: RADIUS.pill, backgroundColor: ELEMENT_TONE.木.soft, fontFamily: FONT.bold, fontSize: TYPE.fine, color: ELEMENT_TONE.木.ink },
  writing: { fontFamily: FONT.bold, fontSize: TYPE.fine, color: ELEMENT_TONE.火.ink },
  waiting: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.muted },
});
