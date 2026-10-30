import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';

import { CELL, SURFACE } from '@design';

/**
 * **앱의 면 한 벌** — 웹 `app/ui/surfaces.ts` 와 같은 이름 · 같은 값이다(값 `src/lib/design/parts.ts`, ADR 0109 추기 2026-10-31).
 * 화면은 면을 손으로 쓰지 않고 이 부품을 부른다. 여백 · 테 색처럼 자리마다 바꾸는 것만 `style` 로 덧붙인다(웹의 `*_FACE` 자리).
 * `onPress` 를 주면 면 전체가 누를 자리가 된다.
 */
type FaceProps = {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
};

function Face({ face, style, children, onPress, disabled, accessibilityLabel, accessibilityRole }: FaceProps & { face: ViewStyle }) {
  if (onPress === undefined) {
    return (
      <View style={[face, style]} accessibilityLabel={accessibilityLabel} accessibilityRole={accessibilityRole}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [face, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

/** 카드 한 장 — 흰 면 · 가는 테 · 카드 그림자 */
export const Card = (props: FaceProps) => <Face face={styles.card} {...props} />;

/** 카드의 테만 — 속을 띠로 나누는 판. 그림자 없이 모서리 밖을 자른다 */
export const CardFrame = (props: FaceProps) => <Face face={styles.frame} {...props} />;

/** 크림 종이 — 한 화면의 주인공 판. 한 화면에 하나 */
export const Paper = (props: FaceProps) => <Face face={styles.paper} {...props} />;

/** 오행 타일 — 면 색은 그 오행의 `soft` 를 받는다 */
export const Tile = ({ tone, style, ...props }: FaceProps & { tone: string }) => <Face face={styles.tile} style={[{ backgroundColor: tone }, style]} {...props} />;

/** 칸 — 판 안의 작은 상자 */
export const Cell = (props: FaceProps) => <Face face={styles.cell} {...props} />;

/** 띄움 메뉴 판 — 안쪽 여백 · 폭 · 자리는 쓰는 자리가 붙인다 */
export const MenuPanel = (props: FaceProps) => <Face face={styles.menu} {...props} />;

/** 줄 카드 — 목록의 한 줄 */
export const RowCard = (props: FaceProps) => <Face face={styles.row} {...props} />;

/** 선 줄 — 판 없이 위아래 가는 선 사이에 서는 한 줄 */
export const RowLine = (props: FaceProps) => <Face face={styles.line} {...props} />;

/** 점선 빈 자리 — 「한 자리 더」 */
export const EmptySlot = (props: FaceProps) => <Face face={styles.slot} {...props} />;

/** 확인 창의 판 */
export const DialogPanel = (props: FaceProps) => <Face face={styles.dialog} {...props} />;

const styles = StyleSheet.create({
  card: SURFACE.CARD,
  frame: SURFACE.CARD_FRAME,
  paper: SURFACE.PAPER,
  tile: SURFACE.TILE,
  cell: CELL,
  menu: SURFACE.MENU_PANEL,
  row: SURFACE.ROW_CARD,
  line: SURFACE.ROW_LINE,
  slot: SURFACE.EMPTY_SLOT,
  dialog: SURFACE.DIALOG,
  pressed: { opacity: 0.85 },
});
