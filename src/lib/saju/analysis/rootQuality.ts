import {
  HIDDEN_STEM_ROLE_KO,
  findBranchClash,
  type Branch,
  type Element,
  type HiddenStemRole,
} from '../constants';
import type { Pillars } from '../pillars';
import { PILLAR_POSITIONS, PILLAR_POSITION_KO, type PillarPosition } from '../position';
import type { Bureau } from './bureau';
import type { Root, Rootedness, StemRooting } from './rootedness';

/**
 * 뿌리의 질(質) — **판정이다.** 그래서 `rootedness.ts` 안에 넣지 않았다.
 *
 * `rootedness.ts` 는 「질은 매기지 않는다」를 정책으로 못박고 있다. 그 약속을
 * 깨고 거기에 점수를 넣으면, 사실을 읽으러 온 쪽이 판정을 함께 집어 가게 된다.
 * 대신 그 사실을 받아 여기서 등급을 매긴다 — 사실은 행, 판정은 문장이라는
 * 이 저장소의 갈래를 뿌리에도 그대로 적용한 것이다.
 *
 * 무엇을 보는가. 같은 「뿌리 하나」라도 이만큼 다르다.
 *
 *   자리     월지의 뿌리는 계절을 쥔다. 시지의 뿌리와 같은 무게일 수 없다
 *   역할     정기에 걸린 뿌리와 여기에 걸린 뿌리가 같을 수 없다
 *   글자     같은 글자에 걸렸는가, 음양만 다른 같은 오행인가
 *   지지     왕지·생지·고지 — 고지의 뿌리는 열려야 쓴다는 말이 여기서 나온다
 *   상함     충을 맞았는가, 국(局)에 끌려갔는가
 *
 * 마지막 하나가 이 파일을 쓴 까닭이다. 《적천수천미》가 「丙火之根已拔」이라 적은
 * 명조를 우리는 여태 「寅에 통근함」으로 세고 있었다 — 寅이 申 셋에게 충을 맞아
 * 뽑힌 것을 안 보았기 때문이다. 뿌리가 있다는 사실만으로는 그 문장을 따라갈 수 없다.
 */

/** 지지의 갈래 — 왕지(旺支)·생지(生支)·고지(庫支) */
export type BranchClass = 'peak' | 'birth' | 'storage';

export const BRANCH_CLASS_KO: Record<BranchClass, string> = {
  peak: '왕지',
  birth: '생지',
  storage: '고지',
};

export const BRANCH_CLASS: Record<Branch, BranchClass> = {
  子: 'peak', 午: 'peak', 卯: 'peak', 酉: 'peak',
  寅: 'birth', 申: 'birth', 巳: 'birth', 亥: 'birth',
  辰: 'storage', 戌: 'storage', 丑: 'storage', 未: 'storage',
};

export const ROOT_QUALITY_POLICY = {
  ruleSet: 'root-quality-v1',
  /** 고전에서 온 숫자가 아니라 이 엔진이 고른 배수다 */
  status: 'experimental',
  /**
   * 역할별 배수. 사령 일수와 따로 둔다.
   *
   * 일수만으로 재면 卯의 여기 甲(10일)이 寅의 정기 甲(16일)의 3분의 2쯤 된다.
   * 그러나 통근을 말할 때 여기에 걸린 뿌리를 정기의 3분의 2로 치는 계통은 없다.
   * 일수는 「얼마나 오래 사령하는가」이고 역할은 「그 지지의 무엇인가」라서 서로
   * 다른 것을 잰다.
   */
  role: { 正氣: 1, 中氣: 0.5, 餘氣: 0.25 } satisfies Record<HiddenStemRole, number>,
  /** 같은 글자인가, 음양만 다른 같은 오행인가 */
  kind: { 'same-stem': 1, 'same-element': 0.7 },
  /** 자리 — 월지가 가장 무겁다 */
  position: { month: 1.5, day: 1.2, year: 1, hour: 1 } satisfies Record<PillarPosition, number>,
  /** 고지의 뿌리를 깎는다. 「묘고는 충해야 열린다」를 문턱이 아니라 배수로 반영한 것이다 */
  branchClass: { peak: 1, birth: 0.85, storage: 0.6 } satisfies Record<BranchClass, number>,
  /**
   * 뿌리가 된 지지가 충을 맞으면 깎는다.
   *
   * 관계 연산은 「충이 뿌리를 상하게 하는가」를 판정하지 않는다. 옳다 — 거기서는
   * 계통을 고르면 안 된다. 그러나 여기는 판정하는 자리이고, 고전이 뿌리가 뽑혔다고
   * 적은 명조를 따라가려면 이 배수가 있어야 한다. 0 으로 두면 예전 셈으로 돌아간다.
   */
  clashed: 0.4,
  /**
   * 국(局)에 끌려간 지지는 그만큼 제 오행의 뿌리 노릇을 못 한다.
   *
   * 亥卯未가 木局을 이루면 未는 土로 논하지 않는다는 말이 이것이다. 국이 가져간
   * 몫(`Bureau.pull`)을 그대로 빼므로 배수를 따로 고르지 않는다.
   */
  bureauDefection: 'by-bureau-pull',
} as const;

/** 뿌리 하나의 질 */
export type GradedRoot = {
  root: Root;
  branchClass: BranchClass;
  /** 이 지지가 충을 맞고 있는가 */
  clashed: boolean;
  /** 이 지지가 다른 오행의 국에 끌려간 몫 (0~1) */
  defected: number;
  /** 배수를 다 곱한 값 — 정기·같은 글자·왕지·월지가 가장 크다 */
  strength: number;
  /** 사람이 읽는 한 줄 */
  detail: string;
};

/** 한 천간의 통근 질 */
export type RootQuality = {
  status: 'experimental';
  position: PillarPosition;
  element: Element;
  roots: readonly GradedRoot[];
  /** 뿌리 질의 합 */
  strength: number;
  /**
   * 뿌리가 있다고 세었으나 남은 것이 없는가.
   *
   * `Rootedness.rooted` 는 「지장간에 같은 오행이 있는가」라는 사실이고, 이쪽은
   * 「그래서 쓸 것이 남았는가」라는 판정이다. 충에 뽑히거나 국에 끌려가면 뿌리는
   * 세어지되 힘은 없다 — 두 값이 갈리는 자리가 바로 고전이 「根已拔」이라 적은
   * 자리다.
   */
  effectivelyRootless: boolean;
};

/**
 * 뿌리가 남아 있다고 볼 최소치.
 *
 * 여기(餘氣)에 음양만 같은 오행으로 걸린 고지의 뿌리 하나가 대략 0.1 이다.
 * 그보다 얕으면 세어도 쓸 것이 없다고 본다.
 */
export const EFFECTIVE_ROOT_FLOOR = 0.1;

type QualityInput = Pick<Pillars, 'year' | 'month' | 'day' | 'hour'>;

/** 뿌리가 된 지지가 원국의 다른 지지에게 충을 맞는가 */
function clashedBranches(pillars: QualityInput): Set<Branch> {
  const branches = PILLAR_POSITIONS.flatMap((position) => {
    const pillar = pillars[position];
    return pillar === null ? [] : [pillar.branch];
  });

  const clashed = new Set<Branch>();
  for (const a of branches) {
    for (const b of branches) {
      if (a !== b && findBranchClash(a, b) !== null) clashed.add(a);
    }
  }
  return clashed;
}

/** 각 자리가 **다른 오행의** 국에 끌려간 몫 */
function defectionByPosition(
  bureaus: readonly Bureau[],
  element: Element,
): Map<PillarPosition, number> {
  const defection = new Map<PillarPosition, number>();
  for (const bureau of bureaus) {
    if (bureau.element === element) continue;
    for (const member of bureau.members) {
      defection.set(member.position, Math.min(1, (defection.get(member.position) ?? 0) + bureau.pull));
    }
  }
  return defection;
}

export function gradeRooting(
  rooting: StemRooting,
  pillars: QualityInput,
  bureaus: readonly Bureau[] = [],
): RootQuality {
  const clashed = clashedBranches(pillars);
  const defection = defectionByPosition(bureaus, rooting.element);
  const { role, kind, position, branchClass } = ROOT_QUALITY_POLICY;

  const roots = rooting.roots.map((root): GradedRoot => {
    const branchType = BRANCH_CLASS[root.branch];
    const isClashed = clashed.has(root.branch);
    const defected = defection.get(root.position) ?? 0;

    const strength =
      role[root.role] *
      kind[root.kind] *
      position[root.position] *
      branchClass[branchType] *
      (isClashed ? ROOT_QUALITY_POLICY.clashed : 1) *
      (1 - defected);

    const notes = [
      `${PILLAR_POSITION_KO[root.position]} ${root.branch}의 ${HIDDEN_STEM_ROLE_KO[root.role]} ${root.stem}`,
      BRANCH_CLASS_KO[branchType],
      root.kind === 'same-stem' ? '같은 글자' : '같은 오행',
      ...(isClashed ? ['충을 맞음'] : []),
      ...(defected > 0 ? [`국에 ${Math.round(defected * 100)}% 끌려감`] : []),
    ];

    return {
      root,
      branchClass: branchType,
      clashed: isClashed,
      defected,
      strength,
      detail: notes.join(' · '),
    };
  });

  const strength = roots.reduce((sum, graded) => sum + graded.strength, 0);

  return {
    status: 'experimental',
    position: rooting.position,
    element: rooting.element,
    roots,
    strength,
    effectivelyRootless: strength < EFFECTIVE_ROOT_FLOOR,
  };
}

export type RootQualityChart = {
  status: 'experimental';
  stems: readonly RootQuality[];
  dayMaster: RootQuality;
};

export function rootQualityOf(
  rootedness: Rootedness,
  pillars: QualityInput,
  bureaus: readonly Bureau[] = [],
): RootQualityChart {
  return {
    status: 'experimental',
    stems: rootedness.stems.map((rooting) => gradeRooting(rooting, pillars, bureaus)),
    dayMaster: gradeRooting(rootedness.dayMaster, pillars, bureaus),
  };
}
