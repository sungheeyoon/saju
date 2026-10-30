import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { DELETION_IRREVERSIBLE_NOTE, DELETION_NOTE, DELETION_SHARED_NOTE } from '@account/index';

import { ConfirmDialog, DialogStrong, DialogText } from '@/ui/confirm-dialog';
import { COLOR, CONTROL, FONT, TYPE } from '@/ui/tokens';

import { requestAccountDeletion } from './settings';

/**
 * 떠나는 자리 — 웹 `app/me/leaving.tsx` 와 같은 차례다: **여는 누름은 아무것도 안 지운다.** 창이 무엇이 지워지고 무엇이 남는지 먼저
 * 말하고, 되돌릴 수 없는 누름은 그 안의 「탈퇴」다. 거절되면 창이 열린 채 그 줄이 서고, 성공하면 화면이 다시 읽혀 통째로 탈퇴 대기 안내로 바뀐다.
 */
export function RequestDeletion({ onDone }: { onDone: () => void }) {
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const leave = async () => {
    setFailure(null);
    setWorking(true);
    const result = await requestAccountDeletion();
    setWorking(false);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    setAsking(false);
    onDone();
  };

  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setAsking(true)} style={({ pressed }) => [styles.open, pressed && styles.pressed]}>
        <Text style={styles.openText}>탈퇴하기</Text>
      </Pressable>
      <ConfirmDialog
        open={asking}
        onClose={() => {
          setAsking(false);
          setFailure(null);
        }}
        title="정말 탈퇴할까요?"
        confirmLabel={working ? '보내는 중…' : '탈퇴'}
        onConfirm={() => void leave()}
        danger
        busy={working}
        failure={failure}
        irreversible={DELETION_IRREVERSIBLE_NOTE}
      >
        <DialogText>
          <Bolded text={DELETION_NOTE} />
        </DialogText>
        <DialogText small>
          <Bolded text={DELETION_SHARED_NOTE} />
        </DialogText>
      </ConfirmDialog>
    </>
  );
}

/** `**낱말**` 을 굵게 — 탈퇴 창의 핵심 낱말 */
function Bolded({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/).map((part, at) => (at % 2 === 1 ? <DialogStrong key={at}>{part}</DialogStrong> : part))}</>;
}

const styles = StyleSheet.create({
  open: { minHeight: CONTROL, minWidth: CONTROL, justifyContent: 'center', alignSelf: 'flex-start', marginHorizontal: 16, paddingHorizontal: 8 },
  pressed: { opacity: 0.55 },
  openText: { fontSize: TYPE.small, fontFamily: FONT.medium, color: COLOR.muted },
});
