import type { ComponentType } from 'react';

import type { PreviewState } from '../state';
import A1 from './a1';
import A2 from './a2';
import A3 from './a3';
import B from './b';
import C from './c';
import D from './d';
import E from './e';
import F from './f';
import R from './r';
import Ed from './ed';
import Fin from './fin';
import Ink from './ink';
import Viz from './viz';
import Orbit from './orbit';
import Swiss from './swiss';
import Warm from './warm';
import Sys from './sys';
import Night from './night';

export type VariantProps = { state: PreviewState };

/**
 * 시안 목록 — **자리는 먼저 다 세워 두었다.**
 *
 * 시안마다 에이전트가 따로 만든다. 목록이 나중에 채워지면 그 한 파일을 여럿이 고치게 되니, 자리를 미리
 * 다 박아 두고 각자는 `variants/<자기 것>/` 안만 고친다.
 */
export type Variant = { key: string; label: string; round: 1 | 2; Component: ComponentType<VariantProps> };

/** 2차는 디자이너 역할을 하나씩 맡은 시안이다 — 구조는 R 을 따르고 모양은 자유다 */
export const VARIANTS: readonly Variant[] = [
  { key: 'ed', label: '2 · 편집 디자인 — 매거진', round: 2, Component: Ed },
  { key: 'fin', label: '2 · 프로덕트 — 핀테크 앱', round: 2, Component: Fin },
  { key: 'ink', label: '2 · 동양 현대 — 먹과 인장', round: 2, Component: Ink },
  { key: 'viz', label: '2 · 정보 디자인 — 한눈 비교', round: 2, Component: Viz },
  { key: 'orbit', label: '2 · 관계 지도 — 나를 중심으로', round: 2, Component: Orbit },
  { key: 'swiss', label: '2 · 타이포 그리드 — 스위스', round: 2, Component: Swiss },
  { key: 'warm', label: '2 · 라이프스타일 — 부드러움', round: 2, Component: Warm },
  { key: 'sys', label: '2 · 디자인 시스템 — 지금 것을 다듬기', round: 2, Component: Sys },
  { key: 'night', label: '2 · 밤하늘 — 다크 프리미엄', round: 2, Component: Night },

  { key: 'r', label: 'R · 추천 조합', round: 1, Component: R },
  { key: 'a1', label: 'A1 · 통합 홈 요약형', round: 1, Component: A1 },
  { key: 'a2', label: 'A2 · 통합 홈 명식형', round: 1, Component: A2 },
  { key: 'a3', label: 'A3 · 통합 홈 전체 사람형', round: 1, Component: A3 },
  { key: 'b', label: 'B · 사람 중심형', round: 1, Component: B },
  { key: 'c', label: 'C · 행동 중심형', round: 1, Component: C },
  { key: 'd', label: 'D · 최근 풀이 중심형', round: 1, Component: D },
  { key: 'e', label: 'E · 단일 목록형', round: 1, Component: E },
  { key: 'f', label: 'F · 점진적 공개형', round: 1, Component: F },
];
