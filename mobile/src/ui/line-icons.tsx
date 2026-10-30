import Svg, { Circle, Path } from 'react-native-svg';

import { COLOR } from './tokens';

/** 선 아이콘 — 웹의 `app/ui/icons.tsx` 와 같은 24 격자 · 같은 경로다. 이름은 곁의 글자나 단추의 이름이 든다 */
const PATHS = {
  undo: ['M9 7.5 4.5 12 9 16.5', 'M4.5 12H15a4.5 4.5 0 0 1 0 9h-2'],
  close: ['M6 6l12 12M18 6 6 18'],
  chevron: ['m9 5.5 6.5 6.5L9 18.5'],
  back: ['M19 12H6m5-5.5L5.5 12l5.5 5.5'],
  arrow: ['M5 12h13m-5-5.5L18.5 12 13 17.5'],
  chat: ['M5.5 5h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5V17h-1a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z'],
  flag: ['M5.5 21V4.5m0 0c4-2 7 2 13 0v9c-6 2-9-2-13 0'],
  exchange: ['M5 8.5h13.5M15 5l3.5 3.5L15 12M19 15.5H5.5M9 12l-3.5 3.5L9 19'],
  spark: ['M12 3.5 13.9 10l6.6 2-6.6 2L12 20.5 10.1 14l-6.6-2 6.6-2Z'],
  reading: ['M12 6.5C10.2 5 7.6 4.5 4 4.8v13.4c3.6-.3 6.2.2 8 1.8 1.8-1.6 4.4-2.1 8-1.8V4.8c-3.6-.3-6.2.2-8 1.7Zm0 0V20'],
  people: ['M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M3 20c.6-3.4 2.9-5.5 6-5.5s5.4 2.1 6 5.5', 'M16 4.5a3.5 3.5 0 0 1 0 6.5', 'M17.5 14.8c1.9.6 3.1 2.5 3.5 5.2'],
  bell: ['M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15Z', 'M10 21h4'],
  alert: ['M12 4 3 20h18Z', 'M12 10v4.5', 'M12 17.5v.01'],
  ticket: ['M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.2a2 2 0 0 0 0 3.6V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.2a2 2 0 0 0 0-3.6Z', 'M14.5 6v12'],
} as const;

export type LineIconName = keyof typeof PATHS | 'more' | 'block';

export function LineIcon({ name, size = 20, color = COLOR.foreground }: { name: LineIconName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {name === 'more' ? (
        <>
          <Circle cx={5.5} cy={12} r={1.3} fill={color} stroke="none" />
          <Circle cx={12} cy={12} r={1.3} fill={color} stroke="none" />
          <Circle cx={18.5} cy={12} r={1.3} fill={color} stroke="none" />
        </>
      ) : name === 'block' ? (
        <>
          <Circle cx={12} cy={12} r={8.5} />
          <Path d="M6 6l12 12" />
        </>
      ) : (
        PATHS[name].map((d) => <Path key={d} d={d} />)
      )}
    </Svg>
  );
}
