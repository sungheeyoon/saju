import type { Element } from '@/src/lib/saju';

import { ELEMENT_CLASS, NONE_CLASS } from '../symbols';

/*
  **채팅이 더 쓰는 아이콘과 둥근 머리.** 홈 시안의 `Icon` 은 고치지 않는다(다른 화면 에이전트가 함께 읽는다) — 채팅에만
  필요한 선 아이콘 일곱을 같은 격자(24 · 선 1.8 · 둥근 끝)로 여기 더 그렸다.
*/

export type ChatIconName = 'back' | 'send' | 'lock' | 'more' | 'flag' | 'block' | 'close';

export function ChatIcon({ name, className = 'size-5' }: { name: ChatIconName; className?: string }) {
  const paths: Record<ChatIconName, React.ReactNode> = {
    back: <path d="M19 12H6m5.5-5.5L6 12l5.5 5.5" />,
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
    close: <path d="m6.5 6.5 11 11m0-11-11 11" />,
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`${className} shrink-0 fill-none stroke-current`}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

/**
 * 둥근 머리 — 사진이 있으면 사진, 없으면 첫 글자, 떠난 사람은 빈 사람 모양.
 * 테두리 고리가 그 사람의 파스텔이라 사진 위에서도 누구의 색인지 남는다. 접속 점은 「지금」일 때만 진하게,
 * 「24시간 안」은 옅게 — 점은 색만이라 옆에 읽는 글자(`sr-only`)를 꼭 붙인다.
 */
export function RoomAvatar({
  photoUrl,
  initial,
  element,
  size,
  activity,
  activityLabel,
  closed = false,
}: {
  photoUrl: string | null;
  initial: string;
  element: Element | null;
  size: 'sm' | 'md' | 'lg';
  activity?: 'now' | 'day' | 'earlier' | null;
  activityLabel?: string | null;
  closed?: boolean;
}) {
  const box = size === 'lg' ? 'size-14' : size === 'md' ? 'size-11' : 'size-9';
  const dot = size === 'lg' ? 'size-4' : 'size-3.5';
  return (
    <span className={`${element === null ? NONE_CLASS : ELEMENT_CLASS[element]} relative inline-flex shrink-0`}>
      <span
        aria-hidden="true"
        className={`${box} grid place-items-center overflow-hidden rounded-full bg-[var(--tile)] p-[3px] ${closed ? 'opacity-60 grayscale' : ''}`}
      >
        {photoUrl !== null ? (
          /* 미리보기의 예시 사진 — 꾸밈 그림이라 배경으로 깐다(이름은 옆 글자가 말한다) */
          <span className="size-full rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${photoUrl})` }} />
        ) : initial !== '' ? (
          <span className="grid size-full place-items-center rounded-full bg-[color-mix(in_srgb,var(--card)_60%,transparent)] text-[15px] font-bold text-[var(--ink)]">
            {initial}
          </span>
        ) : (
          <span className="grid size-full place-items-center rounded-full text-[var(--ink)]">
            <svg viewBox="0 0 24 24" className="size-3/5 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="9" r="3.5" />
              <path d="M5.5 19.5c.8-3.3 3.1-5 6.5-5s5.7 1.7 6.5 5" />
            </svg>
          </span>
        )}
      </span>
      {(activity === 'now' || activity === 'day') && (
        <span
          className={`absolute bottom-0 right-0 ${dot} rounded-full ring-[3px] ring-[var(--card)] ${
            activity === 'now' ? 'bg-[#4fae6d]' : 'bg-[color-mix(in_srgb,#4fae6d_35%,var(--card))]'
          }`}
        >
          {activityLabel !== null && activityLabel !== undefined && <span className="sr-only">{activityLabel}</span>}
        </span>
      )}
    </span>
  );
}
