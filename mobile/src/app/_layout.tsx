import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';

import { COLOR, FONT } from '@/ui/tokens';

export default function RootLayout() {
  const [loaded, failed] = useFonts({
    [FONT.medium]: require('../../assets/fonts/BusanDandiMyeongjoM.otf'),
    [FONT.bold]: require('../../assets/fonts/BusanDandiMyeongjoB.otf'),
  });

  /* 글꼴을 못 받아도 화면은 선다 — 기기 서체로 그려진다 */
  if (!loaded && failed === null) return null;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLOR.background } }} />;
}
