import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { initialOf } from '@profile';
import type { Element } from '@saju';

import { COLOR, CONTROL, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';

import { ChatIcon } from './icons';

/** 시트 · 머리 단추의 보조기기 이름 — 웹의 `partnerSheetName` 과 같다 */
export const partnerSheetName = (nickname: string): string => `${nickname} 님 자세히`;

/**
 * 상대 · 내 프로필 시트 — 방의 스크롤 자리와 쓰던 글이 그대로 남는다(ADR 0155 덧). 몸은 사진 칸(세로 4:5) → 궁합 한 줄 → 소개다. 사진 칸에는 그 사람의 색과
 * 첫 글자가 선다 — 웹이 사진 없는 사람에게 세우는 모양이고, 앱은 사진 문이 아직 없다.
 */
export function ProfileSheet({
  nickname,
  intro,
  tone,
  photo,
  toMatch,
  menu,
  footer,
  onClose,
}: {
  nickname: string;
  intro: string | null;
  tone: Element | null;
  /** 사진 칸 위에 얹는 것 — 사진이나 「사진 추가」. 없으면 색과 첫 글자만 선다 */
  photo?: ReactNode;
  toMatch?: ReactNode;
  menu?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  const shown = intro !== null && intro.trim() !== '' ? intro : null;
  const scale = tone === null ? { ink: COLOR.none, soft: COLOR.noneSoft } : ELEMENT_TONE[tone];
  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.back}>
        <Pressable style={styles.outside} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheet} accessibilityLabel={partnerSheetName(nickname)}>
          <View style={styles.head}>
            <Text accessibilityRole="header" numberOfLines={1} style={styles.name}>
              {nickname}
            </Text>
            {menu}
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={styles.close}>
              <ChatIcon name="close" color={COLOR.foreground} size={20} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <View style={[styles.photo, { backgroundColor: scale.soft }]}>
              <Text style={[styles.initial, { color: scale.ink }]}>{initialOf(nickname)}</Text>
              {photo}
            </View>
            {toMatch}
            {shown !== null && (
              <View style={styles.intro}>
                <Text style={styles.introHead}>소개</Text>
                <Text style={styles.introBody}>{shown}</Text>
              </View>
            )}
            {footer}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(38, 36, 31, 0.45)' },
  outside: { ...StyleSheet.absoluteFill },
  sheet: { maxHeight: '90%', borderTopLeftRadius: RADIUS.panel, borderTopRightRadius: RADIUS.panel, backgroundColor: COLOR.background },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 20, paddingRight: 8, paddingTop: 8 },
  name: { flex: 1, fontSize: TYPE.lead, fontFamily: FONT.bold, color: COLOR.foreground },
  close: { minHeight: CONTROL, minWidth: CONTROL, alignItems: 'center', justifyContent: 'center' },
  body: { gap: 20, padding: 20, paddingTop: 8 },
  photo: { width: '100%', maxWidth: 340, aspectRatio: 4 / 5, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.panel },
  initial: { fontSize: TYPE.figure * 2, fontFamily: FONT.bold },
  intro: { gap: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLOR.border },
  introHead: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.secondary },
  introBody: { fontSize: TYPE.body, lineHeight: 26, fontFamily: FONT.medium, color: COLOR.foreground },
});
