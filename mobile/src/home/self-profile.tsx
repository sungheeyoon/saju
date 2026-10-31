import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PHOTO_ADD } from '@account/copy';
import { MY_PROFILE_EDIT_LABEL } from '@chat/copy';
import { STEM_INFO, type Stem } from '@saju';

import { ProfileSheet } from '@/chat/profile-sheet';
import { Icon } from '@/ui/icons';
import { SecondaryButton } from '@/ui/parts';
import { Photo } from '@/ui/photo';
import { StemSymbol } from '@/ui/stem-symbol';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

import type { SelfFace } from './read';

/** 웹의 `app/me/home/self-profile.tsx` 와 같은 글자다 */
const MY_PROFILE_LABEL = '내 프로필';
const INTRO_PLACEHOLDER = '간단한 소개를 입력해 주세요';

/** 프로필 수정은 설정 영역의 주소다 — 시트를 닫고 간다 */
const toProfile = (close: () => void) => () => {
  close();
  router.push('/me/profile' as never);
};

/**
 * 홈의 동그란 내 프로필 — 56px 원, 사진이 없으면 일간 그림이다. 누르면 대화방과 같은 시트가 올라온다.
 * 소개가 비었으면 그 자리의 줄이, 아니면 맨 아래 「프로필 편집」이 프로필 수정 화면으로 간다.
 */
export function SelfProfile({ face, stem }: { face: SelfFace; stem: Stem }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const empty = face.intro === null || face.intro.trim() === '';

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={MY_PROFILE_LABEL} onPress={() => setOpen(true)} style={styles.circle}>
        <Photo userId={face.userId} size={56} hasPhoto={face.focuses.length > 0} focus={face.focuses[0]} fallback={<StemSymbol stem={stem} size={32} />} />
      </Pressable>
      {open && (
        <ProfileSheet
          nickname={face.nickname}
          intro={face.intro}
          tone={STEM_INFO[stem].element}
          photos={{ userId: face.userId, focuses: face.focuses }}
          emptyPhoto={
            <View style={styles.addPhoto}>
              <SecondaryButton label={PHOTO_ADD} onPress={toProfile(close)} />
            </View>
          }
          footer={
            <>
              {empty && (
                <Pressable accessibilityRole="link" onPress={toProfile(close)} style={styles.emptyIntro}>
                  <Text style={styles.emptyIntroText}>{INTRO_PLACEHOLDER}</Text>
                  <Icon name="chevron" size={16} color={COLOR.muted} />
                </Pressable>
              )}
              <SecondaryButton label={MY_PROFILE_EDIT_LABEL} onPress={toProfile(close)} />
            </>
          }
          onClose={close}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  circle: { width: 56, height: 56, borderRadius: RADIUS.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.surface },
  addPhoto: { position: 'absolute', bottom: 12, alignSelf: 'center' },
  emptyIntro: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  emptyIntroText: { flex: 1, fontFamily: FONT.medium, fontSize: TYPE.body, color: COLOR.muted },
});
