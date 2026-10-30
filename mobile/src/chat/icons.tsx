import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type ChatIconName = 'chevron' | 'close' | 'arrow' | 'send' | 'alert' | 'lock' | 'more' | 'flag' | 'block' | 'people';

/** 웹의 `app/ui/icons.tsx` 와 같은 경로 값이다 */
const shapes = (color: string): Record<ChatIconName, ReactNode> => {
  const line = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
  return {
    chevron: <Path d="m9 5.5 6.5 6.5L9 18.5" {...line} />,
    close: <Path d="M6 6l12 12M18 6 6 18" {...line} />,
    arrow: <Path d="M5 12h13m-5-5.5L18.5 12 13 17.5" {...line} />,
    send: <Path d="M12 19.5V5m-6 6 6-6 6 6" {...line} />,
    alert: (
      <>
        <Path d="M12 3.8 21 19.5H3Z" {...line} />
        <Path d="M12 10v4.2M12 17v.1" {...line} />
      </>
    ),
    lock: (
      <>
        <Rect x="5" y="10.5" width="14" height="9.5" rx="2.5" {...line} />
        <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" {...line} />
      </>
    ),
    more: (
      <>
        <Circle cx="6" cy="12" r="1.2" {...line} />
        <Circle cx="12" cy="12" r="1.2" {...line} />
        <Circle cx="18" cy="12" r="1.2" {...line} />
      </>
    ),
    flag: <Path d="M5.5 21V4.5m0 0c4-2 7 2 13 0v9c-6 2-9-2-13 0" {...line} />,
    block: (
      <>
        <Circle cx="12" cy="12" r="8.5" {...line} />
        <Path d="m6 6 12 12" {...line} />
      </>
    ),
    people: (
      <>
        <Circle cx="12" cy="8" r="3.5" {...line} />
        <Path d="M5 20c.8-3.6 3.4-5.5 7-5.5s6.2 1.9 7 5.5" {...line} />
      </>
    ),
  };
};

export function ChatIcon({ name, color, size = 22 }: { name: ChatIconName; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {shapes(color)[name]}
    </Svg>
  );
}

/** 음양 — 하단 탭 「궁합」과 같은 그림 */
export function TaijiIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth={1.8} />
      <Path
        d="M12 3a9 9 0 0 1 0 18 4.5 4.5 0 0 1 0-9 4.5 4.5 0 0 0 0-9ZM13.4 16.5a1.4 1.4 0 1 0-2.8 0 1.4 1.4 0 1 0 2.8 0Z"
        fill={color}
        fillRule="evenodd"
      />
      <Circle cx="12" cy="7.5" r="1.4" fill={color} />
    </Svg>
  );
}
