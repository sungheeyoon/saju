/*
  관계 지도의 숨 쉬는 천간 그림 열 — `stem-symbol.tsx` 의 조각(`STEM_PARTS`)을 **그대로** 받아 부분마다 감싸
  움직임을 입힌다. 그림을 고치는 곳은 거기 하나다 — 여기는 어느 조각이 어느 축으로 움직이는가만 든다.

  - **가만있을 때(`*Idle`)**: 제 성격대로 아주 작고 느리게. 나무는 바람에 살짝, 햇빛은 천천히 돌고, 등불은 흔들리고, 바다는
    물결치고, 빗물은 똑 떨어지고, 산은 가만 — 대신 구름이 스친다. 대부분 한 바퀴의 앞쪽 3할만 움직이고 나머지는 쉰다.
    `--phase`(음수 초)가 그림마다 달라 모두 한꺼번에 움직이지 않는다.
  - **깨울 때(`*Stir`)**: 누르거나 만났을 때 한 번 크게 — 나무가 자라고, 햇빛이 번지고, 등불이 환해지고… `--s1` · `--s2` 에
    두 번까지(누른 때 · 만난 때).
  - 움직임만을 위해 더한 것(구름 · 칼날의 빛 · 등불의 번짐 · 둘째 반짝임)은 평소에 투명하다. 줄인 움직임이면 원본과
    같은 그림만 선다.
*/
import type { CSSProperties, ReactNode } from 'react';

import { STEM_INFO, type Stem } from '@/src/lib/saju';

import { elementScope } from '../../../ui/element-tone';
import { STEM_PARTS, isStem } from '../../../ui/stem-symbol';
import styles from './relation-map.module.css';

/* 움직임만을 위해 더한 조각 — 원래 그림에는 없다 */
const cloud = (
  <path d="M4 8.8h5.4a1.5 1.5 0 0 0 0-3 2.2 2.2 0 0 0-4.1-.6A1.8 1.8 0 0 0 4 8.8Z" fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.1} />
);
const glint = <path d="M11 13.2v-1.8" fill="none" stroke="var(--surface)" strokeWidth={1.1} />;

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
    case '甲': {
      const p = STEM_PARTS.甲;
      return (
        <>
          <Part at={[12, 21]} idle={styles.treeIdle} stir={styles.treeStir}>
            {p.trunk}
            {p.crown}
            {p.branches}
          </Part>
          {p.ground}
        </>
      );
    }
    case '乙': {
      const p = STEM_PARTS.乙;
      return (
        <Part at={[8, 21]} stir={styles.vineStir}>
          {p.vine}
          <Part at={[9.4, 15]} idle={styles.leafLeftIdle} stir={styles.leafLeftStir}>
            {p.leftLeaf}
          </Part>
          <Part at={[11.8, 11.3]} idle={styles.leafRightIdle} stir={styles.leafRightStir}>
            {p.rightLeaf}
          </Part>
        </Part>
      );
    }
    case '丙': {
      const p = STEM_PARTS.丙;
      return (
        <>
          <Part at={[12, 12]} idle={styles.raysIdle} stir={styles.raysStir}>
            {p.rays}
          </Part>
          <Part at={[12, 12]} stir={styles.coreStir}>
            {p.sun}
          </Part>
        </>
      );
    }
    case '丁': {
      const p = STEM_PARTS.丁;
      return (
        <>
          {p.handle}
          {p.lid}
          {p.lantern}
          <Part at={[12, 13.4]} stir={styles.haloStir}>
            <circle cx="12" cy="13.4" r="4.2" fill="var(--mid)" />
          </Part>
          <Part at={[12, 15.8]} idle={styles.flameIdle} stir={styles.flameStir}>
            {p.flame}
          </Part>
          {p.base}
        </>
      );
    }
    case '戊': {
      const p = STEM_PARTS.戊;
      return (
        <>
          <Part at={[12, 20]} stir={styles.mountainStir}>
            {p.mountain}
            {p.ridge}
          </Part>
          {/* 산은 가만있고 구름이 스친다 — 평소엔 없다가 한 바퀴의 앞쪽에만 지나간다 */}
          <Part at={[6.7, 7.3]} idle={styles.cloudIdle}>
            {cloud}
          </Part>
          <Part at={[6.7, 7.3]} stir={styles.cloudStir}>
            {cloud}
          </Part>
        </>
      );
    }
    case '己': {
      const p = STEM_PARTS.己;
      return (
        <>
          {p.field}
          {p.furrows}
          <Part at={[12, 14.7]} idle={styles.sproutIdle} stir={styles.sproutStir}>
            {p.sprout}
            {p.leftLeaf}
            {p.rightLeaf}
          </Part>
        </>
      );
    }
    case '庚': {
      const p = STEM_PARTS.庚;
      return (
        <>
          <Part at={[12, 15.3]} stir={styles.bladeStir}>
            {p.blade}
            {p.edge}
            {/* 칼날을 타고 오르는 빛 — 평소엔 없다 */}
            <Part at={[11, 12]} idle={styles.glintIdle}>
              {glint}
            </Part>
            <Part at={[11, 12]} stir={styles.glintStir}>
              {glint}
            </Part>
          </Part>
          {p.guard}
          {p.grip}
          {p.pommel}
        </>
      );
    }
    case '辛': {
      const p = STEM_PARTS.辛;
      return (
        <>
          <Part at={[12, 13]} stir={styles.gemStir}>
            {p.gem}
            {p.facets}
          </Part>
          <Part at={[19.4, 3.6]} idle={styles.twinkleIdle} stir={styles.twinkleStir}>
            {p.twinkle}
          </Part>
          <Part at={[4.4, 4.2]} stir={styles.sparkStir}>
            <path d="M4.4 3.2v2M3.4 4.2h2" fill="none" stroke="var(--ink)" strokeWidth={1.1} />
          </Part>
        </>
      );
    }
    case '壬': {
      const p = STEM_PARTS.壬;
      return (
        <>
          <Part at={[12, 17]} idle={styles.waveBodyIdle} stir={styles.waveBodyStir}>
            {p.sea}
          </Part>
          <Part at={[12, 8.5]} idle={styles.waveMidIdle} stir={styles.waveMidStir}>
            {p.wave}
          </Part>
          <Part at={[9, 4.2]} idle={styles.waveTopIdle} stir={styles.waveTopStir}>
            {p.ripple}
          </Part>
        </>
      );
    }
    case '癸': {
      const p = STEM_PARTS.癸;
      return (
        <>
          <Part at={[10, 20]} stir={styles.dropStir}>
            {p.drop}
          </Part>
          <Part at={[17.6, 6.5]} idle={styles.dripIdle} stir={styles.dripStir}>
            {p.drip}
          </Part>
          <Part at={[18.2, 15.9]} idle={styles.plopIdle}>
            {p.splash}
          </Part>
        </>
      );
    }
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
  if (!isStem(stem)) return null;
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
      className={`${elementScope(STEM_INFO[stem].element)} ${className} shrink-0 ${stir.length > 0 ? styles.stirring : ''} ${
        hush ? styles.hush : ''
      }`}
      style={style}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Living stem={stem} />
    </svg>
  );
}
