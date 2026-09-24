/**
 * **채팅에만 쓰는 선 아이콘 다섯** — 보내기 · 자물쇠 · ⋯ · 깃발 · 차단.
 *
 * 공용 `Icon`(`app/ui/icons.tsx`)에 없는 것만 같은 격자(24 · 선 1.8 · 둥근 끝)로 여기 그렸다. 다른 화면이 쓰게
 * 되면 그때 공용으로 옮긴다. 늘 `aria-hidden` 이다 — 이름은 곁의 글자나 단추의 `aria-label` 이 든다.
 */
export type ChatIconName = 'send' | 'lock' | 'more' | 'flag' | 'block';

const PATHS: Record<ChatIconName, React.ReactNode> = {
  send: <path d="M12 19.5V5m-6 6 6-6 6 6" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18" cy="12" r="1.2" />
    </>
  ),
  flag: <path d="M5.5 21V4.5m0 0c4-2 7 2 13 0v9c-6 2-9-2-13 0" />,
  block: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </>
  ),
};

export function ChatIcon({ name, className = 'size-5' }: { name: ChatIconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`${className} shrink-0 fill-none stroke-current`}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
