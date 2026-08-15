import type { Branch } from './branches';
import type { Stem } from './stems';

/**
 * 지장간(支藏干) — 각 지지에 숨어 있는 천간.
 *
 * 여기(餘氣)는 앞 계절에서 넘어온 기운, 중기(中氣)는 삼합의 기운,
 * 정기(正氣)는 그 지지 본래의 기운이다. `days`는 한 절기(약 30일)를
 * 셋으로 나눈 사령(司令) 일수로, 오행 분포 가중치의 근거가 된다.
 *
 * 학파별 이설이 있는 지점:
 * - 午의 중기 己 — 9일/10일로 갈리고, 그에 따라 정기 丁이 11일/10일이 된다.
 * - 亥의 여기 戊 — 이를 빼고 甲 7일 / 壬 23일로 두는 계통도 있다.
 * 여기서는 가장 널리 쓰이는 배분(여기 7·중기 7·정기 16 계열)을 따랐다.
 */

/** 지장간의 역할 */
export type HiddenStemRole = '餘氣' | '中氣' | '正氣';

export const HIDDEN_STEM_ROLE_KO: Record<HiddenStemRole, string> = {
  餘氣: '여기',
  中氣: '중기',
  正氣: '정기',
};

export type HiddenStem = {
  stem: Stem;
  role: HiddenStemRole;
  /** 사령 일수 — 지지별 합계는 항상 30 */
  days: number;
};

/** 한 지지의 지장간 일수 합계 */
export const HIDDEN_STEM_TOTAL_DAYS = 30;

export const HIDDEN_STEMS: Record<Branch, readonly HiddenStem[]> = {
  子: [
    { stem: '壬', role: '餘氣', days: 10 },
    { stem: '癸', role: '正氣', days: 20 },
  ],
  丑: [
    { stem: '癸', role: '餘氣', days: 9 },
    { stem: '辛', role: '中氣', days: 3 },
    { stem: '己', role: '正氣', days: 18 },
  ],
  寅: [
    { stem: '戊', role: '餘氣', days: 7 },
    { stem: '丙', role: '中氣', days: 7 },
    { stem: '甲', role: '正氣', days: 16 },
  ],
  卯: [
    { stem: '甲', role: '餘氣', days: 10 },
    { stem: '乙', role: '正氣', days: 20 },
  ],
  辰: [
    { stem: '乙', role: '餘氣', days: 9 },
    { stem: '癸', role: '中氣', days: 3 },
    { stem: '戊', role: '正氣', days: 18 },
  ],
  巳: [
    { stem: '戊', role: '餘氣', days: 7 },
    { stem: '庚', role: '中氣', days: 7 },
    { stem: '丙', role: '正氣', days: 16 },
  ],
  午: [
    { stem: '丙', role: '餘氣', days: 10 },
    { stem: '己', role: '中氣', days: 9 },
    { stem: '丁', role: '正氣', days: 11 },
  ],
  未: [
    { stem: '丁', role: '餘氣', days: 9 },
    { stem: '乙', role: '中氣', days: 3 },
    { stem: '己', role: '正氣', days: 18 },
  ],
  申: [
    { stem: '戊', role: '餘氣', days: 7 },
    { stem: '壬', role: '中氣', days: 7 },
    { stem: '庚', role: '正氣', days: 16 },
  ],
  酉: [
    { stem: '庚', role: '餘氣', days: 10 },
    { stem: '辛', role: '正氣', days: 20 },
  ],
  戌: [
    { stem: '辛', role: '餘氣', days: 9 },
    { stem: '丁', role: '中氣', days: 3 },
    { stem: '戊', role: '正氣', days: 18 },
  ],
  亥: [
    { stem: '戊', role: '餘氣', days: 7 },
    { stem: '甲', role: '中氣', days: 7 },
    { stem: '壬', role: '正氣', days: 16 },
  ],
};

/**
 * 지지의 정기(正氣) 천간 — 지지를 천간으로 환원할 때의 대표값.
 * 십성 도출은 체(體) 음양이 아니라 이 값을 경유한다.
 */
export function principalStem(branch: Branch): Stem {
  const principal = HIDDEN_STEMS[branch].find((h) => h.role === '正氣');
  if (!principal) {
    throw new Error(`${branch}의 정기가 정의되어 있지 않습니다`);
  }
  return principal.stem;
}

/** 지장간 일수를 0~1 가중치로 환산한다. (예: 정기 16일 → 0.533…) */
export function hiddenStemWeight(hidden: HiddenStem): number {
  return hidden.days / HIDDEN_STEM_TOTAL_DAYS;
}
