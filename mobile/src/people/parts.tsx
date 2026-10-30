import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { accountFailureOf, accountNoticeOf, type AccountState } from '@account/index';
import { SUPPORT_EMAIL } from '@brand';
import { HOUR_UNKNOWN_LABEL } from '@input/query';
import { BRANCH_INFO, STEM_INFO, type Branch, type Stem } from '@saju';
import { PILLAR_COLUMNS, STEM_PICTURE } from '@saju-view';

import { KeyboardDoneBar, Panel, TextButton } from '@/ui/parts';
import { COLOR, CONTROL, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';

import { StemSymbol } from '@/ui/stem-symbol';

/** 아직 없는 경로도 그대로 잇는다 — 나란히 짓는 화면이 그 자리에 선다 */
export const go = (path: string) => router.push(path as Href);

/** 한 화면의 틀 */
export function ScreenFrame({ children, keyboard = false }: { children: ReactNode; keyboard?: boolean }) {
  const body = (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {children}
    </ScrollView>
  );
  return (
    <SafeAreaView style={styles.screen}>
      {keyboard ? (
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {body}
          <KeyboardDoneBar />
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

/** 뒤로 가기 — 글자는 돌아갈 화면의 이름이다. 그 화면에서 오지 않았으면 그 화면을 연다 */
export function BackLink({ label, href }: { label: string; href: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (router.canGoBack() ? router.back() : router.replace(href as Href))}
      style={styles.back}
    >
      <Text style={styles.backText}>‹ {label}</Text>
    </Pressable>
  );
}

/** 못 읽었거나 못 한 일을 말하는 줄 — 읽기 실패에는 다시 읽는 단추가 붙는다(`app/ui/failure-line.tsx`) */
export function FailureLine({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <View accessibilityRole="alert" style={styles.failureBox}>
      <Text style={styles.failure}>{children}</Text>
      {onRetry !== undefined && <TextButton label="다시 시도하기" onPress={onRetry} />}
    </View>
  );
}

/** 계정이 막혀 있을 때 화면 대신 보는 것 — 문구와 판정은 `src/lib/account` 가 든다(`app/me/account-notice.tsx`) */
export function AccountNotice({ state, onRetry }: { state: AccountState; onRetry: () => void }) {
  const failure = accountFailureOf(state);
  if (failure !== null) {
    return <FailureLine onRetry={failure.next === 'retry' ? onRetry : undefined}>{failure.line}</FailureLine>;
  }
  const text = accountNoticeOf(state, SUPPORT_EMAIL);
  if (text === null) return null;
  return (
    <Panel style={styles.notice}>
      <Text style={styles.noticeTitle}>{text.title}</Text>
      <Text style={styles.noticeBody}>{text.detail}</Text>
    </Panel>
  );
}

/** 없는 사람과 못 보는 사람이 같은 말을 듣는다 — `app/me/people/[personId]/not-found.tsx` · `app/me/compat/not-found.tsx` */
export function NotFound({ children }: { children: ReactNode }) {
  return (
    <View style={styles.notFound}>
      <Text style={styles.title}>찾을 수 없어요</Text>
      <Text style={styles.noticeBody}>주소에 적힌 사람을 찾지 못했어요.</Text>
      <Text style={styles.noticeBody}>목록에서 다시 골라 주세요.</Text>
      <View style={styles.notFoundActions}>{children}</View>
    </View>
  );
}

/** 일간 딱지 — **천간 그림과 그 이름이 함께 선다**(`app/me/people/chart-bits.tsx`). 딱지는 제 오행의 색을 입는다 */
export function DayMasterChip({ stem }: { stem: Stem }) {
  return (
    <View accessible accessibilityLabel={`일간 ${STEM_PICTURE[stem]}`} style={styles.chip}>
      <StemSymbol stem={stem} size={20} />
      <Text style={[styles.chipText, { color: ELEMENT_TONE[STEM_INFO[stem].element].ink }]}>{STEM_PICTURE[stem]}</Text>
    </View>
  );
}

type Pillar = { readonly stem: Stem; readonly branch: Branch } | null;

/** 네 기둥 띠 — 글자마다 제 오행의 색이고 일주 칸만 테로 짚는다. 시각을 모르면 그 칸은 비운다 */
export function PillarStrip({
  pillars,
  name,
  large = false,
}: {
  pillars: Record<(typeof PILLAR_COLUMNS)[number]['key'], Pillar>;
  name: string;
  large?: boolean;
}) {
  return (
    <View accessibilityLabel={`${name}의 네 기둥`} style={styles.strip}>
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const pillar = pillars[key];
        return (
          <View key={key} style={[styles.pillar, key === 'day' && styles.pillarDay]}>
            <Text style={styles.pillarLabel}>{label}</Text>
            {pillar === null ? (
              <Text accessibilityLabel={HOUR_UNKNOWN_LABEL} style={[styles.glyph, large && styles.glyphLarge, { color: COLOR.secondary }]}>
                ··
              </Text>
            ) : (
              <View style={large ? undefined : styles.pillarRow}>
                <Text style={[styles.glyph, large && styles.glyphLarge, { color: ELEMENT_TONE[STEM_INFO[pillar.stem].element].ink }]}>{pillar.stem}</Text>
                <Text style={[styles.glyph, large && styles.glyphLarge, { color: ELEMENT_TONE[BRANCH_INFO[pillar.branch].element].ink }]}>{pillar.branch}</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** 아래에서 뜨는 판 — 바깥을 누르면 닫힌다 */
export function Sheet({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel={label} onPress={onClose} style={styles.backdrop}>
        <Pressable onPress={() => undefined} style={styles.sheet}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SheetItem({ label, danger = false, onPress }: { label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.sheetItem}>
      <Text style={[styles.sheetItemText, danger && { color: COLOR.danger }]}>{label}</Text>
    </Pressable>
  );
}

/** 되돌릴 수 없는 누름 직전에 묻는 창 — 닫는 것은 「취소」다(`app/ui/confirm-dialog.tsx`) */
export function ConfirmDialog({
  title,
  body,
  irreversible,
  confirmLabel,
  busy,
  failure,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  irreversible: string;
  confirmLabel: string;
  busy: boolean;
  failure: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose} label="취소">
      <Text style={styles.section}>{title}</Text>
      <Text style={styles.noticeBody}>{body}</Text>
      <Text style={styles.noticeTitle}>{irreversible}</Text>
      {failure !== null && <FailureLine>{failure}</FailureLine>}
      <View style={styles.dialogActions}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={[styles.dialogButton, styles.dialogCancel]}>
          <Text style={styles.dialogCancelText}>취소</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={onConfirm} style={[styles.dialogButton, styles.dialogDanger, busy && styles.off]}>
          <Text style={styles.dialogDangerText}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const GLYPH_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'serif' });

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  back: { minHeight: CONTROL, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: 16 },
  backText: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.secondary },
  title: { fontSize: TYPE.title, lineHeight: 34, fontFamily: FONT.bold, color: COLOR.foreground },
  section: { fontSize: TYPE.heading, lineHeight: 28, fontFamily: FONT.bold, color: COLOR.foreground },
  name: { fontSize: TYPE.lead, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  body: { fontSize: TYPE.body, lineHeight: 23, fontFamily: FONT.medium, color: COLOR.secondary },
  bodyStrong: { fontFamily: FONT.bold, color: COLOR.foreground },
  meta: { fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.medium, color: COLOR.secondary },
  failureBox: { gap: 2 },
  failure: { fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.medium, color: COLOR.danger },
  notice: { gap: 4, padding: 16 },
  noticeTitle: { fontSize: TYPE.body, lineHeight: 22, fontFamily: FONT.bold, color: COLOR.foreground },
  noticeBody: { fontSize: TYPE.sm, lineHeight: 21, fontFamily: FONT.medium, color: COLOR.secondary },
  notFound: { gap: 6, paddingVertical: 40, alignItems: 'center' },
  notFoundActions: { alignSelf: 'stretch', gap: 8, marginTop: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4, paddingLeft: 4, paddingRight: 10, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255, 253, 249, 0.72)' },
  chipText: { fontSize: TYPE.fine, fontFamily: FONT.bold },
  strip: { flexDirection: 'row', gap: 6 },
  pillar: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4, paddingTop: 4, paddingBottom: 6, borderRadius: 10, backgroundColor: 'rgba(255, 253, 249, 0.78)' },
  pillarDay: { borderWidth: 2, borderColor: 'rgba(38, 36, 31, 0.22)' },
  pillarLabel: { fontSize: 11, fontFamily: FONT.bold, color: COLOR.secondary },
  pillarRow: { flexDirection: 'row' },
  glyph: { fontSize: TYPE.lead, lineHeight: 22, fontWeight: '600', fontFamily: GLYPH_FONT, textAlign: 'center' },
  glyphLarge: { fontSize: TYPE.title, lineHeight: 32 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(38, 36, 31, 0.4)' },
  sheet: { gap: 10, padding: 20, paddingBottom: 32, borderTopLeftRadius: RADIUS.panel, borderTopRightRadius: RADIUS.panel, backgroundColor: COLOR.surface },
  sheetItem: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  sheetItemText: { fontSize: TYPE.field, fontFamily: FONT.bold, color: COLOR.foreground },
  dialogActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  dialogButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill },
  dialogCancel: { borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  dialogCancelText: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  dialogDanger: { backgroundColor: COLOR.danger },
  dialogDangerText: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.onAccent },
  off: { opacity: 0.55 },
});
