import Svg, { Circle, Path } from 'react-native-svg';

import { COLOR } from './tokens';

/** 인연 화면의 선 아이콘 — 웹의 `app/ui/icons.tsx` 와 같은 24 격자 · 같은 경로다(`Icon`, `icons.tsx` 에 없는 이름이 많아 따로 든다). 이름은 곁의 글자나 단추의 이름이 든다 */
const PATHS = {
  undo: ['M9 14 4.5 9.5 9 5', 'M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3'],
  close: ['M6 6l12 12M18 6 6 18'],
  chevron: ['m9 5.5 6.5 6.5L9 18.5'],
  arrow: ['M5 12h13m-5-5.5L18.5 12 13 17.5'],
  chat: ['M5.5 5h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5V17h-1a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z'],
  flag: ['M5.5 21V4.5m0 0c4-2 7 2 13 0v9c-6 2-9-2-13 0'],
  exchange: ['M5 8.5h13.5M15 5l3.5 3.5L15 12M19 15.5H5.5M9 12l-3.5 3.5L9 19'],
  spark: ['M12 3.5 13.9 10l6.6 2-6.6 2L12 20.5 10.1 14l-6.6-2 6.6-2Z'],
  reading: ['M12 6.5C10.2 5 7.6 4.5 4 4.8v13.4c3.6-.3 6.2.2 8 1.8 1.8-1.6 4.4-2.1 8-1.8V4.8c-3.6-.3-6.2.2-8 1.7Zm0 0V20'],
  people: ['M12.2 8.5a3.2 3.2 0 1 1-6.4 0 3.2 3.2 0 0 1 6.4 0Z', 'M3.5 19.5c.5-3.4 2.4-5.2 5.5-5.2s5 1.8 5.5 5.2M15.5 6a3 3 0 0 1 0 5.6M16.5 14.4c2.5.3 3.8 2 4.1 4.6'],
  bell: ['M6.2 10a5.8 5.8 0 0 1 11.6 0c0 5.6 2 6.8 2 7.5H4.2c0-.7 2-1.9 2-7.5Z', 'M10 20.5a2.2 2.2 0 0 0 4 0'],
  alert: ['M12 3.8 21 19.5H3Z', 'M12 10v4.2M12 17v.1'],
  ticket: ['M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4Z', 'M14.5 6.5v11'],
} as const;

export type LineIconName = keyof typeof PATHS | 'more' | 'block';

export function LineIcon({ name, size = 20, color = COLOR.foreground }: { name: LineIconName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {name === 'more' ? (
        <>
          <Circle cx={6} cy={12} r={1.2} fill={color} stroke="none" />
          <Circle cx={12} cy={12} r={1.2} fill={color} stroke="none" />
          <Circle cx={18} cy={12} r={1.2} fill={color} stroke="none" />
        </>
      ) : name === 'block' ? (
        <>
          <Circle cx={12} cy={12} r={8.5} />
          <Path d="m6 6 12 12" />
        </>
      ) : (
        PATHS[name].map((d: string) => <Path key={d} d={d} strokeDasharray={d === 'M14.5 6.5v11' ? '1.6 2' : undefined} />)
      )}
    </Svg>
  );
}
