import { Image } from 'expo-image';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Modal, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { settled } from '@/ui/settled';

import { photoSource, type MyPhoto } from './photos';

export const PHOTO_MENU_LABEL = '사진 메뉴';
const SWIPE_PX = 48;

export type PhotoChoice = { label: string; tone?: 'danger'; run: () => void };

/**
 * 사진 크게 보기 — 웹 `photo-viewer.tsx` 와 같은 꼴: 검은 전체 화면 · 왼쪽 위 × · 가운데 「2 / 3」 · 오른쪽 위 「⋯」, 좌우로 쓸어넘긴다.
 * 판에서 고르면 보기를 **먼저 닫고** 그 일을 한다 — iOS 는 닫히는 창 위에 다음 창을 못 띄워 닫힌 뒤(`onDismiss`)에 한다.
 */
export function PhotoViewer({
  userId,
  photos,
  at,
  onAt,
  onClose,
  choicesFor,
}: {
  userId: string | null;
  photos: readonly MyPhoto[];
  at: number | null;
  onAt: (position: number) => void;
  onClose: () => void;
  choicesFor: (photo: MyPhoto, position: number) => PhotoChoice[];
}) {
  const [menu, setMenu] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const after = useRef<(() => void) | null>(null);
  const position = at ?? 1;
  const photo = at === null ? undefined : photos[position - 1];
  const total = photos.length;

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 사진이 바뀌면 앞 사진을 먼저 걷는다. 새 주소가 올 때까지 앞 사진을 새 번호로 보이지 않는다
    setSource(null);
    if (photo !== undefined) {
      void settled(photoSource(photo, userId ?? undefined), 'photoSource', () => null).then((next) => {
        if (live) setSource(next);
      });
    }
    return () => {
      live = false;
    };
  }, [photo, userId]);

  const latest = useRef({ position, total, onAt });
  useLayoutEffect(() => {
    latest.current = { position, total, onAt };
  });
  // eslint-disable-next-line react-hooks/refs -- 넘기는 손길 함수는 렌더 뒤 손가락이 닿을 때만 돌아 ref 를 읽는다. 규칙은 함수를 받는 쪽이 언제 부르는지 모른다
  const [swipe] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) < SWIPE_PX) return;
        const now = latest.current;
        const next = now.position + (gesture.dx < 0 ? 1 : -1);
        if (next >= 1 && next <= now.total) now.onAt(next);
      },
    }),
  );

  const dismissed = () => {
    const run = after.current;
    after.current = null;
    run?.();
  };

  const choose = (choice: PhotoChoice) => {
    setMenu(false);
    onClose();
    if (Platform.OS === 'ios') after.current = choice.run;
    else choice.run();
  };

  const choices = photo === undefined ? [] : choicesFor(photo, position);
  const quiet = choices.filter((one) => one.tone !== 'danger');
  const danger = choices.filter((one) => one.tone === 'danger');
  const row = (choice: PhotoChoice) => (
    <Pressable key={choice.label} accessibilityRole="button" onPress={() => choose(choice)} style={styles.choice}>
      <Text style={[styles.choiceText, choice.tone === 'danger' && styles.dangerText]}>{choice.label}</Text>
    </Pressable>
  );

  return (
    <Modal
      visible={photo !== undefined}
      animationType="fade"
      onDismiss={dismissed}
      onRequestClose={() => {
        if (menu) setMenu(false);
        else onClose();
      }}
    >
      <SafeAreaView style={styles.screen}>
        <View style={styles.head}>
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={styles.icon}>
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Path d="M6 6 L18 18 M18 6 L6 18" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>
          <View style={styles.count}>
            {position === 1 && <Text style={styles.lead}>대표</Text>}
            <Text style={styles.countText}>
              {position} / {total}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={PHOTO_MENU_LABEL} onPress={() => setMenu(true)} style={styles.icon}>
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Circle cx={5} cy={12} r={1.8} fill="#fff" />
              <Circle cx={12} cy={12} r={1.8} fill="#fff" />
              <Circle cx={19} cy={12} r={1.8} fill="#fff" />
            </Svg>
          </Pressable>
        </View>
        <View style={styles.stage} {...swipe.panHandlers}>
          {source !== null && <Image source={{ uri: source }} style={StyleSheet.absoluteFill} contentFit="contain" />}
        </View>
        {menu && (
          <View style={styles.scrim}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} accessibilityElementsHidden importantForAccessibility="no" />
            <View style={styles.sheet} accessibilityViewIsModal accessibilityLabel={PHOTO_MENU_LABEL}>
              <View style={styles.choices}>
                {quiet.map(row)}
                {danger.length > 0 && quiet.length > 0 && <View style={styles.rule} />}
                {danger.map(row)}
              </View>
              <Pressable accessibilityRole="button" onPress={() => setMenu(false)} style={styles.cancel}>
                <Text style={styles.cancelText}>취소</Text>
              </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  count: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lead: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#fff', color: '#000', fontSize: TYPE.fine, fontFamily: FONT.bold },
  countText: { color: '#fff', fontSize: TYPE.body, fontFamily: FONT.bold },
  stage: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: { gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, borderTopLeftRadius: RADIUS.panel, borderTopRightRadius: RADIUS.panel, backgroundColor: COLOR.background },
  choices: { padding: 6, borderRadius: RADIUS.panel, backgroundColor: COLOR.surface },
  choice: { minHeight: 56, justifyContent: 'center', paddingHorizontal: 16 },
  choiceText: { fontSize: TYPE.lead, fontFamily: FONT.bold, color: COLOR.foreground },
  dangerText: { color: COLOR.danger },
  rule: { height: 1, marginHorizontal: 12, marginVertical: 4, backgroundColor: COLOR.border },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  cancelText: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
});
