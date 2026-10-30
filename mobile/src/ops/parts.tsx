import { router, usePathname, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OPERATOR_LINKS } from '@ops/links';
import { SIGN_IN_AGAIN_NOTE } from '@sign-in-again';

import { Logo } from '@/ui/logo';
import { Panel, PrimaryButton, SecondaryButton, TextButton } from '@/ui/parts';
import { COLOR, CONTROL, FONT, RADIUS, TYPE } from '@/ui/tokens';

import { passageOf, type Denied, type DeniedAction, type RefusedTarget } from './denial';

export const go = (href: string): void => router.push(href as Href);

/**
 * 운영 화면 하나의 읽기 — 머리에서 두 번째 요소를 보고(aal2 가 아니면 문을 안 부른다), 문을 청해 거절이면 없는 화면이 된다(ADR 0209 · 0103).
 * 길(`OpsShell`)은 문이 답한 뒤에만 선다 — 운영자가 아닌 사람 앞에는 운영 머리가 비치지 않는다.
 */
export type OpsRead<T> =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'absent' }
  | { readonly kind: 'ready'; readonly value: T; readonly reload: () => void };

export function useOpsRead<T>(action: DeniedAction, back: string, load: () => Promise<Denied | T>, target: RefusedTarget = {}): OpsRead<T> {
  const [state, setState] = useState<{ kind: 'waiting' } | { kind: 'absent' } | { kind: 'ready'; value: T }>({ kind: 'waiting' });
  const [turn, setTurn] = useState(0);
  const reload = useCallback(() => setTurn((was) => was + 1), []);
  const reportId = target.reportId;

  useEffect(() => {
    let live = true;
    void (async () => {
      const passage = await passageOf(action, back, reportId === undefined ? {} : { reportId });
      if (!live) return;
      if (passage.kind === 'out') router.replace('/');
      else if (passage.kind === 'challenge') router.replace(passage.href as Href);
      else if (passage.kind === 'absent') setState({ kind: 'absent' });
      else {
        try {
          const answered = await load();
          if (live) setState(answered === 'denied' ? { kind: 'absent' } : { kind: 'ready', value: answered as T });
        } catch (thrown) {
          /* 못 읽으면 지나가지 않는다 */
          console.error(action, thrown);
          if (live) setState({ kind: 'absent' });
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [action, back, reportId, turn, load]);

  return state.kind === 'ready' ? { kind: 'ready', value: state.value, reload } : state;
}

/** 운영자가 아닌 사람 앞의 화면 — 없는 주소와 같은 글자다(웹 `app/not-found.tsx`) */
export function OpsAbsent() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.absent}>
        <Text style={styles.title}>페이지를 찾을 수 없어요</Text>
        <Text style={styles.note}>주소가 잘못되었거나 페이지가 이동되었을 수 있어요.</Text>
        <PrimaryButton label="홈으로" onPress={() => router.replace('/')} />
      </View>
    </SafeAreaView>
  );
}

/** 읽는 동안은 판만 — 안 된다는 말과 자료가 번갈아 비치지 않게 */
export const OpsWaiting = () => <SafeAreaView style={styles.screen} />;

/** 운영 머리와 본문 — 웹의 `OpsHeader` */
export function OpsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="link" onPress={() => router.replace('/')}>
          <Logo size={28} />
        </Pressable>
        <Text style={styles.badge}>운영</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.links}>
          {OPERATOR_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Pressable key={link.href} accessibilityRole="link" onPress={() => router.replace(link.href as Href)} style={[styles.link, active && styles.linkOn]}>
                <Text style={[styles.linkText, active && styles.linkTextOn]}>{link.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function PageHead({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.pageHead}>
      <Text style={styles.eyebrow}>운영</Text>
      <Text style={styles.title}>{title}</Text>
      {note !== undefined && <Text style={styles.note}>{note}</Text>}
    </View>
  );
}

export const SectionTitle = ({ children }: { children: ReactNode }) => <Text style={styles.section}>{children}</Text>;
export const Note = ({ children }: { children: ReactNode }) => <Text style={styles.note}>{children}</Text>;
export const Fine = ({ children }: { children: ReactNode }) => <Text style={styles.fine}>{children}</Text>;
export const Body = ({ children }: { children: ReactNode }) => <Text style={styles.body}>{children}</Text>;
export const Strong = ({ children }: { children: ReactNode }) => <Text style={styles.strong}>{children}</Text>;
/** 계정 id · 주문 번호 — 길게 눌러 긁는다. 앱에는 복사 패키지가 없다 */
export const Mono = ({ children }: { children: ReactNode }) => (
  <Text selectable style={styles.mono}>
    {children}
  </Text>
);
export const Tag = ({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'strong' | 'danger' }) => (
  <Text style={[styles.tag, tone === 'strong' && styles.tagStrong, tone === 'danger' && styles.tagDanger]}>{children}</Text>
);
export const Tags = ({ children }: { children: ReactNode }) => <View style={styles.tags}>{children}</View>;

/** 이름과 값 한 줄 — 웹의 `dt` · `dd` */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      {typeof children === 'string' ? <Text selectable style={styles.factValue}>{children}</Text> : <View style={styles.factBody}>{children}</View>}
    </View>
  );
}

/** 웹의 `FailureLine` — 읽기 실패에는 「다시 시도하기」, 다시 로그인이 답인 문장에는 달지 않는다(다시 받아도 같은 거절이다) */
export function FailureLine({ children, onRetry }: { children: string; onRetry?: () => void }) {
  return (
    <View accessibilityRole="alert" style={styles.failure}>
      <Text style={styles.failureText}>{children}</Text>
      {onRetry !== undefined && children !== SIGN_IN_AGAIN_NOTE && <TextButton label="다시 시도하기" onPress={onRetry} />}
    </View>
  );
}

export const DoneNote = ({ children }: { children: string | null }) => (children ? <Text style={styles.done}>{children}</Text> : null);

/** 찾는 칸 — 칸 곁에 단추 하나 */
export function SearchRow({
  label,
  value,
  onChange,
  onSubmit,
  button,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  button: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.factLabel}>{label}</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, styles.searchInput]}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          placeholder={placeholder}
          placeholderTextColor={COLOR.muted}
          maxLength={maxLength}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
        />
        <SecondaryButton label={button} onPress={onSubmit} />
      </View>
    </View>
  );
}

/** 여러 줄 칸과 글자 수 */
export function NoteField({ label, value, onChange, max, hint }: { label: string; value: string; onChange: (next: string) => void; max: number; hint: string }) {
  return (
    <View style={styles.group}>
      <Text style={styles.factLabel}>{label}</Text>
      <TextInput
        style={[styles.input, styles.area]}
        accessibilityLabel={label}
        multiline
        value={value}
        onChangeText={onChange}
        maxLength={max}
        textAlignVertical="top"
      />
      <View style={styles.between}>
        <View style={styles.grow}>
          <Fine>{hint}</Fine>
        </View>
        <Fine>
          {value.length}/{max}
        </Fine>
      </View>
    </View>
  );
}

/** 글을 적는 한 줄 칸 */
export function LineField({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
  return (
    <View style={styles.group}>
      <Text style={styles.factLabel}>{label}</Text>
      <TextInput style={styles.input} accessibilityLabel={label} value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="off" />
    </View>
  );
}

/** 고르는 칸 — 글자가 길어 줄을 넘긴다 */
export function Pick<T extends string | number>({ label, value, options, onPick }: { label?: string; value: T; options: readonly { value: T; label: string }[]; onPick: (next: T) => void }) {
  return (
    <View style={styles.group}>
      {label !== undefined && <Text style={styles.factLabel}>{label}</Text>}
      <View style={styles.pills}>
        {options.map((option) => {
          const chosen = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen }}
              onPress={() => onPick(option.value)}
              style={[styles.pill, chosen && styles.pillOn]}
            >
              <Text style={[styles.pillText, chosen && styles.pillTextOn]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function DangerButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.danger, disabled && styles.off]}>
      <Text style={styles.dangerText}>{label}</Text>
    </Pressable>
  );
}

/** 글자 링크 — 줄 안의 번호 · 「회원 열기」 */
export function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.linkLine}>
      <Text selectable style={styles.linkLineText}>{label}</Text>
    </Pressable>
  );
}

/** 웹의 `ConfirmDialog` — 대상 · 값을 다시 보이고 실행명 단추로 낸다 */
export function ConfirmSheet({
  open,
  title,
  confirmLabel,
  cancelLabel = '취소',
  onConfirm,
  onClose,
  danger = false,
  busy = false,
  failure = null,
  children,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
  busy?: boolean;
  failure?: string | null;
  children: ReactNode;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Panel style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            <Text style={styles.section}>{title}</Text>
            {children}
            {failure !== null && <FailureLine>{failure}</FailureLine>}
          </ScrollView>
          <View style={styles.sheetActions}>
            {danger ? <DangerButton label={confirmLabel} onPress={onConfirm} disabled={busy} /> : <PrimaryButton label={confirmLabel} onPress={onConfirm} disabled={busy} />}
            <SecondaryButton label={cancelLabel} onPress={onClose} disabled={busy} />
          </View>
        </Panel>
      </View>
    </Modal>
  );
}

/** 처리 중의 두 번째 누름은 버린다 — 웹의 `useOneAtATime` */
export function useOneAtATime(): { saving: boolean; run: (work: () => Promise<void>) => void } {
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const run = useCallback((work: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    void work().finally(() => {
      busy.current = false;
      setSaving(false);
    });
  }, []);
  return { saving, run };
}

/** 값 한 칸을 크게 — 오늘의 숫자 · 설문의 수 */
export function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.figureValue}>{value}</Text>
      {note !== undefined && <Fine>{note}</Fine>}
    </View>
  );
}
export const Figures = ({ children }: { children: ReactNode }) => <View style={styles.figures}>{children}</View>;

/** 수량 막대 한 줄 — 설문의 아쉬운 점 · 고른 것 */
export function Bar({ label, count, most }: { label: string; count: number; most: number }) {
  return (
    <View style={styles.bar}>
      <View style={styles.between}>
        <View style={styles.grow}>
          <Fine>{label}</Fine>
        </View>
        <Fine>{count}</Fine>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round((count / most) * 100)}%` }]} />
      </View>
    </View>
  );
}

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export const SPACE = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  stack: { gap: 8 },
  line: { gap: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLOR.border },
  sunken: { gap: 8, padding: 14, borderRadius: RADIUS.control, backgroundColor: COLOR.surfaceSunken },
  chosen: { gap: 8, padding: 14, borderRadius: RADIUS.control, borderWidth: 1, borderColor: COLOR.accent, backgroundColor: COLOR.accentWash },
  plain: { gap: 8, padding: 14, borderRadius: RADIUS.control, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surfaceSoft },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  absent: { flex: 1, justifyContent: 'center', gap: 12, padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, minHeight: 56, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  badge: { overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: COLOR.foreground, color: COLOR.background, fontSize: TYPE.fine, fontFamily: FONT.bold },
  links: { alignItems: 'center', gap: 4 },
  link: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: RADIUS.pill },
  linkOn: { backgroundColor: COLOR.surfaceSunken },
  linkText: { fontSize: TYPE.sm, fontFamily: FONT.bold, color: COLOR.secondary },
  linkTextOn: { color: COLOR.foreground },
  content: { flexGrow: 1, padding: 16, gap: 16 },
  pageHead: { gap: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  eyebrow: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.creamInk },
  title: { fontSize: TYPE.title, lineHeight: 34, fontFamily: FONT.bold, color: COLOR.foreground },
  section: { fontSize: TYPE.field, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  note: { fontSize: TYPE.sm, lineHeight: 21, fontFamily: FONT.medium, color: COLOR.secondary },
  fine: { fontSize: TYPE.fine, lineHeight: 18, fontFamily: FONT.medium, color: COLOR.muted },
  body: { fontSize: TYPE.sm, lineHeight: 21, fontFamily: FONT.medium, color: COLOR.foreground },
  strong: { fontFamily: FONT.bold, color: COLOR.foreground },
  mono: { fontFamily: MONO, fontSize: TYPE.fine, lineHeight: 18, color: COLOR.secondary },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: COLOR.surfaceSunken, color: COLOR.secondary, fontSize: TYPE.fine, fontFamily: FONT.bold },
  tagStrong: { backgroundColor: COLOR.foreground, color: COLOR.background },
  tagDanger: { backgroundColor: COLOR.warningWash, color: COLOR.danger },
  fact: { gap: 2 },
  factLabel: { fontSize: TYPE.fine, fontFamily: FONT.bold, color: COLOR.muted },
  factValue: { fontSize: TYPE.sm, lineHeight: 21, fontFamily: FONT.medium, color: COLOR.foreground },
  factBody: { gap: 2 },
  failure: { gap: 2 },
  failureText: { fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.medium, color: COLOR.danger },
  done: { fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.bold, color: COLOR.creamInk },
  group: { gap: 6 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, minWidth: 0 },
  input: {
    minHeight: CONTROL,
    paddingHorizontal: 14,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    borderColor: COLOR.borderStrong,
    backgroundColor: COLOR.surface,
    fontFamily: FONT.medium,
    fontSize: TYPE.field,
    color: COLOR.foreground,
  },
  area: { minHeight: 96, paddingVertical: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  grow: { flex: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surfaceSoft },
  pillOn: { borderColor: COLOR.accent, backgroundColor: COLOR.accent },
  pillText: { fontSize: TYPE.sm, fontFamily: FONT.medium, color: COLOR.secondary },
  pillTextOn: { fontFamily: FONT.bold, color: COLOR.onAccent },
  danger: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.danger },
  dangerText: { fontSize: TYPE.field, fontFamily: FONT.bold, color: COLOR.onAccent },
  off: { opacity: 0.55 },
  linkLine: { minHeight: 32, justifyContent: 'center' },
  linkLineText: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.accent, textDecorationLine: 'underline' },
  scrim: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(38, 36, 31, 0.45)' },
  sheet: { maxHeight: '90%', gap: 12 },
  sheetBody: { gap: 10 },
  sheetActions: { gap: 8 },
  figures: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  figure: { width: '50%', gap: 2 },
  figureValue: { fontSize: TYPE.heading + 4, lineHeight: 32, fontFamily: FONT.bold, color: COLOR.foreground },
  bar: { gap: 4 },
  track: { height: 8, borderRadius: RADIUS.pill, backgroundColor: COLOR.track, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: COLOR.accent },
});
