/*
  **천간 열의 그림.** `app/ui/element-symbol.tsx` 의 그림체(24 칸, 속 `--mid` · 선 `--ink`, 둥근 끝)를
  그대로 따라 그렸다(2026-09-26 운영자 채택 — 나무 · 덩굴 · 햇빛 · 등불 · 산 · 밭 · 강철 · 보석 · 바다 · 빗물). 같은 오행의 양 · 음은 큰 것 · 작은 것의 짝이다.
*/
import type { Stem } from '@/src/lib/saju';

import { elementScope } from './element-tone';

export const STEM_ELEMENT: Record<Stem, '木' | '火' | '土' | '金' | '水'> = {
  甲: '木',
  乙: '木',
  丙: '火',
  丁: '火',
  戊: '土',
  己: '土',
  庚: '金',
  辛: '金',
  壬: '水',
  癸: '水',
};

export const STEM_PICTURE: Record<Stem, string> = {
  甲: '나무',
  乙: '덩굴',
  丙: '햇빛',
  丁: '등불',
  戊: '산',
  己: '밭',
  庚: '강철',
  辛: '보석',
  壬: '바다',
  癸: '빗물',
};

const fill = { fill: 'var(--mid)', stroke: 'var(--ink)', strokeWidth: 1.5 } as const;
const line = (width = 1.5) => ({ fill: 'none', stroke: 'var(--ink)', strokeWidth: width }) as const;

function Drawing({ stem }: { stem: Stem }) {
  switch (stem) {
    case '甲':
      return (
        <>
          <path d="M12 21v-6.5" {...line(1.8)} />
          <path d="M12 15.5c-4.4 0-7.5-2.6-7.5-6.2C4.5 5.6 7.8 3 12 3s7.5 2.6 7.5 6.3c0 3.6-3.1 6.2-7.5 6.2Z" {...fill} />
          <path d="M12 14v-4.5M12 12l2.4-2.2M12 11 9.9 9.2" {...line(1.2)} />
          <path d="M8 21h8" {...line(1.6)} />
        </>
      );
    case '乙':
      return (
        <>
          <path d="M8 21c0-5 1.6-8.6 5-11.1 2.5-1.8 3.7-3.9 3-6.4-1.8.3-3 1.6-3 3.3" {...line(1.6)} />
          <path d="M9.4 15c-3.4.3-5.6-1.3-6-4.3 3.1-.3 5.3 1.2 6 4.3Z" {...fill} strokeWidth={1.4} />
          <path d="M11.8 11.3c.6-3.2 2.9-4.8 6.1-4.6-.4 3.1-2.6 4.8-6.1 4.6Z" {...fill} strokeWidth={1.4} />
        </>
      );
    case '丙':
      return (
        <>
          <circle cx="12" cy="12" r="4.4" {...fill} />
          <path
            d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M5.4 18.6l1.5-1.5M17.1 6.9l1.5-1.5"
            {...line(1.6)}
          />
        </>
      );
    case '丁':
      return (
        <>
          <path d="M9.6 5.4a2.4 2.4 0 0 1 4.8 0" {...line(1.4)} />
          <path d="M8.2 6.6h7.6" {...line(1.7)} />
          <path d="M8.6 6.6h6.8l.9 12H7.7Z" {...line(1.5)} />
          <path d="M12 9.8c1.4 1.5 2.1 2.7 2.1 3.9a2.1 2.1 0 0 1-4.2 0c0-1.2.7-2.4 2.1-3.9Z" {...fill} strokeWidth={1.3} />
          <path d="M7 20.6h10" {...line(1.7)} />
        </>
      );
    case '戊':
      return (
        <>
          <path d="M2.5 20 12 4l9.5 16Z" {...fill} />
          <path d="M8.6 9.8 10.3 11l1.7-1.4 1.7 1.4 1.7-1.2" {...line(1.2)} />
        </>
      );
    case '己':
      return (
        <>
          <path d="M2.5 20c1.5-3.4 5-5.3 9.5-5.3s8 1.9 9.5 5.3Z" {...fill} />
          <path d="M7.2 20l1.4-2.9M12 20v-3.1M16.8 20l-1.4-2.9" {...line(1.2)} />
          <path d="M12 14.7V9.8" {...line(1.5)} />
          <path d="M12 11.4c-2.3 0-3.6-1.3-3.6-3.6 2.3 0 3.6 1.3 3.6 3.6Z" {...fill} strokeWidth={1.3} />
          <path d="M12 10.3c0-2 1.2-3.2 3.2-3.2 0 2-1.2 3.2-3.2 3.2Z" {...fill} strokeWidth={1.3} />
        </>
      );
    case '庚':
      return (
        <>
          <path d="M12 2.5 14 5.4v9.9h-4V5.4Z" {...fill} strokeWidth={1.4} />
          <path d="M12 5.8v8" {...line(1)} />
          <path d="M7.6 15.3h8.8" {...line(1.8)} />
          <path d="M12 15.3v3.9" {...line(2)} />
          <circle cx="12" cy="20.6" r="1.1" {...fill} strokeWidth={1.2} />
        </>
      );
    case '辛':
      return (
        <>
          <path d="M7.5 6h9l3.5 4.5L12 21 4 10.5Z" {...fill} />
          <path d="M4 10.5h16M10 6l2 4.5L14 6M12 10.5V21" {...line(1.1)} />
          <path d="M19.4 2.3v2.6M18.1 3.6h2.6" {...line(1.2)} />
        </>
      );
    case '壬':
      return (
        <>
          <path
            d="M2.5 14.6c1.6 0 2.4-1.8 4.75-1.8s3.15 1.8 4.75 1.8 2.4-1.8 4.75-1.8 3.15 1.8 4.75 1.8V20.5h-19Z"
            {...fill}
          />
          <path d="M2.5 9.4c1.6 0 2.4-1.8 4.75-1.8s3.15 1.8 4.75 1.8 2.4-1.8 4.75-1.8 3.15 1.8 4.75 1.8" {...line(1.5)} />
          <path d="M6 4.8c1.1 0 1.7-1.1 3-1.1s1.9 1.1 3 1.1" {...line(1.3)} />
        </>
      );
    case '癸':
      return (
        <>
          <path d="M10 6.5c2.7 3.3 4.8 6 4.8 8.7a4.8 4.8 0 0 1-9.6 0c0-2.7 2.1-5.4 4.8-8.7Z" {...fill} />
          <path d="M17.6 3.4c1 1.2 1.7 2.2 1.7 3.1a1.7 1.7 0 0 1-3.4 0c0-.9.7-1.9 1.7-3.1Z" {...fill} strokeWidth={1.3} />
          <path d="M18.2 12c.8 1 1.4 1.8 1.4 2.5a1.4 1.4 0 0 1-2.8 0c0-.7.6-1.5 1.4-2.5Z" {...fill} strokeWidth={1.2} />
        </>
      );
  }
}

export function StemSymbol({ stem, className = 'size-6' }: { stem: string; className?: string }) {
  if (!(stem in STEM_ELEMENT)) return null;
  const known = stem as Stem;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`${elementScope(STEM_ELEMENT[known])} ${className} shrink-0`}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Drawing stem={known} />
    </svg>
  );
}
