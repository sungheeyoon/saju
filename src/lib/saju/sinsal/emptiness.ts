import {
  BRANCHES,
  SEXAGENARY_CYCLE_LENGTH,
  STEMS,
  type Branch,
  type Pillar,
} from '../constants';
import type { Pillars } from '../pillars';
import { PILLAR_POSITIONS, type PillarPosition } from '../position';

/**
 * 공망(空亡) — 순중공망(旬中空亡).
 *
 * 육십갑자는 열 개씩 여섯 순(旬)으로 나뉜다. 천간은 열이고 지지는 열둘이라
 * 한 순마다 짝을 못 찾은 지지가 둘씩 남는데, 그 둘이 공망이다. 甲子순
 * (甲子~癸酉)이면 戌·亥가 남는다.
 *
 * 표를 두지 않고 육십갑자에서 곧장 센다. 여섯 줄짜리 표를 옮겨 적는 것보다
 * "짝을 못 찾은 지지"라는 정의를 그대로 코드로 두는 편이 어긋날 여지가 없다.
 *
 * **정책: 일주 기준과 년주 기준을 모두 낸다.** 일주 기준이 기본이지만
 * 년주 기준을 함께 보는 계통이 흔하고, 둘은 서로를 대체하지 않는다.
 * 어느 쪽을 볼지는 쓰는 쪽에서 고르면 된다.
 *
 * 기준이 된 기둥 자신의 지지는 구조상 공망이 될 수 없다 — 같은 순 안에
 * 있으니 짝이 있다. 그래서 따로 걸러내지 않아도 결과에 나오지 않는다.
 */

/** 공망을 어느 기둥 기준으로 뽑았는가 */
export type EmptinessBasis = 'day' | 'year';

export const EMPTINESS_BASIS_KO: Record<EmptinessBasis, string> = {
  day: '일주',
  year: '년주',
};

export type Emptiness = {
  basis: EmptinessBasis;
  /** 기준이 된 간지 — '甲子' */
  basisPillar: string;
  /** 그 순(旬)에서 짝을 못 찾은 두 지지 */
  branches: readonly [Branch, Branch];
  /** 실제로 그 지지가 놓인 자리. 하나도 없을 수 있다 */
  positions: readonly PillarPosition[];
};

const STEM_COUNT = STEMS.length;
const BRANCH_COUNT = BRANCHES.length;

/**
 * 그 간지가 속한 순의 공망 두 지지.
 *
 * 순의 첫 간지(甲으로 시작하는 자리)를 찾아 그 지지부터 열 칸을 세면,
 * 열째와 열한째 자리가 짝을 못 찾고 남는다.
 */
export function emptyBranchesOf(pillar: Pillar): readonly [Branch, Branch] {
  const cycleStart = pillar.index - (pillar.index % STEM_COUNT);
  const firstBranch = cycleStart % BRANCH_COUNT;

  return [
    BRANCHES[(firstBranch + STEM_COUNT) % BRANCH_COUNT],
    BRANCHES[(firstBranch + STEM_COUNT + 1) % BRANCH_COUNT],
  ];
}

type EmptinessInput = Pick<Pillars, 'year' | 'month' | 'day' | 'hour'>;

function emptinessFrom(
  pillars: EmptinessInput,
  basis: EmptinessBasis,
  basisPillar: Pillar,
): Emptiness {
  const branches = emptyBranchesOf(basisPillar);

  return {
    basis,
    basisPillar: basisPillar.name,
    branches,
    positions: PILLAR_POSITIONS.filter((position) => {
      const pillar = pillars[position];
      return pillar !== null && branches.includes(pillar.branch);
    }),
  };
}

/** 일주 기준과 년주 기준 공망을 함께 낸다 */
export function findEmptiness(pillars: EmptinessInput): Emptiness[] {
  return [
    emptinessFrom(pillars, 'day', pillars.day),
    emptinessFrom(pillars, 'year', pillars.year),
  ];
}

/** 육십갑자가 열 개씩 여섯 순으로 나뉜다는 사실 — 검산용 */
export const SEXAGENARY_CYCLE_COUNT = SEXAGENARY_CYCLE_LENGTH / STEM_COUNT;
