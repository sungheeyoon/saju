import {
  BRANCH_INFO,
  STEM_INFO,
  branchAt,
  pillarOf,
  stemAt,
  type Branch,
  type Pillar,
  type Stem,
} from '../constants';

/**
 * 시주(時柱) — 시지는 두 시간 단위, 시간(時干)은 오서둔으로 정한다.
 *
 * 자시(子時)만 23:00~01:00으로 자정을 가로지른다. 이 구간을 어떻게 볼지가
 * 조자시/야자시 논쟁이고, 일주 경계와 얽히므로 `index.ts`에서 처리한다.
 */

/**
 * 시각(0~23)의 시지를 구한다.
 *
 *   子 23~01  丑 01~03  寅 03~05  卯 05~07  辰 07~09  巳 09~11
 *   午 11~13  未 13~15  申 15~17  酉 17~19  戌 19~21  亥 21~23
 */
export function hourBranchOf(hour: number): Branch {
  return branchAt(Math.floor((hour + 1) / 2));
}

/**
 * 오서둔(五鼠遁) — 일간으로 자시(子時)의 천간을 정한다.
 *
 *   甲己일 → 甲子시   乙庚일 → 丙子시   丙辛일 → 戊子시
 *   丁壬일 → 庚子시   戊癸일 → 壬子시
 *
 * 오호둔과 같은 구조이되 +2 가 없다. 일간 인덱스를 5로 나눈 나머지 × 2.
 */
export function ratHourStem(dayStem: Stem): Stem {
  return stemAt((STEM_INFO[dayStem].index % 5) * 2);
}

/** 일간과 시지로 시간(時干)을 구한다. 자시부터 시지 순서만큼 천간을 전진시킨다. */
export function hourStemOf(dayStem: Stem, hourBranch: Branch): Stem {
  return stemAt(STEM_INFO[ratHourStem(dayStem)].index + BRANCH_INFO[hourBranch].index);
}

export function hourPillarOf(dayStem: Stem, hourBranch: Branch): Pillar {
  const stem = hourStemOf(dayStem, hourBranch);
  const pillar = pillarOf(stem, hourBranch);

  if (!pillar) {
    // 오서둔도 항상 유효한 간지를 만든다. 여기 걸리면 상수 테이블이 깨진 것.
    throw new Error(`시주로 성립하지 않는 간지: ${stem}${hourBranch}`);
  }
  return pillar;
}
