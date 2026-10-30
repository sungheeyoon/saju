import { Stack } from 'expo-router';

import { LiveChannel } from '@/chat/live';
import { COLOR } from '@/ui/tokens';

/** 채팅의 틀 — 방과 목록이 듣는 계정 채널이 여기 선다. 폰의 방은 화면 전체다 */
export default function ChatLayout() {
  return (
    <>
      <LiveChannel />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLOR.background } }} />
    </>
  );
}
