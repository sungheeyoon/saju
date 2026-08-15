import type { Branch, Season } from './branches';
import type { Element } from './elements';
import type { Stem } from './stems';

/**
 * 간지 간의 관계 — 합(合)·충(沖)·형(刑)·해(害)·파(破)·원진(怨嗔).
 *
 * L2 관계 연산이 이 테이블을 조회해 근거 목록을 만든다.
 * 모든 쌍은 순서 무관(무향)으로 취급하며, 조회 헬퍼가 양방향을 처리한다.
 */

/** 관계의 종류 — Reason.type 의 원천 */
export type RelationKind =
  | 'stemCombination'
  | 'stemClash'
  | 'branchSixCombination'
  | 'branchTripleCombination'
  | 'branchDirectionalCombination'
  | 'branchClash'
  | 'branchPunishment'
  | 'branchHarm'
  | 'branchDestruction'
  | 'branchResentment';

// ─────────────────────────────────────────────────────────────
// 천간
// ─────────────────────────────────────────────────────────────

export type StemCombination = {
  stems: readonly [Stem, Stem];
  /** 합화(合化)한 오행 */
  result: Element;
  ko: string;
};

/** 천간합(天干合) 5 — 인덱스가 5 떨어진 짝끼리 합한다. */
export const STEM_COMBINATIONS: readonly StemCombination[] = [
  { stems: ['甲', '己'], result: '土', ko: '갑기합토' },
  { stems: ['乙', '庚'], result: '金', ko: '을경합금' },
  { stems: ['丙', '辛'], result: '水', ko: '병신합수' },
  { stems: ['丁', '壬'], result: '木', ko: '정임합목' },
  { stems: ['戊', '癸'], result: '火', ko: '무계합화' },
];

export type StemClash = {
  stems: readonly [Stem, Stem];
  ko: string;
};

/**
 * 천간충(天干沖) 4 — 인덱스가 6 떨어지고 음양이 같으면서 서로 극하는 짝.
 * 중앙 토(戊己)는 충하는 상대가 없다.
 */
export const STEM_CLASHES: readonly StemClash[] = [
  { stems: ['甲', '庚'], ko: '갑경충' },
  { stems: ['乙', '辛'], ko: '을신충' },
  { stems: ['丙', '壬'], ko: '병임충' },
  { stems: ['丁', '癸'], ko: '정계충' },
];

// ─────────────────────────────────────────────────────────────
// 지지 — 합
// ─────────────────────────────────────────────────────────────

export type BranchSixCombination = {
  branches: readonly [Branch, Branch];
  result: Element;
  ko: string;
};

/**
 * 지지육합(六合) 6 — 두 지지 인덱스의 합이 항상 1 또는 13이 되는 짝.
 *
 * 午未의 합화 오행은 학파에 따라 火(태양·태음의 합) 또는 土로 갈린다.
 * 여기서는 火로 두었다.
 */
export const BRANCH_SIX_COMBINATIONS: readonly BranchSixCombination[] = [
  { branches: ['子', '丑'], result: '土', ko: '자축합토' },
  { branches: ['寅', '亥'], result: '木', ko: '인해합목' },
  { branches: ['卯', '戌'], result: '火', ko: '묘술합화' },
  { branches: ['辰', '酉'], result: '金', ko: '진유합금' },
  { branches: ['巳', '申'], result: '水', ko: '사신합수' },
  { branches: ['午', '未'], result: '火', ko: '오미합화' },
];

export type BranchTripleCombination = {
  /** 생지(生支) · 왕지(旺支) · 묘지(墓支) 순서 */
  branches: readonly [Branch, Branch, Branch];
  /** 왕지 — 반합(半合)이 성립하려면 이 지지가 반드시 포함되어야 한다. */
  peak: Branch;
  result: Element;
  ko: string;
};

/** 지지삼합(三合) 4국 — 생·왕·묘 세 지지가 모여 하나의 국(局)을 이룬다. */
export const BRANCH_TRIPLE_COMBINATIONS: readonly BranchTripleCombination[] = [
  { branches: ['申', '子', '辰'], peak: '子', result: '水', ko: '신자진 수국' },
  { branches: ['亥', '卯', '未'], peak: '卯', result: '木', ko: '해묘미 목국' },
  { branches: ['寅', '午', '戌'], peak: '午', result: '火', ko: '인오술 화국' },
  { branches: ['巳', '酉', '丑'], peak: '酉', result: '金', ko: '사유축 금국' },
];

export type BranchDirectionalCombination = {
  branches: readonly [Branch, Branch, Branch];
  result: Element;
  season: Season;
  ko: string;
};

/** 지지방합(方合) 4 — 같은 계절의 세 지지가 모여 그 계절의 오행을 이룬다. */
export const BRANCH_DIRECTIONAL_COMBINATIONS: readonly BranchDirectionalCombination[] = [
  { branches: ['寅', '卯', '辰'], result: '木', season: '春', ko: '인묘진 목방' },
  { branches: ['巳', '午', '未'], result: '火', season: '夏', ko: '사오미 화방' },
  { branches: ['申', '酉', '戌'], result: '金', season: '秋', ko: '신유술 금방' },
  { branches: ['亥', '子', '丑'], result: '水', season: '冬', ko: '해자축 수방' },
];

// ─────────────────────────────────────────────────────────────
// 지지 — 충·형·해·파·원진
// ─────────────────────────────────────────────────────────────

export type BranchPair = {
  branches: readonly [Branch, Branch];
  ko: string;
};

/** 지지충(六沖) 6 — 인덱스가 정확히 6 떨어진, 정반대 방위의 짝 */
export const BRANCH_CLASHES: readonly BranchPair[] = [
  { branches: ['子', '午'], ko: '자오충' },
  { branches: ['丑', '未'], ko: '축미충' },
  { branches: ['寅', '申'], ko: '인신충' },
  { branches: ['卯', '酉'], ko: '묘유충' },
  { branches: ['辰', '戌'], ko: '진술충' },
  { branches: ['巳', '亥'], ko: '사해충' },
];

/** 형(刑)은 세 지지가 모이는 삼형, 두 지지의 상형, 같은 지지가 겹치는 자형으로 나뉜다. */
export type BranchPunishment =
  | { kind: 'triple'; branches: readonly [Branch, Branch, Branch]; ko: string; name: string }
  | { kind: 'mutual'; branches: readonly [Branch, Branch]; ko: string; name: string }
  | { kind: 'self'; branch: Branch; ko: string; name: string };

export const BRANCH_PUNISHMENTS: readonly BranchPunishment[] = [
  { kind: 'triple', branches: ['寅', '巳', '申'], ko: '인사신 삼형', name: '무은지형' },
  { kind: 'triple', branches: ['丑', '戌', '未'], ko: '축술미 삼형', name: '지세지형' },
  { kind: 'mutual', branches: ['子', '卯'], ko: '자묘형', name: '무례지형' },
  { kind: 'self', branch: '辰', ko: '진진형', name: '자형' },
  { kind: 'self', branch: '午', ko: '오오형', name: '자형' },
  { kind: 'self', branch: '酉', ko: '유유형', name: '자형' },
  { kind: 'self', branch: '亥', ko: '해해형', name: '자형' },
];

/** 지지해(六害/穿) 6 — 육합을 충으로 깨뜨리는 관계 */
export const BRANCH_HARMS: readonly BranchPair[] = [
  { branches: ['子', '未'], ko: '자미해' },
  { branches: ['丑', '午'], ko: '축오해' },
  { branches: ['寅', '巳'], ko: '인사해' },
  { branches: ['卯', '辰'], ko: '묘진해' },
  { branches: ['申', '亥'], ko: '신해해' },
  { branches: ['酉', '戌'], ko: '유술해' },
];

/** 지지파(六破) 6 */
export const BRANCH_DESTRUCTIONS: readonly BranchPair[] = [
  { branches: ['子', '酉'], ko: '자유파' },
  { branches: ['丑', '辰'], ko: '축진파' },
  { branches: ['寅', '亥'], ko: '인해파' },
  { branches: ['卯', '午'], ko: '묘오파' },
  { branches: ['巳', '申'], ko: '사신파' },
  { branches: ['戌', '未'], ko: '술미파' },
];

/** 원진(怨嗔) 6 — 자미·축오는 해(害)와 겹친다. */
export const BRANCH_RESENTMENTS: readonly BranchPair[] = [
  { branches: ['子', '未'], ko: '자미원진' },
  { branches: ['丑', '午'], ko: '축오원진' },
  { branches: ['寅', '酉'], ko: '인유원진' },
  { branches: ['卯', '申'], ko: '묘신원진' },
  { branches: ['辰', '亥'], ko: '진해원진' },
  { branches: ['巳', '戌'], ko: '사술원진' },
];

// ─────────────────────────────────────────────────────────────
// 조회 헬퍼 — 모두 순서 무관
// ─────────────────────────────────────────────────────────────

function matchesPair<T>(pair: readonly [T, T], a: T, b: T): boolean {
  return (pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a);
}

export function findStemCombination(a: Stem, b: Stem): StemCombination | null {
  return STEM_COMBINATIONS.find((c) => matchesPair(c.stems, a, b)) ?? null;
}

export function findStemClash(a: Stem, b: Stem): StemClash | null {
  return STEM_CLASHES.find((c) => matchesPair(c.stems, a, b)) ?? null;
}

export function findBranchSixCombination(a: Branch, b: Branch): BranchSixCombination | null {
  return BRANCH_SIX_COMBINATIONS.find((c) => matchesPair(c.branches, a, b)) ?? null;
}

export function findBranchClash(a: Branch, b: Branch): BranchPair | null {
  return BRANCH_CLASHES.find((c) => matchesPair(c.branches, a, b)) ?? null;
}

export function findBranchHarm(a: Branch, b: Branch): BranchPair | null {
  return BRANCH_HARMS.find((c) => matchesPair(c.branches, a, b)) ?? null;
}

export function findBranchDestruction(a: Branch, b: Branch): BranchPair | null {
  return BRANCH_DESTRUCTIONS.find((c) => matchesPair(c.branches, a, b)) ?? null;
}

export function findBranchResentment(a: Branch, b: Branch): BranchPair | null {
  return BRANCH_RESENTMENTS.find((c) => matchesPair(c.branches, a, b)) ?? null;
}

export type TripleCombinationMatch = {
  combination: BranchTripleCombination;
  matched: Branch[];
  /** 세 지지가 모두 모였으면 true, 왕지를 낀 반합이면 false */
  full: boolean;
};

/**
 * 주어진 지지 집합에서 성립하는 삼합을 찾는다.
 * `partial: true`면 왕지를 포함한 반합(半合)도 함께 반환한다.
 */
export function findTripleCombinations(
  branches: readonly Branch[],
  options: { partial?: boolean } = {},
): TripleCombinationMatch[] {
  const present = new Set(branches);

  return BRANCH_TRIPLE_COMBINATIONS.flatMap<TripleCombinationMatch>((combination) => {
    const matched = combination.branches.filter((b) => present.has(b));
    const full = matched.length === 3;

    if (full) return [{ combination, matched, full }];

    const isHalf =
      options.partial === true && matched.length === 2 && matched.includes(combination.peak);

    return isHalf ? [{ combination, matched, full }] : [];
  });
}

/** 주어진 지지 집합에서 완전히 성립하는 방합을 찾는다. */
export function findDirectionalCombinations(
  branches: readonly Branch[],
): BranchDirectionalCombination[] {
  const present = new Set(branches);
  return BRANCH_DIRECTIONAL_COMBINATIONS.filter((c) =>
    c.branches.every((b) => present.has(b)),
  );
}

/**
 * 주어진 지지 집합에서 성립하는 형(刑)을 찾는다.
 * 자형은 같은 지지가 둘 이상 있을 때만 성립하므로 중복을 세어 판정한다.
 */
export function findPunishments(branches: readonly Branch[]): BranchPunishment[] {
  const counts = new Map<Branch, number>();
  for (const b of branches) counts.set(b, (counts.get(b) ?? 0) + 1);

  return BRANCH_PUNISHMENTS.filter((p) => {
    if (p.kind === 'self') return (counts.get(p.branch) ?? 0) >= 2;
    return p.branches.every((b) => counts.has(b));
  });
}
