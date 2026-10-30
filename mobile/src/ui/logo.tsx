import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { COLOR, ELEMENT_TONE } from './tokens';

/** 로고 — 웹의 `app/ui/logo.tsx` 와 같은 경로 값이다(궤도 지도, ADR 0149). 이름은 곁의 글자가 든다 */
export function Logo({ size = 32 }: { size?: number }) {
  const ink = COLOR.foreground;
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Circle cx="32" cy="32" r="24" fill="none" stroke={ink} strokeOpacity="0.45" strokeWidth="2" strokeDasharray="0.1 4.6" strokeLinecap="round" />
        <Path d="M32 32 L52.8 44" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        <Circle cx="32" cy="32" r="9.5" fill={ELEMENT_TONE.火.mid} stroke={ink} strokeWidth="2.4" />
        <Circle cx="32" cy="8" r="4" fill={ELEMENT_TONE.水.mid} stroke={ink} strokeWidth="1.8" />
        <Circle cx="52.8" cy="44" r="5.6" fill={ELEMENT_TONE.木.mid} stroke={ink} strokeWidth="2" />
        <Circle cx="13" cy="46.5" r="3.6" fill={ELEMENT_TONE.土.mid} stroke={ink} strokeWidth="1.6" />
      </Svg>
    </View>
  );
}
