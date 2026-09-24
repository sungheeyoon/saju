/**
 * **선 아이콘 한 벌** — `currentColor` 하나로 서서 다크 화면에서 글자색을 따라간다.
 *
 * 이모지를 안 쓴다. 이모지는 기기마다 그림이 다르고 색을 못 바꾼다. 머리글 · 하단 독 · 화면 단추가 같은
 * 그림을 쓰도록 여기 한 곳에 둔다(시안 `home-preview/variants/warm/symbols.tsx` 에서 옮겼다).
 * 늘 `aria-hidden` 이다 — 이름은 곁의 글자나 단추의 `aria-label` 이 든다.
 */
export type IconName =
  | 'home'
  | 'people'
  | 'reading'
  | 'chat'
  | 'bell'
  | 'gear'
  | 'arrow'
  | 'back'
  | 'chevron'
  | 'close'
  | 'plus'
  | 'heart'
  | 'search'
  | 'spark'
  | 'alert'
  | 'quote'
  | 'ticket';

const PATHS: Record<IconName, React.ReactNode> = {
  home: <path d="M4 11 12 4.5l8 6.5v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1Z" />,
  people: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.5-3.4 2.4-5.2 5.5-5.2s5 1.8 5.5 5.2M15.5 6a3 3 0 0 1 0 5.6M16.5 14.4c2.5.3 3.8 2 4.1 4.6" />
    </>
  ),
  reading: <path d="M12 6.5C10.2 5 7.6 4.5 4 4.8v13.4c3.6-.3 6.2.2 8 1.8 1.8-1.6 4.4-2.1 8-1.8V4.8c-3.6-.3-6.2.2-8 1.7Zm0 0V20" />,
  chat: <path d="M5.5 5h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5V17h-1a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />,
  bell: (
    <>
      <path d="M6.2 10a5.8 5.8 0 0 1 11.6 0c0 5.6 2 6.8 2 7.5H4.2c0-.7 2-1.9 2-7.5Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.5Z" />
    </>
  ),
  arrow: <path d="M5 12h13m-5-5.5L18.5 12 13 17.5" />,
  back: <path d="M19 12H6m5-5.5L5.5 12l5.5 5.5" />,
  chevron: <path d="m9 5.5 6.5 6.5L9 18.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  heart: <path d="M12 19.5s-7.5-4.4-7.5-9.7A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5c0 5.3-7.5 9.7-7.5 9.7Z" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  spark: <path d="M12 3.5 13.9 10l6.6 2-6.6 2L12 20.5 10.1 14l-6.6-2 6.6-2Z" />,
  alert: (
    <>
      <path d="M12 3.8 21 19.5H3Z" />
      <path d="M12 10v4.2M12 17v.1" />
    </>
  ),
  quote: <path d="M5 17.5c0-4.6 1.4-8 5-10M13.5 17.5c0-4.6 1.4-8 5-10M5 17.5h4.2v-4.3H5M13.5 17.5h4.2v-4.3h-4.2" />,
  ticket: (
    <>
      <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4Z" />
      <path d="M14.5 6.5v11" strokeDasharray="1.6 2" />
    </>
  ),
};

export function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
