import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { initialOf, type PhotoFocus } from '@profile';
import type { Element } from '@saju';

import { Photo } from '@/ui/photo';
import { COLOR, CONTROL, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { SheetPanel, Tile } from '@/ui/surfaces';

import { ChatIcon } from './icons';

/** 시트 · 머리 단추의 보조기기 이름 — 웹의 `partnerSheetName` 과 같다 */
export const partnerSheetName = (nickname: string): string => `${nickname} 님 자세히`;

/**
 * 상대 · 내 프로필 시트 — 방의 스크롤 자리와 쓰던 글이 그대로 남는다(ADR 0155 덧). 몸은 사진 칸(세로 4:5) → 궁합 한 줄 → 소개다. 사진은 옆으로 넘긴다.
 * 없거나 못 받은 장에는 그 사람의 색과 첫 글자가 선다 — 웹이 사진 없는 사람에게 세우는 모양이다.
 */
export function ProfileSheet({
  nickname,
  intro,
  tone,
  photos = null,
  emptyPhoto,
  toMatch,
  menu,
  footer,
  onClose,
}: {
  nickname: string;
  intro: string | null;
  tone: Element | null;
  /** 장마다의 보일 자리 — 수가 곧 장 수다. 없으면 빈 목록 또는 `null` */
  photos?: { readonly userId: string; readonly focuses: readonly PhotoFocus[] } | null;
  /** 사진이 없을 때 빈 칸 위에 얹는 것 — 내 프로필의 「사진 추가」 */
  emptyPhoto?: ReactNode;
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
        <SheetPanel style={styles.sheet} accessibilityLabel={partnerSheetName(nickname)}>
        <SafeAreaView edges={['bottom']} style={styles.sheetSafe}>
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
            <PhotoFrame nickname={nickname} soft={scale.soft} ink={scale.ink} photos={photos} empty={emptyPhoto} />
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
        </SheetPanel>
      </View>
    </Modal>
  );
}

/** 세로 4:5 한 칸 — 장마다 쪽을 넘긴다. 사진이 없어도 같은 칸이다(`PROFILE_PHOTO_FRAME`) */
function PhotoFrame({
  nickname,
  soft,
  ink,
  photos,
  empty,
}: {
  nickname: string;
  soft: string;
  ink: string;
  photos: { readonly userId: string; readonly focuses: readonly PhotoFocus[] } | null;
  empty?: ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const focuses = photos?.focuses ?? [];
  const face = <Text style={[styles.initial, { color: ink }]}>{initialOf(nickname)}</Text>;

  return (
    <Tile tone={soft} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.photo}>
      {focuses.length === 0 && empty}
      {photos === null || focuses.length === 0 || width === 0 ? (
        face
      ) : (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
        >
          {focuses.map((focus, index) => (
            <View key={index} style={[styles.page, { width }]}>
              <Photo userId={photos.userId} size={width} fill variant="large" position={index + 1} focus={focus} fallback={face} />
            </View>
          ))}
        </ScrollView>
      )}
      {focuses.length > 1 && (
        <View style={styles.bars}>
          {focuses.map((_, index) => (
            <View key={index} style={[styles.bar, index === page && styles.barOn]} />
          ))}
        </View>
      )}
    </Tile>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(38, 36, 31, 0.45)' },
  outside: { ...StyleSheet.absoluteFill },
  sheet: { maxHeight: '90%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 20, paddingRight: 8, paddingTop: 8 },
  name: { flex: 1, fontSize: TYPE.lead, fontFamily: FONT.bold, color: COLOR.foreground },
  close: { minHeight: CONTROL, minWidth: CONTROL, alignItems: 'center', justifyContent: 'center' },
  body: { gap: 20, padding: 20, paddingTop: 8 },
  photo: { width: '100%', maxWidth: 340, aspectRatio: 4 / 5, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', padding: 0, overflow: 'hidden' },
  page: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  bars: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255, 253, 249, 0.45)' },
  barOn: { backgroundColor: COLOR.surface },
  initial: { fontSize: TYPE.figure * 2, fontFamily: FONT.bold },
  intro: { gap: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLOR.border },
  introHead: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.secondary },
  introBody: { fontSize: TYPE.body, lineHeight: 26, fontFamily: FONT.medium, color: COLOR.foreground },
  sheetSafe: { flexShrink: 1 },
});
