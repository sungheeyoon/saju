import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { BUTTON, BUTTON_OFF_OPACITY, BUTTON_PRESSED_SCALE, BUTTON_PRIMARY_OFF } from '@design';

import { FONT } from './tokens';

/** 웹 `app/ui/buttons.ts` 의 단추 일곱 벌 — 변형 낱말과 상수의 짝은 `src/lib/design/contract.ts` */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'tertiary-danger' | 'danger' | 'primary-small' | 'secondary-small';

const BUTTON_OF: Record<ButtonVariant, keyof typeof BUTTON> = {
  primary: 'BUTTON_PRIMARY',
  secondary: 'BUTTON_SECONDARY',
  tertiary: 'BUTTON_TERTIARY',
  'tertiary-danger': 'BUTTON_TERTIARY_DANGER',
  danger: 'BUTTON_DANGER',
  'primary-small': 'BUTTON_PRIMARY_SMALL',
  'secondary-small': 'BUTTON_SECONDARY_SMALL',
};

/** `color` · `fontSize` 는 글자의 몫이라 면에서 가른다 */
function split(value: ViewStyle & { color?: string; fontSize?: number }): { face: ViewStyle; text: TextStyle } {
  const { color, fontSize, ...face } = value;
  return { face: { alignItems: 'center', justifyContent: 'center', ...face }, text: { color, fontSize } };
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { face, text } = split(BUTTON[BUTTON_OF[variant]]);
  const off = disabled || busy;
  const primaryOff = off && (variant === 'primary' || variant === 'primary-small');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [face, primaryOff ? styles.primaryOff : off && styles.off, pressed && styles.pressed, style]}
    >
      <Text style={[styles.label, text, primaryOff && styles.primaryOffText]}>{label}</Text>
    </Pressable>
  );
}

/** 웹의 `ICON_BUTTON*` 네 벌 — 이름은 `label` 이 든다 */
export type IconButtonVariant = 'plain' | 'quiet' | 'active' | 'ghost';

const ICON_OF: Record<IconButtonVariant, keyof typeof BUTTON> = {
  plain: 'ICON_BUTTON',
  quiet: 'ICON_BUTTON_QUIET',
  active: 'ICON_BUTTON_ACTIVE',
  ghost: 'ICON_BUTTON_GHOST',
};

export function IconButton({
  label,
  onPress,
  variant = 'ghost',
  disabled = false,
  style,
  children,
}: {
  label: string;
  onPress: () => void;
  variant?: IconButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { face } = split(BUTTON[ICON_OF[variant]]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [face, disabled && styles.off, pressed && styles.pressedIcon, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: FONT.bold },
  off: { opacity: BUTTON_OFF_OPACITY },
  primaryOff: { backgroundColor: BUTTON_PRIMARY_OFF.backgroundColor, boxShadow: 'none' },
  primaryOffText: { color: BUTTON_PRIMARY_OFF.color },
  pressed: { transform: [{ scale: BUTTON_PRESSED_SCALE }] },
  pressedIcon: { transform: [{ scale: 0.95 }] },
});
