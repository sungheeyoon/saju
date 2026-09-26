/*
  관계 지도의 숨 쉬는 천간 그림 열 — `stem-symbol.tsx` 의 경로를 **모양 그대로** 복사해 부분마다
  움직임을 입혔다(원본은 고치지 않는다).

  - **가만있을 때(`*Idle`)**: 제 성격대로 아주 작고 느리게. 나무는 바람에 살짝, 햇빛은 천천히 돌고, 등불은 흔들리고, 바다는
    물결치고, 빗물은 똑 떨어지고, 산은 가만 — 대신 구름이 스친다. 대부분 한 바퀴의 앞쪽 3할만 움직이고 나머지는 쉰다.
    `--phase`(음수 초)가 그림마다 달라 모두 한꺼번에 움직이지 않는다.
  - **깨울 때(`*Stir`)**: 누르거나 만났을 때 한 번 크게 — 나무가 자라고, 햇빛이 번지고, 등불이 환해지고… `--s1` · `--s2` 에
    두 번까지(누른 때 · 만난 때).
  - 움직임만을 위해 더한 것(구름 · 칼날의 빛 · 등불의 번짐 · 둘째 반짝임)은 평소에 투명하다. 줄인 움직임이면 원본과
    같은 그림만 선다.
*/
import type { CSSProperties, ReactNode } from 'react';

import type { Stem } from '@/src/lib/saju';

import { elementScope } from '../../../ui/element-tone';
import { STEM_ELEMENT } from '../../../ui/stem-symbol';
import styles from './relation-map.module.css';

const fill = { fill: 'var(--mid)', stroke: 'var(--ink)', strokeWidth: 1.5 } as const;
const line = (width = 1.5) => ({ fill: 'none', stroke: 'var(--ink)', strokeWidth: width }) as const;
const shine = (width = 1.1) => ({ fill: 'none', stroke: 'var(--surface)', strokeWidth: width }) as const;

/** 움직이는 한 부분 — 바깥 겹은 깨울 때, 안쪽 겹은 가만있을 때. 둘 다 같은 점을 축으로 돈다(24 칸 좌표) */
function Part({
  at,
  idle,
  stir,
  children,
}: {
  at: [number, number];
  idle?: string;
  stir?: string;
  children: ReactNode;
}) {
  const origin = { transformOrigin: `${at[0]}px ${at[1]}px` };
  return (
    <g className={`${styles.part} ${stir ?? ''}`} style={origin}>
      <g className={`${styles.part} ${idle ?? ''}`} style={origin}>
        {children}
      </g>
    </g>
  );
}

function Living({ stem }: { stem: Stem }) {
  switch (stem) {
    case '甲':
      return (
        <>
          <Part at={[12, 21]} idle={styles.treeIdle} stir={styles.treeStir}>
            <path d="M12 21v-6.5" {...line(1.8)} />
            <path d="M12 15.5c-4.4 0-7.5-2.6-7.5-6.2C4.5 5.6 7.8 3 12 3s7.5 2.6 7.5 6.3c0 3.6-3.1 6.2-7.5 6.2Z" {...fill} />
            <path d="M12 14v-4.5M12 12l2.4-2.2M12 11 9.9 9.2" {...line(1.2)} />
          </Part>
          <path d="M8 21h8" {...line(1.6)} />
        </>
      );
    case '乙':
      return (
        <Part at={[8, 21]} stir={styles.vineStir}>
          <path d="M8 21c0-5 1.6-8.6 5-11.1 2.5-1.8 3.7-3.9 3-6.4-1.8.3-3 1.6-3 3.3" {...line(1.6)} />
          <Part at={[9.4, 15]} idle={styles.leafLeftIdle} stir={styles.leafLeftStir}>
            <path d="M9.4 15c-3.4.3-5.6-1.3-6-4.3 3.1-.3 5.3 1.2 6 4.3Z" {...fill} strokeWidth={1.4} />
          </Part>
          <Part at={[11.8, 11.3]} idle={styles.leafRightIdle} stir={styles.leafRightStir}>
            <path d="M11.8 11.3c.6-3.2 2.9-4.8 6.1-4.6-.4 3.1-2.6 4.8-6.1 4.6Z" {...fill} strokeWidth={1.4} />
          </Part>
        </Part>
      );
    case '丙':
      return (
        <>
          <Part at={[12, 12]} idle={styles.raysIdle} stir={styles.raysStir}>
            <path
              d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M5.4 18.6l1.5-1.5M17.1 6.9l1.5-1.5"
              {...line(1.6)}
            />
          </Part>
          <Part at={[12, 12]} stir={styles.coreStir}>
            <circle cx="12" cy="12" r="4.4" {...fill} />
          </Part>
        </>
      );
    case '丁':
      return (
        <>
          <path d="M9.6 5.4a2.4 2.4 0 0 1 4.8 0" {...line(1.4)} />
          <path d="M8.2 6.6h7.6" {...line(1.7)} />
          <path d="M8.6 6.6h6.8l.9 12H7.7Z" {...line(1.5)} />
          <Part at={[12, 13.4]} stir={styles.haloStir}>
            <circle cx="12" cy="13.4" r="4.2" fill="var(--mid)" />
          </Part>
          <Part at={[12, 15.8]} idle={styles.flameIdle} stir={styles.flameStir}>
            <path d="M12 9.8c1.4 1.5 2.1 2.7 2.1 3.9a2.1 2.1 0 0 1-4.2 0c0-1.2.7-2.4 2.1-3.9Z" {...fill} strokeWidth={1.3} />
          </Part>
          <path d="M7 20.6h10" {...line(1.7)} />
        </>
      );
    case '戊':
      return (
        <>
          <Part at={[12, 20]} stir={styles.mountainStir}>
            <path d="M2.5 20 12 4l9.5 16Z" {...fill} />
            <path d="M8.6 9.8 10.3 11l1.7-1.4 1.7 1.4 1.7-1.2" {...line(1.2)} />
          </Part>
          {/* 산은 가만있고 구름이 스친다 — 평소엔 없다가 한 바퀴의 앞쪽에만 지나간다 */}
          <Part at={[6.7, 7.3]} idle={styles.cloudIdle}>
            <path d="M4 8.8h5.4a1.5 1.5 0 0 0 0-3 2.2 2.2 0 0 0-4.1-.6A1.8 1.8 0 0 0 4 8.8Z" fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.1} />
          </Part>
          <Part at={[6.7, 7.3]} stir={styles.cloudStir}>
            <path d="M4 8.8h5.4a1.5 1.5 0 0 0 0-3 2.2 2.2 0 0 0-4.1-.6A1.8 1.8 0 0 0 4 8.8Z" fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.1} />
          </Part>
        </>
      );
    case '己':
      return (
        <>
          <path d="M2.5 20c1.5-3.4 5-5.3 9.5-5.3s8 1.9 9.5 5.3Z" {...fill} />
          <path d="M7.2 20l1.4-2.9M12 20v-3.1M16.8 20l-1.4-2.9" {...line(1.2)} />
          <Part at={[12, 14.7]} idle={styles.sproutIdle} stir={styles.sproutStir}>
            <path d="M12 14.7V9.8" {...line(1.5)} />
            <path d="M12 11.4c-2.3 0-3.6-1.3-3.6-3.6 2.3 0 3.6 1.3 3.6 3.6Z" {...fill} strokeWidth={1.3} />
            <path d="M12 10.3c0-2 1.2-3.2 3.2-3.2 0 2-1.2 3.2-3.2 3.2Z" {...fill} strokeWidth={1.3} />
          </Part>
        </>
      );
    case '庚':
      return (
        <>
          <Part at={[12, 15.3]} stir={styles.bladeStir}>
            <path d="M12 2.5 14 5.4v9.9h-4V5.4Z" {...fill} strokeWidth={1.4} />
            <path d="M12 5.8v8" {...line(1)} />
            {/* 칼날을 타고 오르는 빛 — 평소엔 없다 */}
            <Part at={[11, 12]} idle={styles.glintIdle}>
              <path d="M11 13.2v-1.8" {...shine()} />
            </Part>
            <Part at={[11, 12]} stir={styles.glintStir}>
              <path d="M11 13.2v-1.8" {...shine()} />
            </Part>
          </Part>
          <path d="M7.6 15.3h8.8" {...line(1.8)} />
          <path d="M12 15.3v3.9" {...line(2)} />
          <circle cx="12" cy="20.6" r="1.1" {...fill} strokeWidth={1.2} />
        </>
      );
    case '辛':
      return (
        <>
          <Part at={[12, 13]} stir={styles.gemStir}>
            <path d="M7.5 6h9l3.5 4.5L12 21 4 10.5Z" {...fill} />
            <path d="M4 10.5h16M10 6l2 4.5L14 6M12 10.5V21" {...line(1.1)} />
          </Part>
          <Part at={[19.4, 3.6]} idle={styles.twinkleIdle} stir={styles.twinkleStir}>
            <path d="M19.4 2.3v2.6M18.1 3.6h2.6" {...line(1.2)} />
          </Part>
          <Part at={[4.4, 4.2]} stir={styles.sparkStir}>
            <path d="M4.4 3.2v2M3.4 4.2h2" {...line(1.1)} />
          </Part>
        </>
      );
    case '壬':
      return (
        <>
          <Part at={[12, 17]} idle={styles.waveBodyIdle} stir={styles.waveBodyStir}>
            <path
              d="M2.5 14.6c1.6 0 2.4-1.8 4.75-1.8s3.15 1.8 4.75 1.8 2.4-1.8 4.75-1.8 3.15 1.8 4.75 1.8V20.5h-19Z"
              {...fill}
            />
          </Part>
          <Part at={[12, 8.5]} idle={styles.waveMidIdle} stir={styles.waveMidStir}>
            <path d="M2.5 9.4c1.6 0 2.4-1.8 4.75-1.8s3.15 1.8 4.75 1.8 2.4-1.8 4.75-1.8 3.15 1.8 4.75 1.8" {...line(1.5)} />
          </Part>
          <Part at={[9, 4.2]} idle={styles.waveTopIdle} stir={styles.waveTopStir}>
            <path d="M6 4.8c1.1 0 1.7-1.1 3-1.1s1.9 1.1 3 1.1" {...line(1.3)} />
          </Part>
        </>
      );
    case '癸':
      return (
        <>
          <Part at={[10, 20]} stir={styles.dropStir}>
            <path d="M10 6.5c2.7 3.3 4.8 6 4.8 8.7a4.8 4.8 0 0 1-9.6 0c0-2.7 2.1-5.4 4.8-8.7Z" {...fill} />
          </Part>
          <Part at={[17.6, 6.5]} idle={styles.dripIdle} stir={styles.dripStir}>
            <path d="M17.6 3.4c1 1.2 1.7 2.2 1.7 3.1a1.7 1.7 0 0 1-3.4 0c0-.9.7-1.9 1.7-3.1Z" {...fill} strokeWidth={1.3} />
          </Part>
          <Part at={[18.2, 15.9]} idle={styles.plopIdle}>
            <path d="M18.2 12c.8 1 1.4 1.8 1.4 2.5a1.4 1.4 0 0 1-2.8 0c0-.7.6-1.5 1.4-2.5Z" {...fill} strokeWidth={1.2} />
          </Part>
        </>
      );
  }
}

/**
 * 살아 있는 천간 그림 한 장. `phase` 는 숨의 박자(음수 초), `stir` 는 한 번 크게 깨울 때(ms, 둘까지). `hush` 면 숨을 멈춘다
 * — 누른 사람 곁에서 물러난 사람들이 조용해지게.
 */
export function LivingStem({
  stem,
  phase,
  stir = [],
  hush = false,
  className = 'size-6',
}: {
  stem: string;
  phase: number;
  stir?: readonly number[];
  hush?: boolean;
  className?: string;
}) {
  if (!(stem in STEM_ELEMENT)) return null;
  const known = stem as Stem;
  const style = {
    '--phase': `${phase}s`,
    '--s1': `${stir[0] ?? 0}ms`,
    '--s2': `${stir[1] ?? stir[0] ?? 0}ms`,
  } as CSSProperties;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      overflow="visible"
      className={`${elementScope(STEM_ELEMENT[known])} ${className} shrink-0 ${stir.length > 0 ? styles.stirring : ''} ${
        hush ? styles.hush : ''
      }`}
      style={style}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Living stem={known} />
    </svg>
  );
}
