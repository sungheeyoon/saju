import { Stack } from 'expo-router';

import { COLOR } from '@/ui/tokens';

/** 운영 화면 — 진입 길이 없다(운영자인지 묻는 문을 안 연다, ADR 0103 · 0209). 막음은 화면마다 머리와 DB 의 문이다 */
export default function OpsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLOR.background } }} />;
}
