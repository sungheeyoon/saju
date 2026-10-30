import { Stack } from 'expo-router';

import { COLOR } from '@/ui/tokens';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLOR.background } }} />;
}
