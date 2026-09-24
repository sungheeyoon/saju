/*
  타일과 제안 메뉴의 아이콘 — 모바일 하단 메뉴(`app/site-header.tsx` 의 `MobileNavIcon`)의 선을 옮겼다.
  원본은 내보내지 않는 함수다. 그 파일에 없는 셋(사람 추가 · 찾기 · 톱니)만 같은 굵기로 새로 그렸다.
*/

const PATHS = {
  home: <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4Z" />,
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.4-3.3 2.2-5 5.5-5s5.1 1.7 5.5 5M15 6.5a2.5 2.5 0 0 1 0 5M16 14c2.7.2 4.2 1.8 4.5 4.5" />
    </>
  ),
  compat: <path d="M12 20.5 4.6 13.4A4.8 4.8 0 0 1 11.4 6l.6.7.6-.7a4.8 4.8 0 0 1 6.8 7.4Z" />,
  reading: (
    <path d="M4 5.5A3.5 3.5 0 0 1 7.5 4H12v16H7.5A3.5 3.5 0 0 0 4 21.5ZM20 5.5A3.5 3.5 0 0 0 16.5 4H12v16h4.5a3.5 3.5 0 0 1 3.5 1.5Z" />
  ),
  news: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 8H4c0-1 2-1 2-8Z" />
      <path d="M9.5 20h5" />
    </>
  ),
  chat: (
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17H6.5A2.5 2.5 0 0 1 4 14.5Z" />
  ),
  add: (
    <>
      <circle cx="10" cy="8" r="3" />
      <path d="M4 19c.4-3.3 2.4-5 6-5 1.3 0 2.4.2 3.3.7M18 13v6M15 16h6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`${className} fill-none stroke-current`}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
