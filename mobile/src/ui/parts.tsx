import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLOR, CONTROL, RADIUS, TYPE } from './tokens';

/** 흰 판 · 크림 판 — 웹의 `CARD` · `PAPER_FACE` */
export function Panel({ tone = 'surface', style, children }: { tone?: 'surface' | 'cream'; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return <View style={[styles.panel, tone === 'cream' && styles.cream, style]}>{children}</View>;
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

/** 글을 적는 칸 */
export function Field({ value, onChange, maxLength }: { value: string; onChange: (next: string) => void; maxLength?: number }) {
  return <TextInput style={styles.control} value={value} onChangeText={onChange} maxLength={maxLength} autoComplete="off" />;
}

/** 숫자 칸 — 단위는 칸 안 오른쪽이고, 숫자만 받는다 */
export function DigitField({
  value,
  onChange,
  unit,
  placeholder,
  digits,
}: {
  value: string;
  onChange: (next: string) => void;
  unit: string;
  placeholder: string;
  digits: number;
}) {
  return (
    <View style={styles.digit}>
      <TextInput
        style={[styles.control, styles.digitInput]}
        value={value}
        onChangeText={(next) => onChange(next.replace(/\D/g, '').slice(0, digits))}
        placeholder={placeholder}
        placeholderTextColor={COLOR.muted}
        keyboardType="number-pad"
        accessibilityLabel={unit}
      />
      <Text style={styles.unit}>{unit}</Text>
    </View>
  );
}

/** 고르는 칸 — 선택지가 펼침 없이 다 보인다 */
export function Choices<T extends string>({
  value,
  options,
  onPick,
}: {
  value: T | null;
  options: readonly { value: T; label: string }[];
  onPick: (next: T) => void;
}) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: chosen }}
            onPress={() => onPick(option.value)}
            style={[styles.option, chosen && styles.optionChosen]}
          >
            <Text style={[styles.optionText, chosen && styles.optionTextChosen]} numberOfLines={1}>
              {option.label}{chosen ? ' •' : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 펼치는 칸 — 고르면 접힌다 */
export function Select<T extends string>({
  value,
  options,
  onPick,
  disabled = false,
}: {
  value: T;
  options: readonly { value: T; label: string; hint?: string }[];
  onPick: (next: T) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  return (
    <View style={styles.selectBox}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen(!open)}
        style={[styles.control, styles.selectHead, open && styles.selectOpen, disabled && styles.off]}
      >
        <Text style={styles.selectText}>{current?.label}</Text>
        <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open && (
        <View style={styles.menu}>
          {options.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                onPick(option.value);
                setOpen(false);
              }}
              style={[styles.menuItem, option.value === value && styles.menuChosen]}
            >
              <Text style={styles.selectText}>{option.label}</Text>
              {option.hint !== undefined && <Text style={styles.hint}>{option.hint}</Text>}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 20, borderRadius: RADIUS.panel, backgroundColor: COLOR.surface },
  cream: { backgroundColor: COLOR.cream },
  label: { fontSize: TYPE.small, fontWeight: '600', color: COLOR.secondary, marginBottom: 2 },
  control: {
    minHeight: CONTROL,
    paddingHorizontal: 14,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    borderColor: COLOR.borderStrong,
    backgroundColor: COLOR.surface,
    fontSize: TYPE.field,
    color: COLOR.foreground,
  },
  digit: { flex: 1, justifyContent: 'center' },
  digitInput: { paddingLeft: 12, paddingRight: 34 },
  unit: { position: 'absolute', right: 14, fontSize: TYPE.body, color: COLOR.secondary },
  row: { flexDirection: 'row', gap: 6, flex: 1 },
  option: {
    flex: 1,
    minHeight: CONTROL,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.control,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: COLOR.surfaceSunken,
    paddingHorizontal: 4,
  },
  optionChosen: { backgroundColor: COLOR.accentWash, borderColor: COLOR.creamInk },
  optionText: { fontSize: TYPE.body, color: COLOR.secondary },
  optionTextChosen: { color: COLOR.creamInk, fontWeight: '600' },
  selectBox: { flex: 1 },
  selectHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectOpen: { borderColor: COLOR.creamInk },
  off: { opacity: 0.55 },
  selectText: { fontSize: TYPE.body, color: COLOR.foreground },
  chevron: { fontSize: TYPE.body, color: COLOR.secondary },
  menu: { marginTop: 6, borderRadius: RADIUS.control, borderWidth: 1, borderColor: COLOR.borderStrong, overflow: 'hidden', backgroundColor: COLOR.surface },
  menuItem: { minHeight: CONTROL, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  menuChosen: { backgroundColor: COLOR.accentWash },
  hint: { fontSize: TYPE.fine, color: COLOR.muted, marginTop: 2 },
  primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.accent },
  pressed: { transform: [{ scale: 0.97 }] },
  primaryText: { fontSize: TYPE.field, fontWeight: '700', color: COLOR.onAccent },
});
