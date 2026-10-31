import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { REPORT_DETAIL_MAX, REPORT_DONE, REPORT_NOTE, REPORT_REASONS, type ReportReason } from '@account/index';
import { BLOCK_FINAL_NOTE, BLOCK_KEEPS_NOTE, BLOCK_NOTE } from '@consent/index';

import { FieldLabel, PrimaryButton, Select, TextButton } from '@/ui/parts';
import { Icon } from '@/ui/icons';
import { ConfirmDialog, DialogText } from '@/ui/confirm-dialog';
import { DialogPanel } from '@/ui/surfaces';
import { COLOR, CONTROL, FONT, RADIUS, TYPE } from '@/ui/tokens';

import { blockUser, reportMessage, reportUser, type SaveAnswer } from './reads';

function Dialog({ onOutside, children }: { onOutside: (() => void) | null; children: ReactNode }) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onOutside ?? undefined}>
      <KeyboardAvoidingView behavior="padding" style={styles.back}>
        <Pressable style={styles.outside} onPress={onOutside ?? undefined} />
        <DialogPanel style={styles.dialog}>{children}</DialogPanel>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** 차단을 한 번 더 묻는 창 — 웹의 `BlockDialog` 와 같은 글자다. 보내는 동안은 안 닫힌다 */
export function BlockDialog({ userId, nickname, onClose, onBlocked }: { userId: string; nickname: string; onClose: () => void; onBlocked: () => void }) {
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const block = async () => {
    setFailure(null);
    setWorking(true);
    const result = await blockUser(userId);
    setWorking(false);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    onClose();
    onBlocked();
  };

  return (
    <ConfirmDialog
      open
      danger
      title={`${nickname} 님을 차단할까요?`}
      irreversible={BLOCK_FINAL_NOTE}
      confirmLabel={working ? '차단하는 중…' : '차단하기'}
      busy={working}
      failure={failure}
      onConfirm={() => void block()}
      onClose={onClose}
    >
      <DialogText>{BLOCK_NOTE}</DialogText>
      <DialogText>{BLOCK_KEEPS_NOTE}</DialogText>
    </ConfirmDialog>
  );
}

export type ReportableMessage = { readonly id: string; readonly body: string; readonly time: string };

/**
 * 신고 창 — 사유 칸이 곧장 서고 상대의 말이 최근 것부터 선다. 메시지 고르기는 선택이다(ADR 0158): 고르면 메시지 신고, 안 고르면 사람 신고.
 * 적은 것이 있으면 바깥 누름으로 안 닫힌다 — 닫는 길은 X 하나다.
 */
export function ReportDialog({
  userId,
  nickname,
  messages,
  onClose,
  onBlock,
}: {
  userId: string;
  nickname: string;
  messages: readonly ReportableMessage[];
  onClose: () => void;
  /** 「차단으로 넘어가기」 — 닫힌 방에는 없다 */
  onBlock: (() => void) | null;
}) {
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0].value);
  const [detail, setDetail] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const dirty = !reported && (reason !== REPORT_REASONS[0].value || detail.trim() !== '');

  const submit = async () => {
    setFailure(null);
    setWorking(true);
    const result: SaveAnswer = picked !== null ? await reportMessage(picked, reason, detail) : await reportUser(userId, reason, detail);
    setWorking(false);
    if (result.ok) setReported(true);
    else setFailure(result.message);
  };

  return (
    <Dialog onOutside={dirty || working ? null : onClose}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Icon name="flag" color={COLOR.danger} size={18} />
          <Text accessibilityRole="header" style={styles.headTitle}>
            {nickname} 님 신고
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={reported ? '닫기' : '작성 그만두기'} onPress={onClose} style={styles.close}>
            <Icon name="close" color={COLOR.foreground} size={18} />
          </Pressable>
        </View>
        {reported ? (
          <>
            <Text style={styles.line}>{REPORT_DONE}</Text>
            <PrimaryButton label="닫기" onPress={onClose} />
            {onBlock !== null && <BlockLink onBlock={onBlock} />}
          </>
        ) : (
          <>
            <Text style={styles.note}>{REPORT_NOTE}</Text>
            {messages.length > 0 && (
              <View style={styles.group}>
                <FieldLabel>신고할 메시지를 골라 주세요</FieldLabel>
                <ScrollView style={styles.pickList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {messages.map((message) => {
                    const chosen = picked === message.id;
                    return (
                      <Pressable
                        key={message.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: chosen }}
                        onPress={() => setPicked(chosen ? null : message.id)}
                        style={[styles.pick, chosen && styles.picked]}
                      >
                        <View style={styles.pickText}>
                          <Text numberOfLines={2} style={styles.pickBody}>
                            {message.body}
                          </Text>
                          <Text style={styles.pickTime}>{message.time}</Text>
                        </View>
                        <Icon name="flag" color={COLOR.danger} size={16} />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            <View style={styles.group}>
              <FieldLabel>신고 사유</FieldLabel>
              <Select value={reason} options={REPORT_REASONS} onPick={setReason} />
            </View>
            <View style={styles.group}>
              <FieldLabel>덧붙일 말 (선택)</FieldLabel>
              <TextInput
                accessibilityLabel="덧붙일 말 (선택)"
                multiline
                value={detail}
                maxLength={REPORT_DETAIL_MAX}
                onChangeText={setDetail}
                style={styles.detail}
              />
            </View>
            {failure !== null && <Text style={styles.failure}>{failure}</Text>}
            <PrimaryButton label={working ? '보내는 중…' : '신고하기'} onPress={submit} disabled={working} />
            {onBlock !== null && <BlockLink onBlock={onBlock} disabled={working} />}
          </>
        )}
      </ScrollView>
    </Dialog>
  );
}

function BlockLink({ onBlock, disabled = false }: { onBlock: () => void; disabled?: boolean }) {
  return (
    <View style={styles.center}>
      <TextButton label="차단으로 넘어가기" onPress={onBlock} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(38, 36, 31, 0.45)' },
  outside: { ...StyleSheet.absoluteFill },
  dialog: { maxHeight: '85%', padding: 0, backgroundColor: COLOR.background },
  body: { gap: 12, padding: 24 },
  line: { fontSize: TYPE.note, lineHeight: 22, fontFamily: FONT.medium, color: COLOR.secondary },
  note: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  failure: { fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.medium, color: COLOR.danger },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headTitle: { flex: 1, fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  close: { minHeight: CONTROL, minWidth: CONTROL, alignItems: 'center', justifyContent: 'center' },
  group: { gap: 6 },
  pickList: { maxHeight: 176, padding: 6, borderRadius: RADIUS.cell, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  pick: { minHeight: CONTROL, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.cell },
  picked: { backgroundColor: COLOR.warningWash, borderWidth: 1, borderColor: COLOR.danger },
  pickText: { flex: 1, gap: 2 },
  pickBody: { fontSize: TYPE.note, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.foreground },
  pickTime: { fontSize: TYPE.fine, fontFamily: FONT.medium, color: COLOR.secondary },
  detail: {
    minHeight: 84,
    padding: 12,
    textAlignVertical: 'top',
    borderRadius: RADIUS.cell,
    borderWidth: 1,
    borderColor: COLOR.borderStrong,
    backgroundColor: COLOR.surface,
    fontSize: TYPE.field,
    fontFamily: FONT.medium,
    color: COLOR.foreground,
  },
  center: { alignItems: 'center' },
});
