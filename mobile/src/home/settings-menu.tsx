import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SIGN_OUT_PENDING } from '@account/copy';
import { GUIDE_LINKS } from '@brand/links';

import { signOut } from '@/auth/sign-in';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { SheetPanel } from '@/ui/surfaces';

const LINKS = [
  { href: '/me/profile', label: '프로필' },
  { href: '/me/settings', label: '설정' },
  { href: '/me/survey', label: '서비스 설문' },
] as const;

/**
 * 톱니 안 — 프로필 · 설정 · 서비스 설문 · 로그아웃은 웹의 머리글과 같다. 안내 다섯은 앱 안의 화면으로 간다(글의 원본은 웹과 같은 `src/lib` 다).
 */
export function SettingsMenu({ email, open, onClose }: { email: string | null; open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [leaving, setLeaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const leave = async () => {
    setFailure(null);
    setLeaving(true);
    const left = await signOut();
    setLeaving(false);
    if (left) onClose();
    else setFailure('로그아웃하지 못했어요. 다시 시도해 주세요.');
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="닫기" style={styles.backdrop} onPress={onClose} />
      <SheetPanel style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <ScrollView>
          {email !== null && <Text style={styles.email}>{email}</Text>}
          {LINKS.map((link) => (
            <Pressable
              key={link.href}
              accessibilityRole="link"
              onPress={() => {
                onClose();
                router.push(link.href as never);
              }}
              style={styles.row}
            >
              <Text style={styles.label}>{link.label}</Text>
            </Pressable>
          ))}
          <View style={styles.group}>
            {GUIDE_LINKS.map((link) => (
              <Pressable
                key={link.href}
                accessibilityRole="link"
                onPress={() => {
                  onClose();
                  router.push(link.href as never);
                }}
                style={styles.row}
              >
                <Text style={styles.guide}>{link.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.group}>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: leaving }} disabled={leaving} onPress={leave} style={styles.row}>
              <Text style={styles.guide}>{leaving ? SIGN_OUT_PENDING : '로그아웃'}</Text>
            </Pressable>
          </View>
          {failure !== null && <Text style={styles.failure}>{failure}</Text>}
        </ScrollView>
      </SheetPanel>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(38, 36, 31, 0.35)' },
  sheet: { maxHeight: '80%', paddingHorizontal: 16, paddingTop: 16, backgroundColor: COLOR.surface },
  email: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.muted, paddingHorizontal: 4, paddingBottom: 8 },
  group: { marginTop: 4, borderTopWidth: 1, borderTopColor: COLOR.border },
  row: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  label: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  guide: { fontFamily: FONT.medium, fontSize: TYPE.body, color: COLOR.secondary },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.danger, padding: 4 },
});
