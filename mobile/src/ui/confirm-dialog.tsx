import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { COLOR, CONTROL, FONT, RADIUS, TYPE } from './tokens';

/** 어느 단추든 글자가 이만큼을 넘으면 위아래로 선다 — 웹 `app/ui/confirm-dialog.tsx` 의 `autoActions` */
const ROW_LETTERS = 6;

/**
 * 확인 창 한 벌 — 웹의 `ConfirmDialog`(ADR 0166)와 같은 약속이다: 바깥 누름 · 뒤로 · 「취소」는 같은 일(닫기), 보내는 동안은 셋 다 안
 * 닫힌다. 거절되면 창이 열린 채 그 줄이 선다. 되돌릴 수 없다는 말은 본문 끝 제 문단(`irreversible`)이다.
 */
export function ConfirmDialog({
  open,
  onClose,
  onDismissed,
  title,
  children,
  irreversible,
  confirmLabel,
  onConfirm,
  danger = false,
  busy = false,
  failure = null,
}: {
  open: boolean;
  onClose: () => void;
  /** 창이 다 닫힌 뒤 — iOS 는 닫히는 창 위에 다음 창을 못 띄운다 */
  onDismissed?: () => void;
  title: string;
  children?: ReactNode;
  irreversible?: string;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
  busy?: boolean;
  failure?: string | null;
}) {
  const close = () => {
    if (!busy) onClose();
  };
  const row = [confirmLabel, '취소'].every((label) => label.replace(/\s/g, '').length <= ROW_LETTERS);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} onDismiss={onDismissed}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityElementsHidden importantForAccessibility="no" />
        <View style={styles.panel} accessibilityViewIsModal accessibilityRole="alert">
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} bounces={false}>
            <Text style={styles.title}>{title}</Text>
            {children}
            {irreversible !== undefined && <Text style={styles.irreversible}>{irreversible}</Text>}
            {failure !== null && <Text style={styles.failure}>{failure}</Text>}
          </ScrollView>
          <View style={row ? styles.actionsRow : styles.actions}>
            {row && <Button label="취소" onPress={close} disabled={busy} />}
            <Button label={confirmLabel} onPress={onConfirm} disabled={busy} tone={danger ? 'danger' : 'primary'} />
            {!row && <Button label="취소" onPress={close} disabled={busy} />}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Button({ label, onPress, disabled, tone = 'quiet' }: { label: string; onPress: () => void; disabled: boolean; tone?: 'quiet' | 'primary' | 'danger' }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, tone === 'primary' && styles.primary, tone === 'danger' && styles.danger, disabled && styles.off]}
    >
      <Text style={[styles.buttonText, tone !== 'quiet' && styles.onTone]}>{label}</Text>
    </Pressable>
  );
}

/** 창 본문 한 문단 */
export function DialogText({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return <Text style={small ? styles.small : styles.text}>{children}</Text>;
}

/** 본문의 핵심 낱말 — 웹의 `<strong>` */
export function DialogStrong({ children }: { children: ReactNode }) {
  return <Text style={styles.strong}>{children}</Text>;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  panel: { width: '100%', maxWidth: 400, maxHeight: '85%', padding: 20, gap: 16, borderRadius: RADIUS.panel, backgroundColor: COLOR.surface },
  scroll: { flexGrow: 0 },
  body: { gap: 10 },
  title: { fontSize: TYPE.lead, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  text: { fontSize: TYPE.body, lineHeight: 23, fontFamily: FONT.medium, color: COLOR.secondary },
  small: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  strong: { fontFamily: FONT.bold, color: COLOR.foreground },
  irreversible: { fontSize: TYPE.body, lineHeight: 23, fontFamily: FONT.bold, color: COLOR.foreground },
  failure: { fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.medium, color: COLOR.danger },
  actions: { gap: 8 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  button: { flexGrow: 1, flexBasis: 0, minHeight: 48, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.surfaceSunken, minWidth: CONTROL },
  primary: { backgroundColor: COLOR.accent },
  danger: { backgroundColor: COLOR.danger },
  off: { opacity: 0.55 },
  buttonText: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  onTone: { color: COLOR.onAccent },
});
