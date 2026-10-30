import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from './icons';
import { COLOR, FONT, RADIUS, TYPE } from './tokens';

const CLOSE_LABEL = '닫기';
const CANCEL_LABEL = '취소';

/** 아래에서 올라오는 시트 — 머리에 이름 · 메뉴 · 닫기가 서고 몸이 제 안에서 스크롤한다(웹의 `DetailSheet`) */
export function SheetModal({
  open,
  title,
  onClose,
  menu,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  menu?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel={CLOSE_LABEL} style={styles.outside} onPress={onClose} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.head}>
            <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
            {menu}
            <Pressable accessibilityRole="button" accessibilityLabel={CLOSE_LABEL} onPress={onClose} style={styles.icon}>
              <Icon size={20} name="close" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * 확인 창 — 되돌릴 수 없는 누름 앞에 선다(웹의 `ConfirmDialog`). 닫는 쪽이 먼저고, 실행은 그 곁이다. 바깥을 눌러도 닫힌다.
 */
export function ConfirmModal({
  open,
  title,
  lead,
  confirmLabel,
  cancelLabel = CANCEL_LABEL,
  onConfirm,
  onClose,
  danger = false,
  busy = false,
  failure = null,
  irreversible,
  children,
}: {
  open: boolean;
  title: string;
  lead?: ReactNode;
  confirmLabel: string;
  /** `null` 이면 닫는 단추가 안 선다(판매가 닫힌 풀이권 창) */
  cancelLabel?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
  busy?: boolean;
  failure?: string | null;
  irreversible?: string;
  children?: ReactNode;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.center}>
        <Pressable accessibilityLabel={CLOSE_LABEL} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.dialog} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.dialogBody}>
            {lead}
            <Text style={styles.dialogTitle} accessibilityRole="header">
              {title}
            </Text>
            {children}
            {irreversible !== undefined && <Text style={styles.irreversible}>{irreversible}</Text>}
            {failure !== null && (
              <Text style={styles.failure} accessibilityRole="alert">
                {failure}
              </Text>
            )}
          </ScrollView>
          <View style={styles.actions}>
            {cancelLabel !== null && (
              <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={[styles.action, styles.actionQuiet, busy && styles.off]}>
                <Text style={styles.actionQuietText}>{cancelLabel}</Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" disabled={busy} onPress={onConfirm} style={[styles.action, danger ? styles.actionDanger : styles.actionMain, busy && styles.off]}>
              <Text style={styles.actionMainText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** 창 안의 본문 글자 — 웹 창의 `text-body leading-6 text-secondary` */
export function DialogText({ children }: { children: ReactNode }) {
  return <Text style={styles.dialogText}>{children}</Text>;
}

/** 본문 속 핵심 값(「풀이권 1장」) */
export function DialogStrong({ children }: { children: ReactNode }) {
  return <Text style={styles.strong}>{children}</Text>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  outside: { flex: 1, minHeight: 40 },
  sheet: { maxHeight: '90%', borderTopLeftRadius: RADIUS.panel, borderTopRightRadius: RADIUS.panel, backgroundColor: COLOR.background },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 20, paddingRight: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  title: { flex: 1, fontFamily: FONT.bold, fontSize: TYPE.lead, color: COLOR.foreground },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20, paddingBottom: 40, gap: 16 },
  center: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  dialog: { maxHeight: '85%', borderRadius: RADIUS.panel, backgroundColor: COLOR.surface, overflow: 'hidden' },
  dialogBody: { padding: 20, gap: 10 },
  dialogTitle: { fontFamily: FONT.bold, fontSize: TYPE.lead, lineHeight: 25, color: COLOR.foreground },
  dialogText: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
  strong: { fontFamily: FONT.bold, color: COLOR.foreground },
  irreversible: { fontFamily: FONT.bold, fontSize: TYPE.sm, lineHeight: 22, color: COLOR.danger },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.danger },
  actions: { flexDirection: 'row', gap: 8, padding: 16, paddingTop: 4 },
  action: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, paddingHorizontal: 8 },
  actionQuiet: { backgroundColor: COLOR.surfaceSunken },
  actionQuietText: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  actionMain: { backgroundColor: COLOR.accent },
  actionDanger: { backgroundColor: COLOR.danger },
  actionMainText: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.onAccent },
  off: { opacity: 0.55 },
});
