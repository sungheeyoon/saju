/*
  **천간 열의 그림.** `app/ui/element-symbol.tsx` 의 그림체(24 칸, 속 `--mid` · 선 `--ink`, 둥근 끝)를
  그대로 따라 그렸다(2026-09-26 운영자 채택 — 나무 · 덩굴 · 햇빛 · 등불 · 산 · 밭 · 강철 · 보석 · 바다 · 빗물). 같은 오행의 양 · 음은 큰 것 · 작은 것의 짝이다.

  **그림의 조각은 여기 한 벌이다**(`STEM_PARTS`). 관계 지도의 숨 쉬는 그림(`app/me/home/map/living-stem.tsx`)은 같은 조각을
  부분마다 감싸 움직임을 입힌다 — 처음에는 조각 서른다섯을 복사해 따로 들고 있었는데(2026-09-26), 그러면 여기 그림을
  고칠 때 지도의 얼굴만 옛 그림으로 남는다. 색은 천간의 오행이 정한다(엔진의 `STEM_INFO`).
*/
import { Fragment, type ReactElement } from 'react';

import { STEM_INFO, type Stem } from '@/src/lib/saju';

import { elementScope } from './element-tone';

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

/** 화면이 받은 글자가 천간인가 — 옛 자료 · 모르는 값이면 그림을 세우지 않는다 */
export const isStem = (value: string): value is Stem => Object.hasOwn(STEM_INFO, value);

const fill = { fill: 'var(--mid)', stroke: 'var(--ink)', strokeWidth: 1.5 } as const;
const line = (width = 1.5) => ({ fill: 'none', stroke: 'var(--ink)', strokeWidth: width }) as const;

/**
 * 천간마다 그림의 조각 — 적힌 차례가 그리는 차례다. `StemSymbol` 은 차례대로 다 그리고, 숨 쉬는 그림은 이름으로 골라
 * 움직일 부분을 감싼다.
 */
export const STEM_PARTS = {
  甲: {
    trunk: <path d="M12 21v-6.5" {...line(1.8)} />,
    crown: <path d="M12 15.5c-4.4 0-7.5-2.6-7.5-6.2C4.5 5.6 7.8 3 12 3s7.5 2.6 7.5 6.3c0 3.6-3.1 6.2-7.5 6.2Z" {...fill} />,
    branches: <path d="M12 14v-4.5M12 12l2.4-2.2M12 11 9.9 9.2" {...line(1.2)} />,
    ground: <path d="M8 21h8" {...line(1.6)} />,
  },
  乙: {
    vine: <path d="M8 21c0-5 1.6-8.6 5-11.1 2.5-1.8 3.7-3.9 3-6.4-1.8.3-3 1.6-3 3.3" {...line(1.6)} />,
    leftLeaf: <path d="M9.4 15c-3.4.3-5.6-1.3-6-4.3 3.1-.3 5.3 1.2 6 4.3Z" {...fill} strokeWidth={1.4} />,
    rightLeaf: <path d="M11.8 11.3c.6-3.2 2.9-4.8 6.1-4.6-.4 3.1-2.6 4.8-6.1 4.6Z" {...fill} strokeWidth={1.4} />,
  },
  丙: {
    sun: <circle cx="12" cy="12" r="4.4" {...fill} />,
    rays: (
      <path
        d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M5.4 18.6l1.5-1.5M17.1 6.9l1.5-1.5"
        {...line(1.6)}
      />
    ),
  },
  丁: {
    handle: <path d="M9.6 5.4a2.4 2.4 0 0 1 4.8 0" {...line(1.4)} />,
    lid: <path d="M8.2 6.6h7.6" {...line(1.7)} />,
    lantern: <path d="M8.6 6.6h6.8l.9 12H7.7Z" {...line(1.5)} />,
    flame: <path d="M12 9.8c1.4 1.5 2.1 2.7 2.1 3.9a2.1 2.1 0 0 1-4.2 0c0-1.2.7-2.4 2.1-3.9Z" {...fill} strokeWidth={1.3} />,
    base: <path d="M7 20.6h10" {...line(1.7)} />,
  },
  戊: {
    mountain: <path d="M2.5 20 12 4l9.5 16Z" {...fill} />,
    ridge: <path d="M8.6 9.8 10.3 11l1.7-1.4 1.7 1.4 1.7-1.2" {...line(1.2)} />,
  },
  己: {
    field: <path d="M2.5 20c1.5-3.4 5-5.3 9.5-5.3s8 1.9 9.5 5.3Z" {...fill} />,
    furrows: <path d="M7.2 20l1.4-2.9M12 20v-3.1M16.8 20l-1.4-2.9" {...line(1.2)} />,
    sprout: <path d="M12 14.7V9.8" {...line(1.5)} />,
    leftLeaf: <path d="M12 11.4c-2.3 0-3.6-1.3-3.6-3.6 2.3 0 3.6 1.3 3.6 3.6Z" {...fill} strokeWidth={1.3} />,
    rightLeaf: <path d="M12 10.3c0-2 1.2-3.2 3.2-3.2 0 2-1.2 3.2-3.2 3.2Z" {...fill} strokeWidth={1.3} />,
  },
  庚: {
    blade: <path d="M12 2.5 14 5.4v9.9h-4V5.4Z" {...fill} strokeWidth={1.4} />,
    edge: <path d="M12 5.8v8" {...line(1)} />,
    guard: <path d="M7.6 15.3h8.8" {...line(1.8)} />,
    grip: <path d="M12 15.3v3.9" {...line(2)} />,
    pommel: <circle cx="12" cy="20.6" r="1.1" {...fill} strokeWidth={1.2} />,
  },
  辛: {
    gem: <path d="M7.5 6h9l3.5 4.5L12 21 4 10.5Z" {...fill} />,
    facets: <path d="M4 10.5h16M10 6l2 4.5L14 6M12 10.5V21" {...line(1.1)} />,
    twinkle: <path d="M19.4 2.3v2.6M18.1 3.6h2.6" {...line(1.2)} />,
  },
  壬: {
    sea: (
      <path
        d="M2.5 14.6c1.6 0 2.4-1.8 4.75-1.8s3.15 1.8 4.75 1.8 2.4-1.8 4.75-1.8 3.15 1.8 4.75 1.8V20.5h-19Z"
        {...fill}
      />
    ),
    wave: <path d="M2.5 9.4c1.6 0 2.4-1.8 4.75-1.8s3.15 1.8 4.75 1.8 2.4-1.8 4.75-1.8 3.15 1.8 4.75 1.8" {...line(1.5)} />,
    ripple: <path d="M6 4.8c1.1 0 1.7-1.1 3-1.1s1.9 1.1 3 1.1" {...line(1.3)} />,
  },
  癸: {
    drop: <path d="M10 6.5c2.7 3.3 4.8 6 4.8 8.7a4.8 4.8 0 0 1-9.6 0c0-2.7 2.1-5.4 4.8-8.7Z" {...fill} />,
    drip: <path d="M17.6 3.4c1 1.2 1.7 2.2 1.7 3.1a1.7 1.7 0 0 1-3.4 0c0-.9.7-1.9 1.7-3.1Z" {...fill} strokeWidth={1.3} />,
    splash: <path d="M18.2 12c.8 1 1.4 1.8 1.4 2.5a1.4 1.4 0 0 1-2.8 0c0-.7.6-1.5 1.4-2.5Z" {...fill} strokeWidth={1.2} />,
  },
} satisfies Record<Stem, Record<string, ReactElement>>;

export function StemSymbol({ stem, className = 'size-6' }: { stem: string; className?: string }) {
  if (!isStem(stem)) return null;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`${elementScope(STEM_INFO[stem].element)} ${className} shrink-0`}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {Object.entries(STEM_PARTS[stem]).map(([name, part]) => (
        <Fragment key={name}>{part}</Fragment>
      ))}
    </svg>
  );
}
