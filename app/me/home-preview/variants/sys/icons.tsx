/*
  **아이콘 한 벌** — 24 격자 · 선 1.7 · 둥근 끝. 메뉴 선은 `site-header.tsx` 의 `MobileNavIcon` 과 같다.
  크기는 둘뿐이다: 20(메뉴 · 아이콘 단추)과 16(단추 안).
*/

const PATHS = {
  home: <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4Z" />,
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.4-3.3 2.2-5 5.5-5s5.1 1.7 5.5 5M15 6.5a2.5 2.5 0 0 1 0 5M16 14c2.7.2 4.2 1.8 4.5 4.5" />
    </>
  ),
  book: (
    <>
      <path d="M5 5.5c2.8-.7 5-.1 7 1.5v12c-2-1.6-4.2-2.2-7-1.5Z" />
      <path d="M19 5.5c-2.8-.7-5-.1-7 1.5v12c2-1.6 4.2-2.2 7-1.5Z" />
    </>
  ),
  chat: (
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17H6.5A2.5 2.5 0 0 1 4 14.5Z" />
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 8H4c0-1 2-1 2-8Z" />
      <path d="M9.5 20h5" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  spark: <path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2.2 2.2M15.3 15.3l2.2 2.2M6.5 17.5l2.2-2.2M15.3 8.7l2.2-2.2" />,
  pair: (
    <>
      <circle cx="9" cy="12" r="5" />
      <circle cx="15" cy="12" r="5" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m14.8 9.2-1.7 3.9-3.9 1.7 1.7-3.9Z" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 3 19.5h18Z" />
      <path d="M12 10v4M12 16.8v.2" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: 16 | 20 }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="shrink-0 fill-none stroke-current"
      strokeWidth={size === 16 ? 2 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
