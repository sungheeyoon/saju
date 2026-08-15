import { SearchSunLongitude } from 'astronomy-engine';

import type { Branch } from './constants/branches';

/**
 * 12절(節) — 사주 월주가 바뀌는 절기.
 * 각 절은 태양 황경이 315°에서 시작해 30° 간격으로 도달하는 시각이다.
 */
export type SolarTerm = {
  /** 절기명 (예: '입춘') */
  name: string;
  /** 목표 태양 황경 (도) */
  longitude: number;
  /** 이 절기부터 시작되는 월지 (예: '寅') */
  branch: Branch;
  /** 태양이 해당 황경에 도달하는 시각 (UTC 기준 절대 시각) */
  date: Date;
};

/** 사주년 순서: 입춘(寅)부터 30° 간격으로 12절. 마지막 소한(丑)은 다음 해 1월. */
const JEOL: ReadonlyArray<Omit<SolarTerm, 'date'>> = [
  { name: '입춘', longitude: 315, branch: '寅' },
  { name: '경칩', longitude: 345, branch: '卯' },
  { name: '청명', longitude: 15, branch: '辰' },
  { name: '입하', longitude: 45, branch: '巳' },
  { name: '망종', longitude: 75, branch: '午' },
  { name: '소서', longitude: 105, branch: '未' },
  { name: '입추', longitude: 135, branch: '申' },
  { name: '백로', longitude: 165, branch: '酉' },
  { name: '한로', longitude: 195, branch: '戌' },
  { name: '입동', longitude: 225, branch: '亥' },
  { name: '대설', longitude: 255, branch: '子' },
  { name: '소한', longitude: 285, branch: '丑' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 인접한 두 절기 간격(약 29~31일)보다 넉넉한 탐색 창.
 * 연초(1/1)에서 입춘(약 2/4)까지의 약 34일도 이 안에 든다.
 */
const SEARCH_WINDOW_DAYS = 40;

/**
 * 주어진 사주년의 12절을 시간순으로 반환한다.
 *
 * 사주년은 입춘에서 시작하므로 배열의 첫 원소는 `sajuYear`의 입춘(2월경),
 * 마지막 원소인 소한은 `sajuYear + 1`의 1월에 위치한다.
 *
 * 반환되는 `date`는 시각 그 자체(절대 시각)다. KST 등 특정 시간대 표기가
 * 필요하면 호출부에서 포매팅한다.
 *
 * @param sajuYear 입춘이 속한 양력 연도
 * @throws 절기 탐색에 실패한 경우
 */
export function getSolarTerms(sajuYear: number): SolarTerm[] {
  // 연초부터 순차 탐색: 직전 절 시각 이후로 다음 절을 찾는다.
  let cursor = new Date(Date.UTC(sajuYear, 0, 1));

  return JEOL.map(({ name, longitude, branch }) => {
    const found = SearchSunLongitude(longitude, cursor, SEARCH_WINDOW_DAYS);
    if (!found) {
      throw new Error(`${name}(황경 ${longitude}°) 탐색 실패: ${sajuYear}년`);
    }

    // 다음 절은 최소 하루 뒤이므로, 같은 황경을 다시 잡지 않도록 커서를 옮긴다.
    cursor = new Date(found.date.getTime() + DAY_MS);

    return { name, longitude, branch, date: found.date };
  });
}
