import { useLocalSearchParams } from 'expo-router';

import { SharedReadingScreen } from '@/share/view';

export default function SharedCompatReading() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <SharedReadingScreen token={token} expect="private" />;
}
