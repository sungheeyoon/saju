import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { accountFailureOf, accountNoticeOf, type AccountState } from '@account/index';
import { SUPPORT_EMAIL } from '@brand';
import { SIGN_IN_AGAIN_NOTE } from '@sign-in-again';

import { Switch } from '@/ui/switch';
import { COLOR, CONTROL, FONT, TYPE } from '@/ui/tokens';
import { CardFrame } from '@/ui/surfaces';

/** 줄 이름 · 아래 한 줄 · 그 아래 작은 줄 — 웹 `app/me/settings/card.tsx` 의 `ROW_LABEL` · `ROW_HELP` · `ROW_NOTE` */
const PAD = 24;

/** 끝난 일을 잠깐 말한다 — 웹의 `useDoneNote` 와 같은 시간 */
const DONE_NOTE_SHOWN_MS = 2500;

export function useDoneNote() {
  const [said, setSaid] = useState<{ text: string; at: number } | null>(null);
  useEffect(() => {
    if (said === null) return;
    const fading = setTimeout(() => setSaid(null), DONE_NOTE_SHOWN_MS);
    return () => clearTimeout(fading);
  }, [said]);
  const say = useCallback((text: string) => setSaid({ text, at: Date.now() }), []);
  const clear = useCallback(() => setSaid(null), []);
  return { note: said?.text ?? '', say, clear };
}

/** 화면 안 실패 줄 — 웹 `app/ui/failure-line.tsx`. 다시 로그인이 답인 문장이면 다시 읽기 대신 로그인으로 가는 글자를 단다 */
export function FailureLine({ children, onRetry, signIn = false, inset = false }: { children: string; onRetry?: () => void; signIn?: boolean; inset?: boolean }) {
  const signedOut = signIn || children.includes(SIGN_IN_AGAIN_NOTE);
  return (
    <View accessibilityRole="alert" style={[styles.failureRow, inset && styles.inset]}>
      <Text style={styles.failure}>{children}</Text>
      {signedOut ? (
        <LineButton label="다시 로그인" onPress={() => router.replace('/')} />
      ) : (
        onRetry !== undefined && <LineButton label="다시 시도하기" onPress={onRetry} />
      )}
    </View>
  );
}

function LineButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.lineButton}>
      <Text style={styles.lineButtonText}>{label}</Text>
    </Pressable>
  );
}

/** 계정이 막혔을 때 화면 대신 보는 것 — 웹 `app/me/account-notice.tsx`. 문구와 판정은 `src/lib/account` 가 든다 */
export function AccountNotice({ state, onRetry }: { state: AccountState; onRetry: () => void }) {
  const failure = accountFailureOf(state);
  if (failure !== null) {
    return (
      <FailureLine onRetry={failure.next === 'retry' ? onRetry : undefined} signIn={failure.next === 'signIn'}>
        {failure.line}
      </FailureLine>
    );
  }
  const text = accountNoticeOf(state, SUPPORT_EMAIL);
  if (text === null) return null;
  return (
    <CardFrame style={styles.notice}>
      <Text style={styles.noticeTitle}>{text.title}</Text>
      <Text style={styles.help}>{text.detail}</Text>
    </CardFrame>
  );
}

/** 흰 무리 한 덩이 — 폰에서 화면 끝까지 간다. 무리 이름은 면 안 맨 위의 작은 회색 글자다 */
export function SettingsGroup({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      {title !== undefined && (
        <View style={styles.groupHead}>
          <Text style={styles.groupTitle} accessibilityRole="header">
            {title}
          </Text>
          {description !== undefined && <Text style={styles.note}>{description}</Text>}
        </View>
      )}
      {children}
    </View>
  );
}

/** 켜고 끄는 줄 — 이름과 스위치가 한 줄, 설명은 그 아래 줄 폭을 다 쓴다 */
export function SwitchRow({ label, help, note, checked, onChange, busy }: { label: string; help?: string; note?: string; checked: boolean; onChange: (next: boolean) => void; busy?: boolean }) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchHead}>
        <Text style={[styles.label, styles.fill]}>{label}</Text>
        <Switch checked={checked} onChange={onChange} busy={busy} label={label} />
      </View>
      {help !== undefined && <Text style={styles.help}>{help}</Text>}
      {note !== undefined && <Text style={styles.note}>{note}</Text>}
    </View>
  );
}

/** 글만 서는 줄 — 손잡이가 없다 */
export function PlainRow({ label, help }: { label: string; help?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.fill}>
        <Text style={styles.label}>{label}</Text>
        {help !== undefined && <Text style={styles.help}>{help}</Text>}
      </View>
    </View>
  );
}

/** 다른 화면으로 가는 줄 — 줄 전체가 누를 자리이고 오른쪽은 「›」 하나다 */
export function LinkRow({ label, help, note, leading, big = false, onPress }: { label: string; help?: string; note?: string; leading?: ReactNode; big?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.row, big && styles.bigRow, pressed && styles.pressed]}>
      {leading}
      <View style={styles.fill}>
        <Text numberOfLines={1} style={big ? styles.bigLabel : styles.label}>
          {label}
        </Text>
        {help !== undefined && (
          <Text numberOfLines={big ? 1 : undefined} style={styles.help}>
            {help}
          </Text>
        )}
        {note !== undefined && <Text style={styles.note}>{note}</Text>}
      </View>
      <Svg width={16} height={16} viewBox="0 0 16 16">
        <Path d="M6 3 L11 8 L6 13" fill="none" stroke={COLOR.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

/** 글자 줄 — 로그아웃처럼 화면을 떠나는 누름 */
export function TextRow({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.textRow, pressed && styles.pressed, disabled && styles.off]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

export const settingsText = StyleSheet.create({
  title: { fontSize: TYPE.title, lineHeight: 34, fontFamily: FONT.bold, color: COLOR.foreground },
  meta: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  section: { fontSize: TYPE.lead, lineHeight: 26, fontFamily: FONT.bold, color: COLOR.foreground },
  body: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.secondary },
  bodyStrong: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  failure: { fontSize: TYPE.note, lineHeight: 22, fontFamily: FONT.medium, color: COLOR.danger },
  fieldLabel: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.secondary },
  notice: { gap: 4, paddingHorizontal: 20, paddingVertical: 16 },
});

const styles = StyleSheet.create({
  fill: { flex: 1, minWidth: 0, gap: 2 },
  inset: { paddingHorizontal: PAD, paddingBottom: 12 },
  failureRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12 },
  failure: { flexShrink: 1, fontSize: TYPE.note, lineHeight: 22, fontFamily: FONT.medium, color: COLOR.danger },
  lineButton: { minHeight: CONTROL, justifyContent: 'center' },
  lineButtonText: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.secondary, textDecorationLine: 'underline' },
  notice: { gap: 4, paddingHorizontal: 20, paddingVertical: 16 },
  noticeTitle: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  group: { paddingVertical: 8, backgroundColor: COLOR.surfaceRaised },
  groupHead: { gap: 2, paddingHorizontal: PAD, paddingTop: 12, paddingBottom: 4 },
  groupTitle: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.bold, color: COLOR.secondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 56, paddingHorizontal: PAD, paddingVertical: 12 },
  bigRow: { minHeight: 80, paddingVertical: 16 },
  switchRow: { gap: 4, minHeight: 56, justifyContent: 'center', paddingHorizontal: PAD, paddingVertical: 12 },
  switchHead: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  textRow: { minHeight: 56, justifyContent: 'center', paddingHorizontal: PAD },
  pressed: { backgroundColor: COLOR.surfaceSunken },
  off: { opacity: 0.55 },
  label: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  bigLabel: { fontSize: TYPE.lead, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  help: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  note: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.muted },
});
