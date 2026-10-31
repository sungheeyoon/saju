import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useRef } from 'react';

import { ErrorScreen } from '@/ui/error-screen';
import { COLOR, FONT } from '@/ui/tokens';

/* 화면이 그리다 던지면 — 스택은 그대로 두고 그 화면 자리에 선다. 아래 레이아웃들이 이어받는다 */
export const unstable_settings = { screenErrorBoundary: ErrorScreen };

/* 일부러 어긴 줄 — 차선의 세 검사가 붉은 것을 본 뒤 걷는다 */
export const deliberateTypeError: number = 'not a number';
export const deliberateBundleError = () => require('./no-such-file');
export function useDeliberateLintError() {
  const held = useRef(0);
  return held.current;
}

export default function RootLayout() {
  const [loaded, failed] = useFonts({
    [FONT.medium]: require('../../assets/fonts/BusanDandiMyeongjoM.otf'),
    [FONT.bold]: require('../../assets/fonts/BusanDandiMyeongjoB.otf'),
  });

  /* 글꼴을 못 받아도 화면은 선다 — 기기 서체로 그려진다 */
  if (!loaded && failed === null) return null;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLOR.background } }} />;
}
