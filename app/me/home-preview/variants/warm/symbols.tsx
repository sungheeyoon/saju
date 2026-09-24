import type { Element } from '@/src/lib/saju';

import styles from './warm.module.css';

/*
  **오행 상징 다섯과 화면 아이콘** — 이모지를 안 쓴다. 이모지는 기기마다 그림이 다르고 다크 화면에서
  색을 못 바꾼다. 상징은 `--mid`(면) 와 `--ink`(선) 두 색만 입어 어느 타일 위에서도 같은 무게로 선다.
*/

/** 오행 → 이 시안의 색 한 벌(`warm.module.css`) */
export const ELEMENT_CLASS: Record<Element, string> = {
  木: styles.wood,
  火: styles.fire,
  土: styles.earth,
  金: styles.metal,
  水: styles.water,
};

export const NONE_CLASS = styles.none;
export const ROOT_CLASS = styles.root;

/** 나무 · 불꽃 · 흙 · 쇠 · 물 — 24 격자, 면 하나에 선 하나 */
export function ElementSymbol({ element, className = 'size-6' }: { element: Element | null; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} strokeLinecap="round" strokeLinejoin="round">
      {element === '木' && (
        <>
          <path d="M12 21V11" stroke="var(--ink)" strokeWidth="1.8" fill="none" />
          <path d="M12 13c-4.5 0-7-2.6-7-7 4.4 0 7 2.5 7 7Z" fill="var(--mid)" stroke="var(--ink)" strokeWidth="1.5" />
          <path d="M12 11c0-4.2 2.4-7 7-7 0 4.6-2.6 7-7 7Z" fill="var(--mid)" stroke="var(--ink)" strokeWidth="1.5" />
        </>
      )}
      {element === '火' && (
        <path
          d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.2 2.2-5 3.4-7.6.6 1.6 1.4 2.5 2.4 2.9C11.2 7 12.6 4.6 14.8 3c-.3 3 1.4 4.8 2.6 6.6 1 1.4 1.6 3 1.6 4.9 0 3.9-2.9 6.5-7 6.5Z"
          fill="var(--mid)"
          stroke="var(--ink)"
          strokeWidth="1.5"
        />
      )}
      {element === '土' && (
        <>
          <path d="M2.5 18.5 9 9.5l3.2 4.2 2.6-3.2 6.7 8Z" fill="var(--mid)" stroke="var(--ink)" strokeWidth="1.5" />
          <path d="M2.5 21h19" stroke="var(--ink)" strokeWidth="1.6" fill="none" />
        </>
      )}
      {element === '金' && (
        <>
          <path d="M6.5 4h11l4 5.5L12 21 2.5 9.5Z" fill="var(--mid)" stroke="var(--ink)" strokeWidth="1.5" />
          <path d="M2.5 9.5h19M9 4l3 5.5L15 4M12 9.5V21" stroke="var(--ink)" strokeWidth="1.2" fill="none" />
        </>
      )}
      {element === '水' && (
        <>
          <path d="M12 3c3.4 4.2 6.2 7.7 6.2 11.2A6.2 6.2 0 0 1 5.8 14.2C5.8 10.7 8.6 7.2 12 3Z" fill="var(--mid)" stroke="var(--ink)" strokeWidth="1.5" />
          <path d="M9 14.5a3 3 0 0 0 3 3" stroke="var(--ink)" strokeWidth="1.4" fill="none" />
        </>
      )}
      {element === null && (
        <>
          <circle cx="12" cy="12" r="8.5" fill="var(--mid)" stroke="var(--ink)" strokeWidth="1.5" />
          <path d="M9.8 9.6a2.3 2.3 0 1 1 3.2 2.1c-.7.3-1 .8-1 1.5M12 16.2v.1" stroke="var(--ink)" strokeWidth="1.6" fill="none" />
        </>
      )}
    </svg>
  );
}

export type IconName =
  | 'home'
  | 'people'
  | 'reading'
  | 'chat'
  | 'bell'
  | 'gear'
  | 'arrow'
  | 'plus'
  | 'heart'
  | 'search'
  | 'spark'
  | 'alert'
  | 'quote';

/** 선 아이콘 — `currentColor` 하나로 선다 */
export function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <path d="M4 11 12 4.5l8 6.5v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1Z" />,
    people: (
      <>
        <circle cx="9" cy="8.5" r="3.2" />
        <path d="M3.5 19.5c.5-3.4 2.4-5.2 5.5-5.2s5 1.8 5.5 5.2M15.5 6a3 3 0 0 1 0 5.6M16.5 14.4c2.5.3 3.8 2 4.1 4.6" />
      </>
    ),
    reading: (
      <path d="M12 6.5C10.2 5 7.6 4.5 4 4.8v13.4c3.6-.3 6.2.2 8 1.8 1.8-1.6 4.4-2.1 8-1.8V4.8c-3.6-.3-6.2.2-8 1.7Zm0 0V20" />
    ),
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
