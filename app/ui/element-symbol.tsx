import type { Element } from '@/src/lib/saju';

import { elementScope } from '../element-tone';

/**
 * **오행 상징 다섯** — 새싹(木) · 불꽃(火) · 산(土) · 보석(金) · 물방울(水), 모를 때는 물음표 원.
 *
 * 오행을 색만으로 말하지 않으려고 그렸다 — 색을 못 가르는 사람도 그림으로 가른다. 그래도 그림이 이름을
 * 대신하지는 않는다: 늘 `aria-hidden` 이고, 곁에 「나무」 같은 이름(`ELEMENT_PICTURE_KO`)이 함께 선다.
 *
 * 색은 스스로 입는다 — `svg` 에 그 오행의 `tone-*` 을 달아 속(`--mid`)과 선(`--ink`) 두 색만 쓴다. 그래서
 * 어느 판 위에 놓아도 같은 무게로 서고, 다크 화면에서는 토큰을 따라 바뀐다.
 */
export function ElementSymbol({ element, className = 'size-6' }: { element: Element | null; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`${elementScope(element)} ${className} shrink-0`}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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
          <path
            d="M12 3c3.4 4.2 6.2 7.7 6.2 11.2A6.2 6.2 0 0 1 5.8 14.2C5.8 10.7 8.6 7.2 12 3Z"
            fill="var(--mid)"
            stroke="var(--ink)"
            strokeWidth="1.5"
          />
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
