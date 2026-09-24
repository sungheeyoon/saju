import type { ReactNode } from 'react';

/** 선 아이콘 — 먹선 한 굵기(1.6) · 각진 끝. 전부 장식이라 읽는 이름은 곁의 글자가 든다 */
export type IconName = 'home' | 'people' | 'reading' | 'chat' | 'news' | 'gear' | 'arrow' | 'plus';

const PATHS: Record<IconName, ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V20h-5.5v-6h-5v6H4Z" />,
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.4-3.3 2.2-5 5.5-5s5.1 1.7 5.5 5M15 5.5a2.8 2.8 0 0 1 0 5.4M16.5 14c2.4.4 3.7 2 4 4.5" />
    </>
  ),
  reading: <path d="M5 4h9l5 5v11H5ZM14 4v5h5M8.5 13h7M8.5 16.5h5" />,
  chat: <path d="M4 5h16v11h-9l-4.5 3.5V16H4Z" />,
  news: (
    <>
      <path d="M6 9.5a6 6 0 0 1 12 0c0 6.5 2 7 2 7.5H4c0-.5 2-1 2-7.5Z" />
      <path d="M10 20h4" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  arrow: <path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
};

export function InkIcon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`${className} shrink-0 fill-none stroke-current`}
      strokeWidth="1.6"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {PATHS[name]}
    </svg>
  );
}
