import { pillarAt, type Pillar } from '../constants';
import { civilDayNumber, type CivilDate } from '../civilTime';

/**
 * 일주(日柱) — 기준일로부터의 경과일수.
 *
 * 일진의 60갑자 순환은 달력 개편과 무관하게 한 번도 끊기지 않았으므로,
 * 기준점 하나만 있으면 모든 날짜가 결정된다.
 */

/**
 * 일주 기준점 — 2000-01-01 = 무오일(戊午, 60갑자 index 54).
 *
 * 교차 검증: 이 기준으로 계산하면 1900-01-01 = 갑술일(甲戌),
 * 2024-01-01 = 갑자일(甲子)이 되어 널리 인용되는 값들과 일치한다.
 *
 * 이 값이 틀리면 모든 일주와 시주가 통째로 어긋난다.
 * 만세력과 결과가 다르다면 여기부터 확인할 것.
 */
export const DAY_ANCHOR = {
  civil: { year: 2000, month: 1, day: 1 },
  pillarIndex: 54,
} as const;

const ANCHOR_DAY_NUMBER = civilDayNumber(DAY_ANCHOR.civil);

/** 정수 일련일(1970-01-01 = 0)로 일주를 구한다. */
export function dayPillarFromDayNumber(dayNumber: number): Pillar {
  return pillarAt(DAY_ANCHOR.pillarIndex + (dayNumber - ANCHOR_DAY_NUMBER));
}

/** 달력 날짜로 일주를 구한다. 야자시 처리는 호출부(`index.ts`)가 담당한다. */
export function dayPillarOf(date: CivilDate): Pillar {
  return dayPillarFromDayNumber(civilDayNumber(date));
}
