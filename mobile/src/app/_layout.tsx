import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';

import { ErrorScreen } from '@/ui/error-screen';
import { COLOR, FONT } from '@/ui/tokens';

/* 화면이 그리다 던지면 — 스택은 그대로 두고 그 화면 자리에 선다. 아래 레이아웃들이 이어받는다 */
export const unstable_settings = { screenErrorBoundary: ErrorScreen };

export default function RootLayout() {
  const [loaded, failed] = useFonts({
    [FONT.medium]: require('../../assets/fonts/BusanDandiMyeongjoM.otf'),
    [FONT.bold]: require('../../assets/fonts/BusanDandiMyeongjoB.otf'),
  });

  /* 글꼴을 못 받아도 화면은 선다 — 기기 서체로 그려진다 */
  if (!loaded && failed === null) return null;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLOR.background } }} />;
}
