import {
  BRANCH_INFO,
  STEM_INFO,
  pillarOf,
  stemAt,
  type Branch,
  type Pillar,
  type Stem,
} from '../constants';
import { getSolarTerms, type SolarTerm } from '../solarTerms';

/**
 * 월주(月柱) — 월지는 절기로, 월간은 오호둔으로 정한다.
 *
 * 월지는 달력 월이 아니라 절기 구간이 결정한다. 예를 들어 입춘(2월 초)부터
 * 경칩(3월 초) 직전까지가 인월(寅月)이다.
 */

// ─────────────────────────────────────────────────────────────
// 절기 구간 판정
// ─────────────────────────────────────────────────────────────

// 절기 탐색은 `getSolarTerms` 가 스스로 캐시한다. 여기 또 두면 같은 것을
// 두 겹으로 들고 있게 된다.

export type MonthTerm = {
  /** 이 시각이 속한 절기 구간의 시작 절기 */
  term: SolarTerm;
  /** 그 절기가 속한 사주년 */
  sajuYear: number;
  /** 다음 절기 — 구간의 끝 */
  nextTerm: SolarTerm;
};

/**
 * 절대 시각이 어느 절기 구간에 속하는지 찾는다.
 *
 * 사주년 Y의 절기 목록은 입춘(Y년 2월)부터 소한(Y+1년 1월)까지 이어지므로,
 * 달력연도 `civilYear`의 어떤 시각이든 Y-1과 Y 두 해의 목록이면 반드시 덮인다.
 * (Y-1 목록은 Y년 1월 소한까지, Y 목록은 Y년 2월 입춘부터)
 */
export function findMonthTerm(instant: Date, civilYear: number): MonthTerm {
  const candidates = [civilYear - 1, civilYear].flatMap((sajuYear) =>
    getSolarTerms(sajuYear).map((term) => ({ term, sajuYear })),
  );

  const time = instant.getTime();
  const index = candidates.findLastIndex((c) => c.term.date.getTime() <= time);

  if (index === -1 || index === candidates.length - 1) {
    throw new Error(`절기 구간을 찾지 못했습니다: ${instant.toISOString()}`);
  }

  return {
    term: candidates[index].term,
    sajuYear: candidates[index].sajuYear,
    nextTerm: candidates[index + 1].term,
  };
}

// ─────────────────────────────────────────────────────────────
// 오호둔 (五虎遁) — 연간 → 월간
// ─────────────────────────────────────────────────────────────

/**
 * 연간으로 인월(寅月)의 천간을 정한다.
 *
 *   甲己년 → 丙寅월   乙庚년 → 戊寅월   丙辛년 → 庚寅월
 *   丁壬년 → 壬寅월   戊癸년 → 甲寅월
 *
 * 연간 인덱스를 5로 나눈 나머지에 2를 곱하고 2를 더하면 그대로 나온다.
 * (甲己가 같은 값을 갖는 것은 두 천간의 인덱스 차가 정확히 5이기 때문)
 */
export function tigerMonthStem(yearStem: Stem): Stem {
  return stemAt((STEM_INFO[yearStem].index % 5) * 2 + 2);
}

/** 연간과 월지로 월간을 구한다. 인월부터 월지 순서만큼 천간을 전진시킨다. */
export function monthStemOf(yearStem: Stem, monthBranch: Branch): Stem {
  const fromTiger = BRANCH_INFO[monthBranch].monthOrder - 1;
  return stemAt(STEM_INFO[tigerMonthStem(yearStem)].index + fromTiger);
}

export function monthPillarOf(yearStem: Stem, monthBranch: Branch): Pillar {
  const stem = monthStemOf(yearStem, monthBranch);
  const pillar = pillarOf(stem, monthBranch);

  if (!pillar) {
    // 오호둔은 항상 유효한 간지를 만든다. 여기 걸리면 상수 테이블이 깨진 것.
    throw new Error(`월주로 성립하지 않는 간지: ${stem}${monthBranch}`);
  }
  return pillar;
}
