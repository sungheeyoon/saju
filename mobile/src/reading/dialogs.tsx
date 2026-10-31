import {
  CREDITS_AVAILABLE_LABEL,
  CREDITS_REQUIRED_LABEL,
  CREDITS_SHORTAGE_TITLE,
  READING_REPLACES_NOTE,
  READING_USES_TICKET_NOTE,
  SALE_CLOSED_NOTE,
  SALE_CLOSED_OK,
} from '@reading/notes';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { DialogPanel } from '@/ui/surfaces';
import { PrimaryButton, TextButton } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';

function Dialog({
  title,
  confirmLabel,
  onConfirm,
  cancelLabel,
  onClose,
  children,
}: {
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel: string | null;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable accessibilityLabel={cancelLabel ?? confirmLabel} style={styles.back} onPress={onClose}>
        <Pressable accessibilityViewIsModal onPress={() => undefined}>
          <DialogPanel style={styles.box}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <View style={styles.body}>{children}</View>
          <PrimaryButton label={confirmLabel} onPress={onConfirm} />
          {cancelLabel !== null && <TextButton label={cancelLabel} onPress={onClose} />}
          </DialogPanel>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** 되돌릴 수 없는 누름 앞의 확인 — 글자는 웹의 `panel.tsx` 와 같다 */
export function ConfirmMake({
  noun,
  hasReading,
  onConfirm,
  onClose,
}: {
  noun: string;
  hasReading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      title="풀이권 1장을 사용하시겠어요?"
      confirmLabel={hasReading ? '다시 받기' : `${noun} 받기`}
      onConfirm={onConfirm}
      cancelLabel="취소"
      onClose={onClose}
    >
      {hasReading && <Text style={styles.danger}>{READING_REPLACES_NOTE}</Text>}
      <Text style={styles.line}>{READING_USES_TICKET_NOTE}</Text>
    </Dialog>
  );
}

/**
 * 풀이권이 모자란 때 — 앱은 풀이권을 팔지 않으므로 웹의 판매가 닫힌 꼴 하나다: 한 줄과 「확인」(`useBuyCredits` 의 닫힌 꼴).
 */
export function CreditsShortage({ available, onClose }: { available: number; onClose: () => void }) {
  return (
    <Dialog title={CREDITS_SHORTAGE_TITLE} confirmLabel={SALE_CLOSED_OK} onConfirm={onClose} cancelLabel={null} onClose={onClose}>
      <View style={styles.row}>
        <Text style={styles.line}>{CREDITS_AVAILABLE_LABEL}</Text>
        <Text style={styles.count}>{available}장</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.line}>{CREDITS_REQUIRED_LABEL}</Text>
        <Text style={styles.count}>1장</Text>
      </View>
      <Text style={styles.line}>{SALE_CLOSED_NOTE}</Text>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(38, 36, 31, 0.45)' },
  box: { gap: 12 },
  title: { fontFamily: FONT.bold, fontSize: TYPE.heading, color: COLOR.foreground },
  body: { gap: 8, marginBottom: 4 },
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
  danger: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 24, color: COLOR.danger },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  count: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
});
