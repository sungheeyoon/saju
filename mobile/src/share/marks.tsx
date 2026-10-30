import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { COLOR } from '@/ui/tokens';

type MarkName = 'reading' | 'arrow' | 'quote';

/** 웹의 `app/ui/icons.tsx` 와 같은 24 격자 · 같은 경로 값이다. 장식이고 이름은 곁의 글자가 든다 */
const PATHS: Record<MarkName, string> = {
  reading: 'M12 6.5C10.2 5 7.6 4.5 4 4.8v13.4c3.6-.3 6.2.2 8 1.8 1.8-1.6 4.4-2.1 8-1.8V4.8c-3.6-.3-6.2.2-8 1.7Zm0 0V20',
  arrow: 'M5 12h13m-5-5.5L18.5 12 13 17.5',
  quote: 'M5 17.5c0-4.6 1.4-8 5-10M13.5 17.5c0-4.6 1.4-8 5-10M5 17.5h4.2v-4.3H5M13.5 17.5h4.2v-4.3h-4.2',
};

export function Mark({ name, size = 24, color = COLOR.foreground }: { name: MarkName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d={PATHS[name]} />
    </Svg>
  );
}

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315] as const;

/** 해 — 「내 사주 보기」 입구의 그림. 웹의 `SunMark`(`app/ui/entry-marks.tsx`)와 같은 값이다 */
export function SunMark({ size = 20, color = COLOR.foreground }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="4.25" stroke={color} strokeWidth={1.5} />
      <G>
        {RAYS.map((deg) => (
          <Line key={deg} x1="12" y1="2.75" x2="12" y2="5" stroke={color} strokeWidth={1.5} strokeLinecap="round" transform={`rotate(${deg} 12 12)`} />
        ))}
      </G>
    </Svg>
  );
}
