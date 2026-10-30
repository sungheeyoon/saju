import { Pressable, StyleSheet, View } from 'react-native';

import { COLOR } from './tokens';

/**
 * 스위치 한 벌 — 웹 `app/ui/switch.tsx` 와 같다: 누르면 곧 켜지고 꺼지며, 색만으로 말하지 않게 손잡이의 자리가 함께 바뀐다.
 * 판은 32px 이고 누를 자리는 44px 다. 보내는 동안은 누름을 받지 않는다.
 */
export function Switch({ checked, onChange, busy = false, label }: { checked: boolean; onChange: (next: boolean) => void; busy?: boolean; label?: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked, busy, disabled: busy }}
      hitSlop={6}
      onPress={() => {
        if (!busy) onChange(!checked);
      }}
      style={[styles.track, checked && styles.on]}
    >
      <View style={[styles.thumb, checked && styles.thumbOn, busy && styles.busy]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 52, height: 32, padding: 2, borderRadius: 16, justifyContent: 'center', backgroundColor: COLOR.borderStrong },
  on: { backgroundColor: COLOR.accent },
  thumb: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLOR.surface },
  thumbOn: { transform: [{ translateX: 20 }], backgroundColor: COLOR.onAccent },
  busy: { opacity: 0.6 },
});
