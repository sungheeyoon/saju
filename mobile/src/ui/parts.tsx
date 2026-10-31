import { useEffect, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  BackHandler,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { FIELD } from '@design';
import { digitOutOfRange } from '@input/entry';

import { Button } from './buttons';
import { COLOR, FONT, CONTROL, RADIUS, TYPE } from './tokens';

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

/** 글을 적는 칸 */
export function Field({
  value,
  onChange,
  maxLength,
  placeholder,
  label,
  autoCapitalize,
  refused = false,
  inputRef,
}: {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  placeholder?: string;
  label?: string;
  autoCapitalize?: 'none' | 'characters';
  refused?: boolean;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
}) {
  return (
    <TextInput
      ref={inputRef}
      style={[styles.control, refused && styles.wrong]}
      value={value}
      onChangeText={onChange}
      maxLength={maxLength}
      placeholder={placeholder}
      placeholderTextColor={COLOR.muted}
      accessibilityLabel={label}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      spellCheck={false}
      autoComplete="off"
    />
  );
}

/** 확인 상자 한 줄 — 줄 전체가 누를 자리이고, 고르면 먹색 테와 크림 면이 선다. 기본값은 꺼짐이다(`app/signup/form.tsx`) */
export function CheckRow({ checked, onToggle, refused = false, children }: { checked: boolean; onToggle: (next: boolean) => void; refused?: boolean; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onToggle(!checked)}
      style={[styles.check, checked && styles.checkOn, refused && styles.wrong]}
    >
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
        {checked && (
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" fill="none" stroke={COLOR.onAccent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </View>
      <View style={styles.checkBody}>{children}</View>
    </Pressable>
  );
}

/** 작은 보조 단추 — 칸 곁의 「중복 확인」 */
export function SecondaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Button label={label} onPress={onPress} disabled={disabled} variant="secondary-small" />;
}

/** 글자만 있는 단추 — 처리방침 · 나가는 길 */
export function TextButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Button label={label} onPress={onPress} disabled={disabled} variant="tertiary" style={styles.textButton} />;
}

/** 숫자 칸 — 숫자만 받고, 범위 밖이면 붉어지고, 다 적으면 다음 칸으로 간다. 판정은 웹과 같은 `digitOutOfRange` 다 */
export function DigitField({
  value,
  onChange,
  unit,
  placeholder,
  digits,
  min,
  max,
  refused = false,
  inputRef,
  onFull,
  advanceEarly = false,
}: {
  value: string;
  onChange: (next: string) => void;
  unit: string;
  placeholder: string;
  digits: number;
  min: number;
  max: number;
  refused?: boolean;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
  onFull?: () => void;
  /** 뒤에 숫자가 더 올 수 없으면 한 자리로도 넘어간다(「5」월). 시각은 끈다 — 「33」이 3시 3분으로 조용히 갈라지면 시주가 틀린다 */
  advanceEarly?: boolean;
}) {
  const wrong = refused || digitOutOfRange(value, digits, min, max);
  return (
    <View style={styles.digit}>
      <TextInput
        ref={inputRef}
        style={[styles.control, styles.digitInput, wrong && styles.wrong]}
        value={value}
        onChangeText={(typed) => {
          const next = typed.replace(/\D/g, '').slice(0, digits);
          onChange(next);
          const done = next.length === digits || (advanceEarly && next !== '' && Number(next) * 10 > max);
          if (done && !digitOutOfRange(next, digits, min, max)) onFull?.();
        }}
        placeholder={placeholder}
        placeholderTextColor={COLOR.muted}
        keyboardType="number-pad"
        returnKeyType="done"
        inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_DONE : undefined}
        accessibilityLabel={unit}
      />
      <Text style={styles.unit}>{unit}</Text>
    </View>
  );
}

const KEYBOARD_DONE = 'keyboard-done';

/** iOS 숫자 키패드에는 완료 키가 없다 — 키보드 위에 「완료」를 세운다. 화면에 한 번 둔다 */
export function KeyboardDoneBar() {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE}>
      <View style={styles.doneBar}>
        <Pressable accessibilityRole="button" onPress={Keyboard.dismiss} style={styles.doneButton}>
          <Text style={styles.doneText}>완료</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
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
  /* 안드로이드 뒤로 가기는 펼친 목록을 먼저 접는다 — 안 받으면 화면을 떠나고 첫 화면이면 앱을 나간다 */
  useEffect(() => {
    if (!open) return;
    const listening = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false);
      return true;
    });
    return () => listening.remove();
  }, [open]);
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

export function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Button label={label} onPress={onPress} disabled={disabled} />;
}

const styles = StyleSheet.create({
  label: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.secondary, marginBottom: 2 },
  control: { ...FIELD, fontFamily: FONT.medium, color: COLOR.foreground },
  wrong: { borderColor: COLOR.danger, borderWidth: 2 },
  doneBar: { alignItems: 'flex-end', backgroundColor: COLOR.surfaceSunken, borderTopWidth: 1, borderTopColor: COLOR.border },
  doneButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  doneText: { fontFamily: FONT.bold, fontSize: TYPE.field, color: COLOR.foreground },
  digit: { flex: 1, justifyContent: 'center' },
  digitInput: { paddingLeft: 12, paddingRight: 34 },
  unit: { position: 'absolute', right: 14, fontFamily: FONT.medium, fontSize: TYPE.body, color: COLOR.secondary },
  row: { flexDirection: 'row', gap: 6, flex: 1 },
  option: {
    flex: 1,
    minHeight: CONTROL,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.cell,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: COLOR.surfaceSunken,
    paddingHorizontal: 4,
  },
  optionChosen: { backgroundColor: COLOR.accentWash, borderColor: COLOR.creamInk },
  optionText: { fontFamily: FONT.medium, fontSize: TYPE.body, color: COLOR.secondary },
  optionTextChosen: { color: COLOR.creamInk, fontFamily: FONT.bold },
  selectBox: { flex: 1 },
  selectHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectOpen: { borderColor: COLOR.creamInk },
  off: { opacity: 0.55 },
  selectText: { fontFamily: FONT.medium, fontSize: TYPE.body, color: COLOR.foreground },
  chevron: { fontFamily: FONT.medium, fontSize: TYPE.body, color: COLOR.secondary },
  menu: { marginTop: 6, borderRadius: RADIUS.cell, borderWidth: 1, borderColor: COLOR.borderStrong, overflow: 'hidden', backgroundColor: COLOR.surface },
  menuItem: { minHeight: CONTROL, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  menuChosen: { backgroundColor: COLOR.accentWash },
  hint: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.muted, marginTop: 2 },
  check: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: RADIUS.cell, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  checkOn: { borderColor: COLOR.foreground, backgroundColor: COLOR.cream },
  checkBox: { width: 20, height: 20, marginTop: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 4, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  checkBoxOn: { borderColor: COLOR.accent, backgroundColor: COLOR.accent },
  checkBody: { flex: 1, gap: 4 },
  textButton: { alignItems: 'flex-start' },
});
