import { router, useLocalSearchParams } from 'expo-router';

import { SIGNED_OUT_EXIT, SIGNED_OUT_REACH } from '@brand/guide';
import { withReturnPath } from '@consent/return-path';

import { goHome } from '@/info/go-home';
import { NoticeLine, NoticeNote, NoticeScreen } from '@/ui/notice-screen';
import { PrimaryButton, SecondaryButton } from '@/ui/parts';

/** 로그인이 끝나지 못한 자리 — 웹의 `/auth/denied`. 왜인지 모른다고 말하는 것이 정직한 말의 전부다. 「다시 로그인」은 가려던 곳을 그대로 들고 간다 */
export default function DeniedScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  return (
    <NoticeScreen
      title="로그인하지 못했어요"
      description={<NoticeLine>구글 로그인을 마치지 못했어요. 중간에 취소했거나 연결이 끊겼을 수 있어요. 아래 「다시 로그인」을 눌러 주세요.</NoticeLine>}
      actions={
        <>
          <PrimaryButton label="다시 로그인" onPress={() => router.replace(withReturnPath('/auth', next) as never)} />
          <SecondaryButton label={SIGNED_OUT_EXIT} onPress={() => void goHome()} />
        </>
      }
      note={<NoticeNote>{SIGNED_OUT_REACH}</NoticeNote>}
    />
  );
}
