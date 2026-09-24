import type { ComponentType } from 'react';

import type { PreviewState } from '../state';
import OrbitHome from './orbit';
import OrbitChat from './orbit/chat';
import OrbitMatching from './orbit/matching';
import OrbitReadings from './orbit/readings';
import WarmHome from './warm';
import WarmChat from './warm/chat';
import WarmMatching from './warm/matching';
import WarmReadings from './warm/readings';

export type VariantProps = { state: PreviewState };

export const SCREENS = [
  { key: 'home', label: '홈' },
  { key: 'matching', label: '매칭' },
  { key: 'readings', label: '풀이' },
  { key: 'chat', label: '채팅' },
] as const;
export type ScreenKey = (typeof SCREENS)[number]['key'];

export type Style = {
  key: string;
  label: string;
  screens: Record<ScreenKey, ComponentType<VariantProps>>;
};

/**
 * 채택 후보 둘 — **한 스타일이 화면 넷을 든다.**
 *
 * 홈은 2차 라운드에서 고른 것이고, 매칭 · 풀이 · 채팅은 그 스타일로 새로 그린다. 화면마다 `variants/<스타일>/<화면>/`
 * 에 살아서 에이전트 여럿이 나란히 고쳐도 겹치지 않는다.
 */
export const STYLES: readonly Style[] = [
  {
    key: 'orbit',
    label: '관계 지도 — 나를 중심으로',
    screens: { home: OrbitHome, matching: OrbitMatching, readings: OrbitReadings, chat: OrbitChat },
  },
  {
    key: 'warm',
    label: '라이프스타일 — 부드러움',
    screens: { home: WarmHome, matching: WarmMatching, readings: WarmReadings, chat: WarmChat },
  },
];
