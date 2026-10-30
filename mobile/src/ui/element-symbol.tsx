import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import type { Element } from '@saju';

import { COLOR, ELEMENT_TONE } from './tokens';

/**
 * 오행 상징 다섯과 모를 때의 물음표 원 — 웹의 `app/ui/element-symbol.tsx` 와 같은 경로 값이다.
 * 그림이 이름을 대신하지 않아 낭독기에서 숨고, 곁에 이름이 함께 선다.
 */
export function ElementSymbol({ element, size = 24 }: { element: Element | null; size?: number }) {
  const ink = element === null ? COLOR.none : ELEMENT_TONE[element].ink;
  const mid = element === null ? COLOR.noneMid : ELEMENT_TONE[element].mid;
  const filled = { fill: mid, stroke: ink, strokeWidth: 1.5 };

  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <G strokeLinecap="round" strokeLinejoin="round">
          {element === '木' && (
            <>
              <Path d="M12 21V11" stroke={ink} strokeWidth="1.8" fill="none" />
              <Path d="M12 13c-4.5 0-7-2.6-7-7 4.4 0 7 2.5 7 7Z" {...filled} />
              <Path d="M12 11c0-4.2 2.4-7 7-7 0 4.6-2.6 7-7 7Z" {...filled} />
            </>
          )}
          {element === '火' && (
            <Path
              d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.2 2.2-5 3.4-7.6.6 1.6 1.4 2.5 2.4 2.9C11.2 7 12.6 4.6 14.8 3c-.3 3 1.4 4.8 2.6 6.6 1 1.4 1.6 3 1.6 4.9 0 3.9-2.9 6.5-7 6.5Z"
              {...filled}
            />
          )}
          {element === '土' && (
            <>
              <Path d="M2.5 18.5 9 9.5l3.2 4.2 2.6-3.2 6.7 8Z" {...filled} />
              <Path d="M2.5 21h19" stroke={ink} strokeWidth="1.6" fill="none" />
            </>
          )}
          {element === '金' && (
            <>
              <Path d="M6.5 4h11l4 5.5L12 21 2.5 9.5Z" {...filled} />
              <Path d="M2.5 9.5h19M9 4l3 5.5L15 4M12 9.5V21" stroke={ink} strokeWidth="1.2" fill="none" />
            </>
          )}
          {element === '水' && (
            <>
              <Path d="M12 3c3.4 4.2 6.2 7.7 6.2 11.2A6.2 6.2 0 0 1 5.8 14.2C5.8 10.7 8.6 7.2 12 3Z" {...filled} />
              <Path d="M9 14.5a3 3 0 0 0 3 3" stroke={ink} strokeWidth="1.4" fill="none" />
            </>
          )}
          {element === null && (
            <>
              <Circle cx="12" cy="12" r="8.5" {...filled} />
              <Path d="M9.8 9.6a2.3 2.3 0 1 1 3.2 2.1c-.7.3-1 .8-1 1.5M12 16.2v.1" stroke={ink} strokeWidth="1.6" fill="none" />
            </>
          )}
        </G>
      </Svg>
    </View>
  );
}
