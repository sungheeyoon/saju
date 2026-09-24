import type { ReactNode } from 'react';

import s from './swiss.module.css';

/*
  선 아이콘 — 1.75 두께, 모서리는 각지게(miter). 둥근 끝이 이 시안의 각진 단추와 어긋나서다.
  화살표는 단추 셋 모두에 서고, 누르면 3px 밀린다(`swiss.module.css` 의 `.arrow`).
*/

type Name = 'home' | 'people' | 'reading' | 'chat' | 'news' | 'gear' | 'plus' | 'arrow';

const PATHS: Record<Name, ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V20h-5.5v-6h-5v6H4Z" />,
  people: (
    <>
      <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M3.5 19.5c.4-3.3 2.2-5 5.5-5s5.1 1.7 5.5 5M15.5 5.5a3 3 0 0 1 0 6M16.5 14.5c2.5.3 3.8 1.9 4 5" />
    </>
  ),
  reading: <path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4ZM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6Z" />,
  chat: <path d="M4 5h16v11H10l-4 3.5V16H4Z" />,
  news: (
    <>
      <path d="M6 16V10a6 6 0 0 1 12 0v6l1.5 2h-15Z" />
      <path d="M10 21h4" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5" />,
};

export function Icon({ name, size = 20 }: { name: Name; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`shrink-0 fill-none stroke-current ${name === 'arrow' ? s.arrow : ''}`}
      strokeWidth="1.75"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {PATHS[name]}
    </svg>
  );
}
