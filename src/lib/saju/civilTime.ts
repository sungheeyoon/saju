/**
 * 절대 시각(Date) ↔ 특정 표준시의 달력 시각(civil time) 변환.
 *
 * 사주 계산에서 두 시간 개념은 쓰임이 다르다.
 * - 절기 판정: 태양 황경 도달 시각과의 비교 → **절대 시각**으로 한다.
 * - 시주·일주 경계: 몇 시인가, 자정을 넘었는가 → **달력 시각**으로 한다.
 *
 * 경도 보정·서머타임 같은 시간 보정(timeCorrection)은 "보정된 절대 시각"을
 * 만들어 이 모듈에 넘기는 방식으로 끼어든다. 즉 보정 결과를 여기서 다시
 * 해석하지 않고, 항상 고정 오프셋으로 달력 시각을 읽는다.
 */

/** 한국 표준시 UTC+9 */
export const KST_OFFSET_MINUTES = 540;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export type CivilDateTime = {
  year: number;
  /** 1~12 */
  month: number;
  /** 1~31 */
  day: number;
  /** 0~23 */
  hour: number;
  minute: number;
  second: number;
};

export type CivilDate = Pick<CivilDateTime, 'year' | 'month' | 'day'>;

/** 절대 시각을 주어진 오프셋의 달력 시각으로 읽는다. */
export function toCivil(
  instant: Date,
  offsetMinutes: number = KST_OFFSET_MINUTES,
): CivilDateTime {
  const shifted = new Date(instant.getTime() + offsetMinutes * MINUTE_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

/**
 * 달력 시각을 절대 시각으로 되돌린다 — `toCivil`의 역함수.
 * 사용자가 입력한 벽시계 시각(생년월일시)을 Date로 만들 때 쓴다.
 */
export function fromCivil(
  civil: CivilDateTime,
  offsetMinutes: number = KST_OFFSET_MINUTES,
): Date {
  const utc = new Date(0);
  utc.setUTCFullYear(civil.year, civil.month - 1, civil.day);
  utc.setUTCHours(civil.hour, civil.minute, civil.second, 0);
  return new Date(utc.getTime() - offsetMinutes * MINUTE_MS);
}

/**
 * 달력 날짜를 정수 일련일로 환산한다 (1970-01-01 = 0).
 * 일주는 이 값의 차이만으로 결정되므로 시·분은 보지 않는다.
 */
export function civilDayNumber(date: CivilDate): number {
  // Date.UTC 는 0~99 를 1900년대로 해석하므로 두 자리 연도는 직접 보정한다.
  const utc = new Date(0);
  utc.setUTCFullYear(date.year, date.month - 1, date.day);
  utc.setUTCHours(0, 0, 0, 0);
  return Math.floor(utc.getTime() / DAY_MS);
}
