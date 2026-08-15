import { BRANCH_INFO, branchAt, type Branch } from './branches';
import { STEM_INFO, stemAt, type Stem } from './stems';

/**
 * 60갑자(六十甲子) — 천간 10과 지지 12를 함께 돌려 얻는 60개 조합.
 *
 * 천간·지지를 각각 한 칸씩 전진시키므로 음간+양지 같은 조합은 나오지 않는다.
 * (천간 인덱스와 지지 인덱스의 홀짝이 항상 일치 → 120이 아니라 60가지)
 */

export const SEXAGENARY_CYCLE_LENGTH = 60;

export type Pillar = {
  /** 0-based 60갑자 순서 (甲子=0 … 癸亥=59) */
  index: number;
  stem: Stem;
  branch: Branch;
  /** 한자 표기 (예: '甲子') */
  name: string;
  /** 한글 표기 (예: '갑자') */
  ko: string;
};

function makePillar(index: number): Pillar {
  const stem = stemAt(index);
  const branch = branchAt(index);
  return {
    index,
    stem,
    branch,
    name: `${stem}${branch}`,
    ko: `${STEM_INFO[stem].ko}${BRANCH_INFO[branch].ko}`,
  };
}

/** 갑자(甲子)부터 계해(癸亥)까지 60개 */
export const SEXAGENARY: readonly Pillar[] = Array.from(
  { length: SEXAGENARY_CYCLE_LENGTH },
  (_, i) => makePillar(i),
);

/** 음수·60 이상도 받아 60으로 순환시킨 간지를 반환한다. */
export function pillarAt(index: number): Pillar {
  return SEXAGENARY[((index % SEXAGENARY_CYCLE_LENGTH) + SEXAGENARY_CYCLE_LENGTH) % SEXAGENARY_CYCLE_LENGTH];
}

/**
 * 천간·지지 조합의 60갑자 순서를 반환한다. 성립하지 않는 조합이면 `null`.
 *
 * i ≡ stemIndex (mod 10), i ≡ branchIndex (mod 12) 의 해를
 * 중국인의 나머지 정리로 닫힌 형태로 구한다.
 */
export function pillarIndexOf(stem: Stem, branch: Branch): number | null {
  const s = STEM_INFO[stem].index;
  const b = BRANCH_INFO[branch].index;

  // 홀짝이 어긋나면 60갑자에 존재하지 않는 조합 (예: 甲丑)
  if ((s - b) % 2 !== 0) return null;

  return (((s * 6 - b * 5) % SEXAGENARY_CYCLE_LENGTH) + SEXAGENARY_CYCLE_LENGTH) % SEXAGENARY_CYCLE_LENGTH;
}

/** 천간·지지로 간지를 조회한다. 성립하지 않는 조합이면 `null`. */
export function pillarOf(stem: Stem, branch: Branch): Pillar | null {
  const index = pillarIndexOf(stem, branch);
  return index === null ? null : SEXAGENARY[index];
}
