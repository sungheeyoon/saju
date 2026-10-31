import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { isBlocked } from '@account/index';
import { SIGN_OUT_PENDING } from '@account/copy';
import { OPTIONAL_CONSENT_NOTE } from '@consent/notice';
import { asKoreanDay, noticeAckHolds } from '@consent/index';
import { initialOf } from '@profile';

import { signOut } from '@/auth/sign-in';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { settled } from '@/ui/settled';
import { TopBar } from '@/ui/top-bar';

import { ConsentControls } from './consent-controls';
import { ParticipationRow, PreferenceRow } from './discovery-rows';
import { RequestDeletion } from './leaving';
import { AccountNotice, FailureLine, LinkRow, SettingsGroup, TextRow } from './parts';
import { myPhotos, photoSource } from './photos';
import { readSettings, settingsUnreachable, type SettingsData } from './settings';

const SIGN_OUT_FAILED = '로그아웃하지 못했어요. 다시 시도해 주세요.';

/**
 * 설정 — 웹 `app/me/settings/view.tsx` 와 같은 차례다: 나 → 인연 → 동의 → 계정 → 탈퇴하기. 자주 바꾸는 것이 위, 되돌리기 어려운 것이 맨 아래.
 * 알림 무리는 없다 — 푸시는 옮기지 않는다. 프로필에서 돌아오면 이름 · 사진이 바뀌었을 수 있어 화면에 설 때마다 다시 읽는다.
 */
export function SettingsScreen() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [face, setFace] = useState<string | null>(null);

  const load = useCallback(() => {
    void settled(readSettings(), 'readSettings', settingsUnreachable).then(setData);
    /* 사진이 없거나 못 읽었으면 첫 글자가 선다 — 첫 글자는 사진이 있는 사람에게 거짓말이 아니라 자리다(웹 `Avatar`) */
    void settled(
      myPhotos().then((photos) => (photos[0] === undefined ? null : photoSource(photos[0]))),
      'myPhotos',
      () => null,
    ).then(setFace);
  }, []);
  useFocusEffect(load);

  if (data === null) {
    return (
      <View style={styles.screen}>
        <TopBar title="설정" fallback="/me" />
      </View>
    );
  }

  const { state, account, discovery, email } = data;
  const active = state.kind === 'active';

  return (
    <View style={styles.screen}>
      <TopBar title="설정" fallback="/me" />
      <ScrollView contentContainerStyle={styles.content}>
        {isBlocked(state) && (
          <View style={styles.notice}>
            <AccountNotice state={state} onRetry={load} />
          </View>
        )}

        {active && account !== null && (
          <SettingsGroup>
            <LinkRow
              big
              label={account.nickname ?? '내 프로필'}
              help={email}
              onPress={() => router.push('/me/profile' as never)}
              leading={
                face !== null ? (
                  <Image source={{ uri: face }} style={styles.face} contentFit="cover" />
                ) : (
                  <View style={styles.face}>
                    <Text style={styles.initial}>{initialOf(account.nickname ?? '')}</Text>
                  </View>
                )
              }
            />
          </SettingsGroup>
        )}

        {active && (
          <SettingsGroup title="인연">
            {discovery.ok ? (
              <>
                <ParticipationRow resting={discovery.optedOut} />
                <PreferenceRow key={discovery.preferGender} current={discovery.preferGender} />
              </>
            ) : (
              <FailureLine inset onRetry={load}>{`인연 찾기 설정을 불러오지 못했어요. ${discovery.reason}`}</FailureLine>
            )}
          </SettingsGroup>
        )}

        {active && account !== null && (
          <SettingsGroup title="선택 동의" description={OPTIONAL_CONSENT_NOTE}>
            <ConsentControls key={`${account.improvement_consent}-${account.contact_consent}`} improvement={account.improvement_consent === true} contact={account.contact_consent === true} />
            <PrivacyRow ackAt={account.notice_ack_at} version={account.notice_version} />
          </SettingsGroup>
        )}

        <SettingsGroup title="계정">
          {!active && email !== undefined && <Text style={styles.email}>{email}</Text>}
          <SignOutRow />
        </SettingsGroup>

        {active && <RequestDeletion onDone={load} />}
      </ScrollView>
    </View>
  );
}

/** 처리 안내 — 전문은 앱의 `/privacy` 다 */
function PrivacyRow({ ackAt, version }: { ackAt: string | null; version: string | null }) {
  const label = '개인정보 처리 안내';
  const help = ackAt === null ? '아직 확인하지 않았어요.' : `${asKoreanDay(ackAt.slice(0, 10))}에 확인했어요.`;
  const note = !noticeAckHolds(version) ? '안내가 바뀌어 다시 보여 드려요.' : undefined;
  return <LinkRow label={label} help={help} note={note} onPress={() => router.push('/privacy' as never)} />;
}

function SignOutRow() {
  const [leaving, setLeaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const leave = async () => {
    setLeaving(true);
    setFailed(false);
    const left = await signOut();
    setLeaving(false);
    if (left) router.replace('/');
    else setFailed(true);
  };
  return (
    <>
      <TextRow label={leaving ? SIGN_OUT_PENDING : '로그아웃'} onPress={() => void leave()} disabled={leaving} />
      {failed && <FailureLine inset>{SIGN_OUT_FAILED}</FailureLine>}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.surfaceSunken },
  content: { gap: 16, paddingTop: 12, paddingBottom: 40 },
  notice: { paddingHorizontal: 16 },
  face: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.cream },
  initial: { fontSize: TYPE.heading, fontFamily: FONT.bold, color: COLOR.creamInk },
  email: { paddingHorizontal: 24, paddingVertical: 12, fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
});
