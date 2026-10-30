import { useLocalSearchParams } from 'expo-router';

import { SharedReadingScreen } from '@/share/view';

export default function SharedPersonReading() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <SharedReadingScreen token={token} expect="person" />;
}
