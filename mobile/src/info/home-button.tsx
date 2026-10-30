import { View } from 'react-native';

import { TextButton } from '@/ui/parts';

import { goHome } from './go-home';

/** 안내 화면 끝의 「처음으로」 */
export function HomeButton() {
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <TextButton label="처음으로" onPress={() => void goHome()} />
    </View>
  );
}
