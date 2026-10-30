import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SERVICE_NAME } from '@brand';
import { SIGN_IN_UNLOCKS, SIGNED_OUT_EXIT } from '@brand/guide';
import { safeReturnPath, withReturnPath } from '@consent/return-path';

import { signInWithGoogle } from '@/auth/sign-in';
import { readGate } from '@/home/gate';
import { goHome } from '@/info/go-home';
import { Icon } from '@/ui/icons';
import { NoticeLine, NoticeScreen } from '@/ui/notice-screen';
import { PrimaryButton, TextButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

/**
 * 로그인 — 웹의 `/auth` 와 같은 글자이고 로그인은 네이티브 구글이다. 돌아갈 곳은 앱에 있는 `/me` 아래뿐이다 —
 * 웹의 두 갈래 제목(`/compat` · `/saju` 이어 보기)은 앱에 없는 주소에서 오는 말이라 세우지 않는다. 「로그인 없이도…」 줄도 앱에서는 사실이 아니라 뺀다. 실패와 취소는 로그인 실패 화면으로 간다.
 */
export default function SignInScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const returnTo = safeReturnPath(next);
  const destination = returnTo.startsWith('/me') ? returnTo : '/me';
  const [going, setGoing] = useState(false);

  useEffect(() => {
    let live = true;
    void readGate().then((gate) => {
      if (!live) return;
      if (gate.kind === 'in') router.replace(destination as never);
      else if (gate.kind === 'signup') router.replace('/signup');
    });
    return () => {
      live = false;
    };
  }, [destination]);

  const signIn = async () => {
    setGoing(true);
    const answer = await signInWithGoogle();
    setGoing(false);
    if (answer.kind === 'signed-in') router.replace(destination as never);
    else if (answer.kind === 'needs-signup') router.replace('/signup');
    else router.replace(withReturnPath('/auth/denied', destination) as never);
  };

  return (
    <NoticeScreen
      title={`${SERVICE_NAME} 시작하기`}
      description={
        <NoticeLine>
          로그인하면 저장한 사람과 사주풀이를 다음에도 이어서 볼 수 있어요.{' '}
          지금은 비공개 베타라, 처음 오셨다면 로그인 뒤에 <Text style={styles.strong}>테스트 코드</Text>가 필요해요.
        </NoticeLine>
      }
      actions={<PrimaryButton label={going ? '구글로 이동하는 중…' : '구글로 로그인'} onPress={signIn} disabled={going} />}
      note={
        <View style={styles.exit}>
          <TextButton label={SIGNED_OUT_EXIT} onPress={() => void goHome()} />
        </View>
      }
    >
      <View style={styles.unlocks}>
        {SIGN_IN_UNLOCKS.map(({ icon, text }) => (
          <View key={text} style={styles.unlock}>
            <View style={styles.unlockIcon}>
              <Icon name={icon} size={18} color={COLOR.creamInk} />
            </View>
            <Text style={styles.unlockText}>{text}</Text>
          </View>
        ))}
      </View>
    </NoticeScreen>
  );
}

const styles = StyleSheet.create({
  strong: { fontFamily: FONT.bold },
  unlocks: { gap: 10 },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unlockIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.surface },
  unlockText: { flex: 1, fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
  exit: { alignSelf: 'flex-start' },
});
