import { router } from 'expo-router';
import { View } from 'react-native';

import { NoticeLine, NoticeScreen } from './notice-screen';
import { PrimaryButton, SecondaryButton } from './parts';

/**
 * 그리다 던진 화면 대신 서는 것 — 웹 `app/error-screen.tsx` 와 같은 글자다. **`error` 는 안 받는다** — 원문을 세우지 않는다.
 * 경계가 없으면 개발에서는 빨간 화면이 서고 운영 빌드에서는 앱이 꺼진다.
 */
export function ErrorScreen({ retry }: { retry: () => void }) {
  return (
    <NoticeScreen
      title="화면을 불러오지 못했어요"
      description={
        <View accessibilityRole="alert">
          <NoticeLine>잠시 후 다시 시도해 주세요.</NoticeLine>
        </View>
      }
      actions={
        <>
          <PrimaryButton label="다시 시도하기" onPress={retry} />
          <SecondaryButton label="홈으로" onPress={() => router.replace('/')} />
        </>
      }
    />
  );
}
