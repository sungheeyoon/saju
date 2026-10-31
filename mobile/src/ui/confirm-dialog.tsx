import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from './buttons';
import { DialogPanel } from './surfaces';
import { COLOR, FONT, TYPE } from './tokens';

/** 어느 단추든 글자가 이만큼을 넘으면 위아래로 선다 — 웹 `app/ui/confirm-dialog.tsx` 의 `autoActions` */
const ROW_LETTERS = 6;

/**
 * 확인 창 한 벌 — 웹의 `ConfirmDialog`(ADR 0166)와 같은 약속이다: 바깥 누름 · 뒤로 · 「취소」는 같은 일(닫기), 보내는 동안은 셋 다 안
 * 닫힌다. 거절되면 창이 열린 채 그 줄이 선다. 되돌릴 수 없다는 말은 본문 끝 제 문단(`irreversible`)이다. 단추 차례도 웹과 같다 — 나란히면
 * 닫기가 왼쪽 · 실행이 오른쪽, 위아래면 실행이 위.
 */
export function ConfirmDialog({
  open,
  onClose,
  onDismissed,
  title,
  lead,
  children,
  irreversible,
  confirmLabel,
  onConfirm,
  danger = false,
  busy = false,
  failure = null,
  cancelLabel = '취소',
}: {
  open: boolean;
  onClose: () => void;
  /** 창이 다 닫힌 뒤 — iOS 는 닫히는 창 위에 다음 창을 못 띄운다 */
  onDismissed?: () => void;
  title: string;
  /** 제목 위에 서는 그림(아이콘 · 사진) */
  lead?: ReactNode;
  children?: ReactNode;
  irreversible?: string;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
  busy?: boolean;
  failure?: string | null;
  /** `null` 이면 「취소」를 안 세운다 — 고를 것이 없는 고지 */
  cancelLabel?: string | null;
}) {
  const close = () => {
    if (!busy) onClose();
  };
  const row = [confirmLabel, cancelLabel ?? ''].every((label) => label.replace(/\s/g, '').length <= ROW_LETTERS);
  const confirm = <Button label={confirmLabel} onPress={onConfirm} disabled={busy} variant={danger ? 'danger' : 'primary'} style={row && styles.half} />;
  const cancel = cancelLabel !== null && <Button label={cancelLabel} onPress={close} disabled={busy} variant="secondary" style={row && styles.half} />;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} onDismiss={onDismissed}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityElementsHidden importantForAccessibility="no" />
        <DialogPanel style={styles.panel} accessibilityViewIsModal accessibilityRole="alert">
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} bounces={false}>
            {lead}
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            {children}
            {irreversible !== undefined && <Text style={styles.irreversible}>{irreversible}</Text>}
            {failure !== null && <Text accessibilityRole="alert" style={styles.failure}>{failure}</Text>}
          </ScrollView>
          <View style={row ? styles.actionsRow : styles.actions}>
            {row ? cancel : confirm}
            {row ? confirm : cancel}
          </View>
        </DialogPanel>
      </View>
    </Modal>
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
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  panel: { width: '100%', maxWidth: 416, maxHeight: '85%', gap: 24 },
  scroll: { flexGrow: 0 },
  body: { gap: 8 },
  title: { fontSize: TYPE.lead, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  text: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.secondary },
  small: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  strong: { fontFamily: FONT.bold, color: COLOR.foreground },
  irreversible: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.foreground },
  failure: { marginTop: 4, fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.danger },
  actions: { gap: 8 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  half: { flexGrow: 1, flexBasis: 0, minWidth: 0 },
});
