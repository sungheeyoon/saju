import {
  BRANCHES,
  BRANCH_TRIPLE_COMBINATIONS,
  type Branch,
  type Element,
} from '../constants';
import type { Pillars } from '../pillars';
import { PILLAR_POSITIONS, type PillarPosition } from '../position';

/**
 * 12신살(十二神殺) — 기준 지지의 삼합국에 따라 열두 지지에 붙는 이름.
 *
 * 겁살에서 시작해 지지 순서대로 열둘이 한 바퀴 돈다. 어디서 시작하느냐가
 * 기준 지지가 속한 삼합국으로 정해진다 — 국의 묘지(墓支) 다음 자리가 겁살이다.
 * 申子辰 수국이면 묘지 辰의 다음인 巳가 겁살이고, 거기서부터 세면 생지 申이
 * 지살, 왕지 子가 장성살, 묘지 辰이 화개살로 떨어진다.
 *
 * **정책: 년지 기준과 일지 기준을 모두 낸다.** 년지 기준이 전통이고
 * 일지 기준을 함께 보는 현대 계통이 흔하다. 둘 중 하나만 내면 다른 계통의
 * 화면을 만들 수 없으므로 둘 다 내고 고르는 것은 쓰는 쪽에 맡긴다.
 *
 * 역마·도화(연살)·화개는 따로 뽑지 않는다. 여기서 나오는 값을 그대로 쓴다 —
 * 같은 것을 두 곳에서 계산하면 언젠가 어긋난다.
 */

export type TwelveSpirit =
  | '劫殺'
  | '災殺'
  | '天殺'
  | '地殺'
  | '年殺'
  | '月殺'
  | '亡身殺'
  | '將星殺'
  | '攀鞍殺'
  | '驛馬殺'
  | '六害殺'
  | '華蓋殺';

/** 겁살부터 지지 순서대로 */
export const TWELVE_SPIRITS = [
  '劫殺',
  '災殺',
  '天殺',
  '地殺',
  '年殺',
  '月殺',
  '亡身殺',
  '將星殺',
  '攀鞍殺',
  '驛馬殺',
  '六害殺',
  '華蓋殺',
] as const satisfies readonly TwelveSpirit[];

export const TWELVE_SPIRIT_KO: Record<TwelveSpirit, string> = {
  劫殺: '겁살',
  災殺: '재살',
  天殺: '천살',
  地殺: '지살',
  年殺: '연살',
  月殺: '월살',
  亡身殺: '망신살',
  將星殺: '장성살',
  攀鞍殺: '반안살',
  驛馬殺: '역마살',
  六害殺: '육해살',
  華蓋殺: '화개살',
};

/**
 * 널리 쓰이는 딴이름.
 *
 * 연살은 도화살, 육해살은 육액살로도 부른다. 화개살은 딴이름이 없지만
 * '화개'로 줄여 부르는 일이 많다.
 */
export const TWELVE_SPIRIT_ALIAS: Partial<Record<TwelveSpirit, string>> = {
  年殺: '도화살',
  六害殺: '육액살',
};

const branchIndexOf = (branch: Branch): number => BRANCHES.indexOf(branch);

/** 그 지지가 속한 삼합국 — 열두 지지가 모두 넷 중 하나에 속한다 */
function localeOf(branch: Branch) {
  const found = BRANCH_TRIPLE_COMBINATIONS.find((c) => c.branches.includes(branch));
  // 삼합 네 국이 열두 지지를 남김없이 나눠 가지므로 여기에 걸릴 지지는 없다.
  if (!found) throw new Error(`삼합국에 속하지 않는 지지: ${branch}`);
  return found;
}

/** 기준 지지의 국에서 겁살이 놓이는 자리 — 묘지의 다음 지지 */
function robberyIndexOf(basis: Branch): number {
  const { branches } = localeOf(basis);
  const grave = branches[2];
  return (branchIndexOf(grave) + 1) % BRANCHES.length;
}

/** 기준 지지에서 볼 때 대상 지지가 어떤 신살인가 */
export function twelveSpiritOf(basis: Branch, target: Branch): TwelveSpirit {
  const offset = (branchIndexOf(target) - robberyIndexOf(basis) + BRANCHES.length) % BRANCHES.length;
  return TWELVE_SPIRITS[offset];
}

/** 기준 지지에서 본 열두 지지 전체 — 검산과 화면 설명에 쓴다 */
export function twelveSpiritBranchesOf(basis: Branch): Record<TwelveSpirit, Branch> {
  const start = robberyIndexOf(basis);

  return Object.fromEntries(
    TWELVE_SPIRITS.map((spirit, index) => [spirit, BRANCHES[(start + index) % BRANCHES.length]]),
  ) as Record<TwelveSpirit, Branch>;
}

/** 12신살을 어느 지지 기준으로 뽑았는가 */
export type SpiritBasis = 'year' | 'day';

export const SPIRIT_BASIS_KO: Record<SpiritBasis, string> = {
  year: '년지',
  day: '일지',
};

export type SpiritChart = {
  basis: SpiritBasis;
  basisBranch: Branch;
  /** 기준 지지가 속한 삼합국이 지향하는 오행 — 어디서 시작했는지의 근거 */
  locale: Element;
  byPosition: Record<PillarPosition, TwelveSpirit | null>;
};

type SpiritInput = Pick<Pillars, 'year' | 'month' | 'day' | 'hour'>;

function chartOf(pillars: SpiritInput, basis: SpiritBasis): SpiritChart {
  const basisBranch = pillars[basis].branch;

  return {
    basis,
    basisBranch,
    locale: localeOf(basisBranch).result,
    byPosition: Object.fromEntries(
      PILLAR_POSITIONS.map((position) => {
        const pillar = pillars[position];
        // 시간 미상이면 시주가 없다. 없는 지지에 신살을 붙이지 않는다.
        return [position, pillar ? twelveSpiritOf(basisBranch, pillar.branch) : null];
      }),
    ) as Record<PillarPosition, TwelveSpirit | null>,
  };
}

/** 년지 기준과 일지 기준 12신살을 함께 낸다 */
export function findTwelveSpirits(pillars: SpiritInput): SpiritChart[] {
  return [chartOf(pillars, 'year'), chartOf(pillars, 'day')];
}
