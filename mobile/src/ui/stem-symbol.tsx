import type { ReactElement } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { STEM_INFO, type Stem } from '@saju';

import { ELEMENT_TONE } from './tokens';

type Paint = { fill: string; stroke: string; strokeWidth: number };

/** 천간 열의 그림 — 웹의 `app/ui/stem-symbol.tsx` 와 같은 경로 값이다. 낭독기에서 숨고 곁에 이름이 함께 선다 */
const partsOf = (fill: Paint, line: (width?: number) => Paint): Record<Stem, readonly ReactElement[]> => ({
  甲: [
    <Path key="1" d="M12 21v-6.5" {...line(1.8)} />,
    <Path key="2" d="M12 15.5c-4.4 0-7.5-2.6-7.5-6.2C4.5 5.6 7.8 3 12 3s7.5 2.6 7.5 6.3c0 3.6-3.1 6.2-7.5 6.2Z" {...fill} />,
    <Path key="3" d="M12 14v-4.5M12 12l2.4-2.2M12 11 9.9 9.2" {...line(1.2)} />,
    <Path key="4" d="M8 21h8" {...line(1.6)} />,
  ],
  乙: [
    <Path key="5" d="M8 21c0-5 1.6-8.6 5-11.1 2.5-1.8 3.7-3.9 3-6.4-1.8.3-3 1.6-3 3.3" {...line(1.6)} />,
    <Path key="6" d="M9.4 15c-3.4.3-5.6-1.3-6-4.3 3.1-.3 5.3 1.2 6 4.3Z" {...fill} strokeWidth={1.4} />,
    <Path key="7" d="M11.8 11.3c.6-3.2 2.9-4.8 6.1-4.6-.4 3.1-2.6 4.8-6.1 4.6Z" {...fill} strokeWidth={1.4} />,
  ],
  丙: [
    <Circle key="8" cx="12" cy="12" r="4.4" {...fill} />,
    (
      <Path key="9"
        d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M5.4 18.6l1.5-1.5M17.1 6.9l1.5-1.5"
        {...line(1.6)}
      />
    ),
  ],
  丁: [
    <Path key="10" d="M9.6 5.4a2.4 2.4 0 0 1 4.8 0" {...line(1.4)} />,
    <Path key="11" d="M8.2 6.6h7.6" {...line(1.7)} />,
    <Path key="12" d="M8.6 6.6h6.8l.9 12H7.7Z" {...line(1.5)} />,
    <Path key="13" d="M12 9.8c1.4 1.5 2.1 2.7 2.1 3.9a2.1 2.1 0 0 1-4.2 0c0-1.2.7-2.4 2.1-3.9Z" {...fill} strokeWidth={1.3} />,
    <Path key="14" d="M7 20.6h10" {...line(1.7)} />,
  ],
  戊: [
    <Path key="15" d="M2.5 20 12 4l9.5 16Z" {...fill} />,
    <Path key="16" d="M8.6 9.8 10.3 11l1.7-1.4 1.7 1.4 1.7-1.2" {...line(1.2)} />,
  ],
  己: [
    <Path key="17" d="M2.5 20c1.5-3.4 5-5.3 9.5-5.3s8 1.9 9.5 5.3Z" {...fill} />,
    <Path key="18" d="M7.2 20l1.4-2.9M12 20v-3.1M16.8 20l-1.4-2.9" {...line(1.2)} />,
    <Path key="19" d="M12 14.7V9.8" {...line(1.5)} />,
    <Path key="20" d="M12 11.4c-2.3 0-3.6-1.3-3.6-3.6 2.3 0 3.6 1.3 3.6 3.6Z" {...fill} strokeWidth={1.3} />,
    <Path key="21" d="M12 10.3c0-2 1.2-3.2 3.2-3.2 0 2-1.2 3.2-3.2 3.2Z" {...fill} strokeWidth={1.3} />,
  ],
  庚: [
    <Path key="22" d="M12 2.5 14 5.4v9.9h-4V5.4Z" {...fill} strokeWidth={1.4} />,
    <Path key="23" d="M12 5.8v8" {...line(1)} />,
    <Path key="24" d="M7.6 15.3h8.8" {...line(1.8)} />,
    <Path key="25" d="M12 15.3v3.9" {...line(2)} />,
    <Circle key="26" cx="12" cy="20.6" r="1.1" {...fill} strokeWidth={1.2} />,
  ],
  辛: [
    <Path key="27" d="M7.5 6h9l3.5 4.5L12 21 4 10.5Z" {...fill} />,
    <Path key="28" d="M4 10.5h16M10 6l2 4.5L14 6M12 10.5V21" {...line(1.1)} />,
    <Path key="29" d="M19.4 2.3v2.6M18.1 3.6h2.6" {...line(1.2)} />,
  ],
  壬: [
    (
      <Path key="30"
        d="M2.5 14.6c1.6 0 2.4-1.8 4.75-1.8s3.15 1.8 4.75 1.8 2.4-1.8 4.75-1.8 3.15 1.8 4.75 1.8V20.5h-19Z"
        {...fill}
      />
    ),
    <Path key="31" d="M2.5 9.4c1.6 0 2.4-1.8 4.75-1.8s3.15 1.8 4.75 1.8 2.4-1.8 4.75-1.8 3.15 1.8 4.75 1.8" {...line(1.5)} />,
    <Path key="32" d="M6 4.8c1.1 0 1.7-1.1 3-1.1s1.9 1.1 3 1.1" {...line(1.3)} />,
  ],
  癸: [
    <Path key="33" d="M10 6.5c2.7 3.3 4.8 6 4.8 8.7a4.8 4.8 0 0 1-9.6 0c0-2.7 2.1-5.4 4.8-8.7Z" {...fill} />,
    <Path key="34" d="M17.6 3.4c1 1.2 1.7 2.2 1.7 3.1a1.7 1.7 0 0 1-3.4 0c0-.9.7-1.9 1.7-3.1Z" {...fill} strokeWidth={1.3} />,
    <Path key="35" d="M18.2 12c.8 1 1.4 1.8 1.4 2.5a1.4 1.4 0 0 1-2.8 0c0-.7.6-1.5 1.4-2.5Z" {...fill} strokeWidth={1.2} />,
  ],
});

export function StemSymbol({ stem, size = 24, opacity = 1 }: { stem: Stem; size?: number; opacity?: number }) {
  const tone = ELEMENT_TONE[STEM_INFO[stem].element];
  const parts = partsOf(
    { fill: tone.mid, stroke: tone.ink, strokeWidth: 1.5 },
    (width = 1.5) => ({ fill: 'none', stroke: tone.ink, strokeWidth: width }),
  )[stem];
  return (
    <View aria-hidden style={{ width: size, height: size, opacity }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <G strokeLinecap="round" strokeLinejoin="round">
          {parts}
        </G>
      </Svg>
    </View>
  );
}
