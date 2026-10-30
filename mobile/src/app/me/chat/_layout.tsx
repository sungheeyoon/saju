import { Stack } from 'expo-router';

import { COLOR } from '@/ui/tokens';

/** 채팅의 틀 — 폰의 방은 화면 전체다. 계정 채널은 앱 껍데기(`me/_layout.tsx`)에 선다 */
export default function ChatLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLOR.background } }} />;
}
