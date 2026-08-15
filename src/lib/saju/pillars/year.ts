import { pillarAt, type Pillar } from '../constants';

/**
 * 연주(年柱) — 사주년의 60갑자.
 *
 * 사주년은 1월 1일이 아니라 입춘에서 갈리므로, 이 함수에 넘길 `sajuYear`는
 * 절기로 판정한 값이어야 한다. (그 판정은 `month.ts`의 절기 조회가 담당)
 */

/** 1984년 = 갑자년(甲子, 60갑자 index 0) */
export const YEAR_ANCHOR = {
  sajuYear: 1984,
  pillarIndex: 0,
} as const;

export function yearPillarOf(sajuYear: number): Pillar {
  return pillarAt(YEAR_ANCHOR.pillarIndex + (sajuYear - YEAR_ANCHOR.sajuYear));
}
