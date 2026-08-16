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
/**
 * 사주년 → 12절 캐시.
 *
 * `getSolarTerms` 는 같은 해에 언제나 같은 답을 내는 순수 함수인데, 한 번에
 * 태양 황경 탐색을 열두 번 돌린다. 대운·월주·세운이 같은 해를 거듭 물으므로
 * 캐시가 없으면 세운 열 해를 뽑는 데만 백스무 번을 돈다(실측: 테스트 전체가
 * 1.3초에서 14초로 늘었다). 지원 범위가 1900~2100 이라 항목은 최대 201개다.
 *
 * 반환 배열을 호출부가 고치면 캐시가 오염되므로 복사해서 낸다.
 */
const SOLAR_TERM_CACHE = new Map<number, readonly SolarTerm[]>();

export function getSolarTerms(sajuYear: number): SolarTerm[] {
  const cached = SOLAR_TERM_CACHE.get(sajuYear) ?? searchSolarTerms(sajuYear);
  SOLAR_TERM_CACHE.set(sajuYear, cached);

  // Date 는 값이 아니라 객체다. 얕게 복사하면 호출부가 시각을 밀어 캐시를 오염시킬 수 있다.
  return cached.map((term) => ({ ...term, date: new Date(term.date) }));
}

function searchSolarTerms(sajuYear: number): SolarTerm[] {
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

/**
 * 12중기(中氣) — 절과 절 사이 한가운데.
 *
 * 절이 30° 간격이고 중기는 그 **정확히 +15°** 지점이다. 그래서 "상반월·하반월"의
 * 경계는 관습이 아니라 천문으로 정해진다 — 날짜를 반으로 가르는 것이 아니라
 * 태양이 15° 를 더 간 순간이다(지구 궤도가 타원이라 둘은 며칠 어긋난다).
 *
 * 절과 짝지어 이름을 붙인다: 입춘의 중기는 우수, 소서의 중기는 대서다.
 */
const JUNG_NAME: Record<string, string> = {
  입춘: '우수',
  경칩: '춘분',
  청명: '곡우',
  입하: '소만',
  망종: '하지',
  소서: '대서',
  입추: '처서',
  백로: '추분',
  한로: '상강',
  입동: '소설',
  대설: '동지',
  소한: '대한',
};

/**
 * 한 절의 중기를 찾는다 — 그 절의 황경 +15° 에 태양이 닿는 시각.
 *
 * 절 전체를 미리 뽑지 않고 필요한 하나만 센다. 조후의 상·하반월 판정에만 쓰이고
 * 월주·연주는 절만으로 정해지므로, 24절기를 통째로 캐시할 이유가 없다.
 */
export function midTermOf(term: SolarTerm): SolarTerm {
  const name = JUNG_NAME[term.name];
  if (!name) throw new Error(`중기를 모르는 절: ${term.name}`);

  const longitude = (term.longitude + 15) % 360;
  const found = SearchSunLongitude(longitude, term.date, SEARCH_WINDOW_DAYS);
  if (!found) throw new Error(`${name}(황경 ${longitude}°) 탐색 실패`);

  return { name, longitude, branch: term.branch, date: found.date };
}
