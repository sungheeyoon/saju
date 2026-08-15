/**
 * 경도 보정 — 표준시를 그 지점의 지방평균태양시로 옮긴다.
 *
 * 시계는 표준자오선의 태양을 따르지만 사주는 태어난 자리의 태양을 본다.
 * 서울은 동경 135° 기준시를 쓰면서 실제로는 127°에 있으므로, 시계가
 * 정오를 가리킬 때 서울 하늘의 태양은 아직 남중 전이다.
 */

/** 지구가 경도 1°를 지나는 데 걸리는 시간(분). 1440분 ÷ 360° */
export const MINUTES_PER_DEGREE = 4;

/** 표준시 오프셋(분)에 대응하는 표준자오선 경도. UTC+9 → 135°, UTC+8:30 → 127.5° */
export function standardMeridian(standardOffsetMinutes: number): number {
  return (standardOffsetMinutes / 60) * 15;
}

/**
 * 경도 보정량(분). 표준자오선보다 서쪽이면 음수(시계보다 늦음).
 *
 * 표준자오선을 오프셋에서 끌어내므로, 1954~61년처럼 기준시가 UTC+8:30이던
 * 시기에는 자동으로 127.5° 기준이 되어 보정량이 거의 0에 가까워진다.
 */
export function longitudeCorrectionMinutes(
  longitude: number,
  standardOffsetMinutes: number,
): number {
  return (longitude - standardMeridian(standardOffsetMinutes)) * MINUTES_PER_DEGREE;
}

/** 참고용 주요 도시 경도 */
export const CITY_LONGITUDES = {
  서울: 126.9784,
  부산: 129.0756,
  대구: 128.6014,
  인천: 126.7052,
  광주: 126.8526,
  대전: 127.3845,
  울산: 129.3114,
  제주: 126.5312,
  춘천: 127.7298,
  강릉: 128.8761,
} as const satisfies Record<string, number>;

export type CityName = keyof typeof CITY_LONGITUDES;

export const DEFAULT_LONGITUDE = CITY_LONGITUDES.서울;
