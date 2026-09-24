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

export type VariantProps = { state: PreviewState };

/**
 * 시안 목록 — **자리는 먼저 다 세워 두었다.**
 *
 * 시안마다 에이전트가 따로 만든다. 목록이 나중에 채워지면 그 한 파일을 여럿이 고치게 되니, 자리를 미리
 * 다 박아 두고 각자는 `variants/<자기 것>/` 안만 고친다.
 */
export const VARIANTS: readonly { key: string; label: string; Component: ComponentType<VariantProps> }[] = [
  { key: 'r', label: 'R · 추천 조합', Component: R },
  { key: 'a1', label: 'A1 · 통합 홈 요약형', Component: A1 },
  { key: 'a2', label: 'A2 · 통합 홈 명식형', Component: A2 },
  { key: 'a3', label: 'A3 · 통합 홈 전체 사람형', Component: A3 },
  { key: 'b', label: 'B · 사람 중심형', Component: B },
  { key: 'c', label: 'C · 행동 중심형', Component: C },
  { key: 'd', label: 'D · 최근 풀이 중심형', Component: D },
  { key: 'e', label: 'E · 단일 목록형', Component: E },
  { key: 'f', label: 'F · 점진적 공개형', Component: F },
];
