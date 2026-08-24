/**
 * 음력 표의 외부 대조 자료 — 한국천문연구원이 낸 표를 그대로 옮긴 것.
 *
 * 출처: 박한얼·민병희·안영숙, 「한국 음력의 운용과 계산법 연구」,
 * Publications of the Korean Astronomical Society 32(3), 2017, 407~420.
 * https://doi.org/10.5303/PKAS.2017.32.3.407
 *
 * 이 파일은 **손으로 옮긴 사실**이고 우리 계산이 아니다. 표가 이 자료와
 * 어긋나면 고쳐야 하는 것은 이 파일이 아니라 생성기다.
 */

/**
 * Table 8 — 19년 주기로 나타낸 윤달 배치(1903년부터)에서 이 표의 범위만 옮겼다.
 *
 * 없는 해는 윤달이 없는 해다. 1984년 윤10월과 2033년 윤11월처럼 드문 배치가
 * 그대로 들어 있어야 옮긴 것이 맞다.
 */
export const KASI_LEAP_MONTHS: Readonly<Record<number, number>> = {
  1914: 5, 1917: 2, 1919: 7, 1922: 5, 1925: 4, 1928: 2,
  1930: 6, 1933: 5, 1936: 3, 1938: 7, 1941: 6, 1944: 4,
  1947: 2, 1949: 7, 1952: 5, 1955: 3, 1957: 8, 1960: 6,
  1963: 4, 1966: 3, 1968: 7, 1971: 5, 1974: 4, 1976: 8,
  1979: 6, 1982: 4, 1984: 10, 1987: 6, 1990: 5, 1993: 3,
  1995: 8, 1998: 5, 2001: 4, 2004: 2, 2006: 7, 2009: 5,
  2012: 3, 2014: 9, 2017: 5, 2020: 4, 2023: 2, 2025: 6,
  2028: 5, 2031: 3, 2033: 11, 2036: 6, 2039: 5, 2042: 2,
  2044: 7, 2047: 5, 2050: 3, 2052: 8, 2055: 6, 2058: 4,
  2061: 3, 2063: 7, 2066: 5, 2069: 4, 2071: 8, 2074: 6,
  2077: 4, 2080: 3, 2082: 7, 2085: 5, 2088: 4, 2090: 8,
  2093: 6, 2096: 4, 2099: 3,
};

/**
 * Table 7 — 한국 음력과 중국 농력의 초하루가 갈린 달(우리 범위만).
 *
 * 이 표가 대조 자료로 값진 이유는 **갈리는 자리만 모아 놓았기 때문**이다.
 * 두 나라의 차이는 표준자오선 한 시간뿐이므로, 여기 실린 달은 모두 삭이
 * 한국표준시 0시~1시에 든 달이다. 기준 시각을 한 시간이라도 잘못 잡으면
 * 이 목록이 통째로 하루씩 어긋난다.
 *
 * `solar` 는 **한국** 음력 초하루의 양력 날짜다(중국은 그 전날).
 */
export type KasiMonthFirstDay = {
  year: number;
  month: number;
  leap: boolean;
  solar: string;
};

export const KASI_MONTH_FIRST_DAYS: readonly KasiMonthFirstDay[] = [
  { year: 1914, month: 5, leap: true, solar: '1914-06-24' },
  { year: 1914, month: 10, leap: false, solar: '1914-11-18' },
  { year: 1916, month: 1, leap: false, solar: '1916-02-04' },
  { year: 1918, month: 11, leap: false, solar: '1918-12-04' },
  { year: 1919, month: 7, leap: true, solar: '1919-08-26' },
  { year: 1919, month: 10, leap: false, solar: '1919-11-23' },
  { year: 1920, month: 10, leap: false, solar: '1920-11-11' },
  { year: 1923, month: 10, leap: false, solar: '1923-11-09' },
  { year: 1924, month: 2, leap: false, solar: '1924-03-06' },
  { year: 1925, month: 4, leap: true, solar: '1925-05-23' },
  { year: 1927, month: 10, leap: false, solar: '1927-10-26' },
  { year: 1928, month: 9, leap: false, solar: '1928-10-14' },
  { year: 1931, month: 4, leap: false, solar: '1931-05-18' },
  { year: 1934, month: 9, leap: false, solar: '1934-10-09' },
  { year: 1936, month: 6, leap: false, solar: '1936-07-19' },
  { year: 1942, month: 8, leap: false, solar: '1942-09-11' },
  { year: 1942, month: 10, leap: false, solar: '1942-11-09' },
  { year: 1943, month: 11, leap: false, solar: '1943-11-28' },
  { year: 1944, month: 1, leap: false, solar: '1944-01-26' },
  { year: 1949, month: 3, leap: false, solar: '1949-03-30' },
  { year: 1950, month: 2, leap: false, solar: '1950-03-19' },
  { year: 1950, month: 5, leap: false, solar: '1950-06-16' },
  { year: 1952, month: 7, leap: false, solar: '1952-08-21' },
  { year: 1954, month: 1, leap: false, solar: '1954-02-04' },
  { year: 1955, month: 2, leap: false, solar: '1955-02-23' },
  { year: 1958, month: 1, leap: false, solar: '1958-02-19' },
  { year: 1966, month: 1, leap: false, solar: '1966-01-22' },
  { year: 1968, month: 4, leap: false, solar: '1968-04-28' },
  { year: 1970, month: 6, leap: false, solar: '1970-07-04' },
  { year: 1972, month: 12, leap: false, solar: '1973-01-05' },
  { year: 1973, month: 12, leap: false, solar: '1973-12-25' },
  { year: 1976, month: 10, leap: false, solar: '1976-11-22' },
  { year: 1978, month: 3, leap: false, solar: '1978-04-08' },
  { year: 1982, month: 10, leap: false, solar: '1982-11-16' },
  { year: 1987, month: 5, leap: false, solar: '1987-05-28' },
  { year: 1988, month: 1, leap: false, solar: '1988-02-18' },
  { year: 1989, month: 10, leap: false, solar: '1989-10-30' },
  { year: 1990, month: 9, leap: false, solar: '1990-10-19' },
  { year: 1995, month: 7, leap: false, solar: '1995-07-28' },
  { year: 1995, month: 10, leap: false, solar: '1995-11-23' },
  { year: 1997, month: 1, leap: false, solar: '1997-02-08' },
  { year: 1998, month: 12, leap: false, solar: '1999-01-18' },
  { year: 2001, month: 4, leap: false, solar: '2001-04-24' },
  { year: 2005, month: 11, leap: false, solar: '2005-12-02' },
  { year: 2012, month: 5, leap: false, solar: '2012-06-20' },
  { year: 2012, month: 7, leap: false, solar: '2012-08-18' },
  { year: 2013, month: 5, leap: false, solar: '2013-06-09' },
  { year: 2019, month: 11, leap: false, solar: '2019-11-27' },
  { year: 2023, month: 4, leap: false, solar: '2023-05-20' },
  { year: 2026, month: 9, leap: false, solar: '2026-10-11' },
  { year: 2027, month: 1, leap: false, solar: '2027-02-07' },
  { year: 2028, month: 1, leap: false, solar: '2028-01-27' },
  { year: 2029, month: 6, leap: false, solar: '2029-07-12' },
  { year: 2031, month: 2, leap: false, solar: '2031-02-22' },
  { year: 2034, month: 12, leap: false, solar: '2035-01-10' },
  { year: 2036, month: 11, leap: false, solar: '2036-12-18' },
  { year: 2040, month: 8, leap: false, solar: '2040-09-07' },
  { year: 2041, month: 2, leap: false, solar: '2041-03-03' },
  { year: 2046, month: 5, leap: false, solar: '2046-06-05' },
  { year: 2048, month: 11, leap: false, solar: '2048-12-06' },
  { year: 2050, month: 2, leap: false, solar: '2050-02-22' },
];

/**
 * Table 2·3 — ΔT 불확도 때문에 날짜를 특정하기 어려운 경우(우리 범위만).
 *
 * KASI 는 DE430 천체력과 자체 ΔT 모형을 쓰고 우리는 astronomy-engine 을 쓴다.
 * 시각이 초 단위까지 같을 수는 없으므로 **날짜 배정이 같은지**를 본다. 자정에서
 * 10~30초 떨어진 이 사례들이 같은 날로 떨어지면 그 사이의 평범한 달들은
 * 따져 볼 것도 없다.
 */
export const KASI_NEAR_MIDNIGHT_NEW_MOONS = [
  { newMoonKst: '2051-11-03 23:59:08', lunarDate: '2051-10-01', solarDate: '2051-11-03' },
  { newMoonKst: '2074-08-22 23:59:30', lunarDate: '2074-07-01', solarDate: '2074-08-22' },
  { newMoonKst: '2097-01-14 00:00:08', lunarDate: '2096-12-01', solarDate: '2097-01-14' },
] as const;

export const KASI_NEAR_MIDNIGHT_DONGJI = [
  { dongjiKst: '2095-12-22 00:00:20', solarDate: '2095-12-22' },
] as const;

/**
 * Table 6 — 역서에 실린 음력 날짜와 지금 계산이 어긋나는 여덟 건. **전부 1912년 앞이다.**
 *
 * 표의 하한이 1900 이 아니라 1912 인 근거가 이것이다. 당시 대한제국·조선은
 * 독자 표준자오선을 정해 두고도 역서는 중국 역을 따랐으므로, 지금 규칙으로
 * 계산하면 이 달들이 하루씩 밀린다. 계산으로 복원되지 않는 구간이라 넣지 않는다.
 *
 * `almanac` 이 실제로 시행된 날짜이고 `calculated` 가 지금 규칙의 답이다.
 */
export const KASI_PRE_1912_MISMATCHES = [
  { lunarDate: '1903-09-01', almanac: '1903-10-20', calculated: '1903-10-21' },
  { lunarDate: '1903-12-01', almanac: '1904-01-17', calculated: '1904-01-18' },
  { lunarDate: '1904-10-01', almanac: '1904-11-07', calculated: '1904-11-08' },
  { lunarDate: '1905-04-01', almanac: '1905-05-04', calculated: '1905-05-05' },
  { lunarDate: '1907-06-01', almanac: '1907-07-10', calculated: '1907-07-11' },
  { lunarDate: '1908-04-01', almanac: '1908-04-30', calculated: '1908-05-01' },
  { lunarDate: '1909-08-01', almanac: '1909-09-14', calculated: '1909-09-15' },
  { lunarDate: '1911-11-01', almanac: '1911-12-20', calculated: '1911-12-21' },
] as const;
