import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { COLOR } from './tokens';

export type IconName = 'home' | 'people' | 'chat' | 'bell' | 'gear' | 'chevron' | 'plus' | 'taiji' | 'search' | 'ticket' | 'undo' | 'close' | 'arrow' | 'flag' | 'exchange' | 'spark' | 'reading' | 'alert' | 'more' | 'block' | 'send' | 'lock';

/** 웹의 `app/ui/icons.tsx` 와 같은 24 격자 · 같은 경로 값이다. 이름은 곁의 글자나 단추의 이름이 든다 */
const shapes = (color: string): Record<IconName, ReactNode> => ({
  home: <Path d="M4 11 12 4.5l8 6.5v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1Z" />,
  people: (
    <>
      <Circle cx="9" cy="8.5" r="3.2" />
      <Path d="M3.5 19.5c.5-3.4 2.4-5.2 5.5-5.2s5 1.8 5.5 5.2M15.5 6a3 3 0 0 1 0 5.6M16.5 14.4c2.5.3 3.8 2 4.1 4.6" />
    </>
  ),
  chat: <Path d="M5.5 5h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5V17h-1a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />,
  bell: (
    <>
      <Path d="M6.2 10a5.8 5.8 0 0 1 11.6 0c0 5.6 2 6.8 2 7.5H4.2c0-.7 2-1.9 2-7.5Z" />
      <Path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  gear: (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 2.6-1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.5Z" />
    </>
  ),
  reading: <Path d="M12 6.5C10.2 5 7.6 4.5 4 4.8v13.4c3.6-.3 6.2.2 8 1.8 1.8-1.6 4.4-2.1 8-1.8V4.8c-3.6-.3-6.2.2-8 1.7Zm0 0V20" />,
  spark: <Path d="M12 3.5 13.9 10l6.6 2-6.6 2L12 20.5 10.1 14l-6.6-2 6.6-2Z" />,
  chevron: <Path d="m9 5.5 6.5 6.5L9 18.5" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  taiji: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 3a9 9 0 0 1 0 18 4.5 4.5 0 0 1 0-9 4.5 4.5 0 0 0 0-9ZM13.4 16.5a1.4 1.4 0 1 0-2.8 0 1.4 1.4 0 1 0 2.8 0Z" fill={color} fillRule="evenodd" stroke="none" />
      <Circle cx="12" cy="7.5" r="1.4" fill={color} stroke="none" />
    </>
  ),
  search: (
    <>
      <Circle cx="10.5" cy="10.5" r="6" />
      <Path d="m15 15 5 5" />
    </>
  ),
  ticket: (
    <>
      <Path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4Z" />
      <Path d="M14.5 6.5v11" strokeDasharray="1.6 2" />
    </>
  ),
  undo: (
    <>
      <Path d="M9 14 4.5 9.5 9 5" />
      <Path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3" />
    </>
  ),
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  send: <Path d="M12 19.5V5m-6 6 6-6 6 6" />,
  lock: (
    <>
      <Rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  arrow: <Path d="M5 12h13m-5-5.5L18.5 12 13 17.5" />,
  flag: <Path d="M5.5 21V4.5m0 0c4-2 7 2 13 0v9c-6 2-9-2-13 0" />,
  exchange: <Path d="M5 8.5h13.5M15 5l3.5 3.5L15 12M19 15.5H5.5M9 12l-3.5 3.5L9 19" />,
  alert: (
    <>
      <Path d="M12 3.8 21 19.5H3Z" />
      <Path d="M12 10v4.2M12 17v.1" />
    </>
  ),
  more: (
    <>
      <Circle cx={6} cy={12} r={1.2} fill={color} stroke="none" />
      <Circle cx={12} cy={12} r={1.2} fill={color} stroke="none" />
      <Circle cx={18} cy={12} r={1.2} fill={color} stroke="none" />
    </>
  ),
  block: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="m6 6 12 12" />
    </>
  ),
});

export function Icon({ name, size = 24, color = COLOR.foreground }: { name: IconName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {shapes(color)[name]}
    </Svg>
  );
}
