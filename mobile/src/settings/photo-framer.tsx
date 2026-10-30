import { Image } from 'expo-image';
import { useRef } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { draggedFocus, type PhotoFocus } from '@profile';

import { ConfirmDialog } from '@/ui/confirm-dialog';
import { COLOR } from '@/ui/tokens';

export const PHOTO_FRAME_TITLE = '위치 조정';

/** `contentPosition` 은 웹의 `object-position` 과 같은 뜻이다 — 같은 두 수가 같은 쪽을 보인다 */
export const contentPositionOf = (focus: PhotoFocus) => ({ left: `${focus.x}%`, top: `${focus.y}%` }) as const;

/**
 * 사진의 보일 자리를 맞추는 창(G-98) — 웹 `photo-framer.tsx`. 실제로 보일 틀 둘(4:5 칸 · 둥근 얼굴)에 담고, 어느 틀에서 끌어도 둘이 같이
 * 움직인다. 확대는 없고 바이트도 안 바뀐다 — 「저장」은 두 수만 낸다.
 */
export function PhotoFramer({
  source,
  focus,
  onFocus,
  onSave,
  onCancel,
  onDismissed,
}: {
  source: string | null;
  focus: PhotoFocus;
  onFocus: (focus: PhotoFocus) => void;
  onSave: () => void;
  onCancel: () => void;
  onDismissed?: () => void;
}) {
  return (
    <ConfirmDialog open={source !== null} onClose={onCancel} onDismissed={onDismissed} title={PHOTO_FRAME_TITLE} confirmLabel="저장" onConfirm={onSave}>
      {source !== null && (
        <View style={styles.frames}>
          <FocusFrame source={source} focus={focus} onFocus={onFocus} style={styles.big} />
          <FocusFrame source={source} focus={focus} onFocus={onFocus} style={styles.round} />
        </View>
      )}
    </ConfirmDialog>
  );
}

function FocusFrame({ source, focus, onFocus, style }: { source: string; focus: PhotoFocus; onFocus: (focus: PhotoFocus) => void; style: StyleProp<ViewStyle> }) {
  const natural = useRef({ width: 0, height: 0 });
  const box = useRef({ width: 0, height: 0 });
  const latest = useRef({ focus, onFocus });
  latest.current = { focus, onFocus };
  const start = useRef(focus);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        start.current = latest.current.focus;
      },
      onPanResponderMove: (_, gesture) => {
        latest.current.onFocus(draggedFocus(start.current, gesture.dx, gesture.dy, box.current, natural.current));
      },
    }),
  ).current;

  return (
    <View
      {...responder.panHandlers}
      onLayout={(event: LayoutChangeEvent) => {
        box.current = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
      }}
      style={[styles.frame, style]}
    >
      <Image
        source={{ uri: source }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={contentPositionOf(focus)}
        onLoad={(event) => {
          natural.current = { width: event.source.width, height: event.source.height };
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frames: { alignItems: 'center', gap: 12, marginTop: 8 },
  frame: { overflow: 'hidden', backgroundColor: COLOR.surfaceSunken, borderWidth: 1, borderColor: COLOR.border },
  big: { width: '100%', maxWidth: 272, aspectRatio: 4 / 5, borderRadius: 16 },
  round: { width: 64, height: 64, borderRadius: 32 },
});
