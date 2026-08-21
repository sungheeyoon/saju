import {
  BRANCH_DIRECTIONAL_COMBINATIONS,
  BRANCH_INFO,
  BRANCH_TRIPLE_COMBINATIONS,
  STEM_INFO,
  findBranchClash,
  type Branch,
  type Element,
  type Stem,
} from '../constants';
import type { Pillars } from '../pillars';
import { PILLAR_POSITIONS, PILLAR_POSITION_INDEX, type PillarPosition } from '../position';

/**
 * 국(局) — 지지 여럿이 **한 오행의 세력으로 서는 것.**
 *
 * 관계 열거는 申子辰이 모였다는 사실을 낸다. 그런데 오행 분포는 그 셋을
 * 각자의 지장간으로만 세므로, 辰의 무게는 여전히 대부분 土에 있다. 「모였다」는
 * 사실과 「그래서 수(水)가 됐다」는 판정 사이가 비어 있는 것이다. 그 사이를
 * 안 보기로 한 동안, 삼합으로 세력이 서는 명조는 종격 판정에서 계속 놓쳤다.
 *
 * 여기서는 국을 **글자의 교체가 아니라 무게의 이동**으로 다룬다. 辰이 水가
 * 되는 것이 아니라, 辰이 지고 있던 무게의 일부가 水 쪽으로 기운다. 고전이
 * 「辰이 水局에 들면 土로 논하지 않는다」고 말할 때의 뜻에 가깝고, 무엇보다
 * **되돌릴 수 있다** — 기울인 몫(`pull`)을 0 으로 두면 예전 분포가 그대로다.
 *
 * 세 종류를 낸다.
 *
 *   삼합·방합 완성  세 글자가 다 모였다
 *   반합            왕지를 낀 두 글자 — 관계 열거도 이미 낸다
 *   공협(拱)        왕지가 빠진 두 글자 — **관계 열거가 일부러 안 내는 것이다**
 *
 * 공협을 여기서만 내는 이유가 있다. 관계 표에 申辰을 실으면 「어느 계통에서도
 * 관계로 치지 않는 것」을 관계라고 부르게 된다. 그러나 세력을 잴 때는 사정이
 * 다르다 — 酉丑이 나란히 있으면 金이 두 자리에 걸쳐 있다는 것이 사실이고,
 * 고전은 그것을 拱이라 부르며 세력으로 읽는다. 그래서 **관계가 아니라 무게로**
 * 낸다. 붙어 있을 때만 세는 것도 그래서다 — 떨어진 두 글자는 사이를 낄 수 없다.
 */

/** 사왕지(四旺支) — 삼합·방합이 서려면 이 자리가 중심이다 */
const PEAK_BRANCHES: readonly Branch[] = ['子', '午', '卯', '酉'];

export const BUREAU_POLICY = {
  ruleSet: 'branch-bureau-v1',
  /** 고전의 숫자가 아니라 이 엔진의 실험 가중치다 */
  status: 'experimental',
  /**
   * 국은 글자를 바꾸지 않고 **무게만 기울인다.**
   *
   * 참여한 지지가 지고 있던 무게 중 `pull` 만큼이 국의 오행으로 옮겨 가고,
   * 나머지는 그 지지의 지장간 배분 그대로 남는다. 辰이 水局에 들어도 土가
   * 0 이 되지는 않는다 — 고전도 「辰中戊土」를 지우지는 않는다.
   */
  mechanism: 'weight-shift-not-substitution',
  /**
   * 기울이는 몫. **표본으로 고른 값이 아니라 구조에서 고른 값이다.**
   *
   * 완성된 국은 절반, 반합은 그 절반, 공협은 다시 그 절반으로 둔다. 세 등급의
   * 간격을 2배로 고정한 것은 자료에 맞춰 하나씩 만지면 어느 값이 어디서 왔는지
   * 알 수 없게 되기 때문이다. 등급 사이의 비를 먼저 정하고 자료를 본다.
   */
  pull: {
    /** 삼합·방합 완성 */
    full: 0.5,
    /** 왕지를 낀 두 글자 */
    half: 0.25,
    /** 왕지가 빠진 붙은 두 글자 — 공협 */
    span: 0.125,
  },
  /** 월령을 잡았거나 화신이 투간했으면 국이 실제로 선다 — 몫을 깎지 않는다 */
  unsupportedFactor: 0.6,
  /** 왕지가 충을 맞으면 국이 흔들린다 — 파국(破局)까지 판정하지는 않는다 */
  peakClashedFactor: 0.5,
  /** 공협은 붙어 있을 때만 센다 — 떨어진 두 글자는 사이를 낄 수 없다 */
  spanRequiresAdjacency: true,
} as const;

export type BureauKind =
  /** 삼합 완성 */
  | 'tripleCombination'
  /** 왕지를 낀 삼합 반합 */
  | 'halfTriple'
  /** 왕지가 빠진 붙은 두 글자 — 공협(拱) */
  | 'spanTriple'
  /** 방합 완성 */
  | 'directional'
  /** 왕지를 낀 방합 두 글자 */
  | 'halfDirectional';

export const BUREAU_KIND_KO: Record<BureauKind, string> = {
  tripleCombination: '삼합국',
  halfTriple: '반합',
  spanTriple: '공협',
  directional: '방합국',
  halfDirectional: '반방합',
};

export type Bureau = {
  status: 'experimental';
  kind: BureauKind;
  ko: string;
  /** 국이 서는 오행 */
  element: Element;
  members: readonly { position: PillarPosition; branch: Branch }[];
  /** 왕지가 자리에 있는가 — 공협은 없다 */
  hasPeak: boolean;
  /** 월지가 국에 참여하는가 — 국이 계절을 잡았다는 뜻이다 */
  commandsMonth: boolean;
  /** 국의 오행이 천간에 드러났는가 — 투간하면 국이 실제로 쓰인다 */
  revealedStems: readonly { position: PillarPosition; stem: Stem }[];
  /** 왕지가 충을 맞고 있는가 */
  peakClashed: boolean;
  /**
   * 참여한 지지의 무게 중 국 쪽으로 기우는 몫 (0~1).
   *
   * 등급별 기본값에 월령·투간·충을 곱한 값이다. 이 숫자 하나만 0 으로 두면
   * 국을 보지 않던 예전 분포로 정확히 돌아간다.
   */
  pull: number;
};

type BureauInput = Pick<Pillars, 'year' | 'month' | 'day' | 'hour'>;

type BranchSlot = { position: PillarPosition; branch: Branch };

const branchSlotsOf = (pillars: BureauInput): BranchSlot[] =>
  PILLAR_POSITIONS.flatMap((position) => {
    const pillar = pillars[position];
    return pillar === null ? [] : [{ position, branch: pillar.branch }];
  });

const stemSlotsOf = (pillars: BureauInput) =>
  PILLAR_POSITIONS.flatMap((position) => {
    const pillar = pillars[position];
    return pillar === null ? [] : [{ position, stem: pillar.stem }];
  });

const spread = (members: readonly BranchSlot[]): number => {
  const indexes = members.map((member) => PILLAR_POSITION_INDEX[member.position]);
  return Math.max(...indexes) - Math.min(...indexes);
};

const byPosition = (members: readonly BranchSlot[]): BranchSlot[] =>
  [...members].sort((a, b) => PILLAR_POSITION_INDEX[a.position] - PILLAR_POSITION_INDEX[b.position]);

/**
 * 국을 이룰 자리 조합을 고른다 — **가장 가까이 모인 것으로.**
 *
 * 같은 지지가 두 자리에 있으면 조합이 여럿 나온다(申 둘에 辰 하나면 申辰이 둘이다).
 * 앞에서부터 집으면 년지와 시지가 짝지어져, 나란히 붙어 있는 짝이 있는데도 떨어져
 * 있다고 판정하게 된다. 공협이 인접을 요구하므로 이 차이가 결과를 바꾼다.
 */
function membersFor(slots: readonly BranchSlot[], branches: readonly Branch[]): BranchSlot[] | null {
  let best: BranchSlot[] | null = null;

  const walk = (index: number, picked: BranchSlot[]) => {
    if (index === branches.length) {
      if (best === null || spread(picked) < spread(best)) best = [...picked];
      return;
    }
    for (const slot of slots) {
      if (slot.branch !== branches[index] || picked.includes(slot)) continue;
      walk(index + 1, [...picked, slot]);
    }
  };
  walk(0, []);

  return best === null ? null : byPosition(best);
}

const adjacent = (members: readonly BranchSlot[]): boolean => spread(members) === members.length - 1;

/**
 * 덜 모인 국의 이름 — **자리 순서가 아니라 표의 순서로 읽는다.**
 *
 * 관계 표가 「자진 반합」이라 부르는 것을 시지의 辰이 먼저라고 「진자 반합」이라
 * 적으면, 같은 것을 두 이름으로 부르게 된다. 생·왕·묘 차례는 국의 성질이지
 * 그 글자가 어느 기둥에 앉았는가가 아니다.
 */
const partialName = (
  canonical: readonly Branch[],
  members: readonly BranchSlot[],
  suffix: string,
): string =>
  `${canonical
    .filter((branch) => members.some((member) => member.branch === branch))
    .map((branch) => BRANCH_INFO[branch].ko)
    .join('')} ${suffix}`;

/**
 * 원국에 선 국을 모두 낸다.
 *
 * 한 오행에 대해 **가장 무거운 등급 하나만** 남긴다. 申子辰이 다 모였는데
 * 申子 반합까지 따로 세면 같은 세력을 두 번 세게 된다.
 */
export function bureausOf(pillars: BureauInput): Bureau[] {
  const branches = branchSlotsOf(pillars);
  const stems = stemSlotsOf(pillars);
  const monthBranch = pillars.month?.branch ?? null;

  const found: Bureau[] = [];

  const add = (
    kind: BureauKind,
    ko: string,
    element: Element,
    members: readonly BranchSlot[],
    peak: Branch,
  ) => {
    const hasPeak = members.some((member) => member.branch === peak);
    const commandsMonth = monthBranch !== null && members.some((m) => m.branch === monthBranch);
    const revealedStems = stems.filter((slot) => STEM_INFO[slot.stem].element === element);
    const peakClashed =
      hasPeak && branches.some((slot) => findBranchClash(slot.branch, peak) !== null);

    const base =
      kind === 'tripleCombination' || kind === 'directional'
        ? BUREAU_POLICY.pull.full
        : kind === 'spanTriple'
          ? BUREAU_POLICY.pull.span
          : BUREAU_POLICY.pull.half;

    const supported = commandsMonth || revealedStems.length > 0;
    const pull =
      base *
      (supported ? 1 : BUREAU_POLICY.unsupportedFactor) *
      (peakClashed ? BUREAU_POLICY.peakClashedFactor : 1);

    found.push({
      status: 'experimental',
      kind,
      ko,
      element,
      members,
      hasPeak,
      commandsMonth,
      revealedStems,
      peakClashed,
      pull,
    });
  };

  for (const triple of BRANCH_TRIPLE_COMBINATIONS) {
    const full = membersFor(branches, triple.branches);
    if (full) {
      add('tripleCombination', triple.ko, triple.result, full, triple.peak);
      continue;
    }

    const halves = triple.branches
      .filter((branch) => branch !== triple.peak)
      .map((branch) => membersFor(branches, [triple.peak, branch]))
      .filter((members): members is BranchSlot[] => members !== null);

    if (halves.length > 0) {
      // 왕지를 낀 짝이 둘이면 삼합이 완성됐어야 하므로 여기까지 오지 않는다.
      const members = halves[0];
      add('halfTriple', partialName(triple.branches, members, '반합'), triple.result, members, triple.peak);
      continue;
    }

    // 왕지가 없는 두 글자 — 관계 표가 내지 않는 자리다. 붙어 있을 때만 센다.
    const outer = triple.branches.filter((branch) => branch !== triple.peak);
    const span = membersFor(branches, outer);
    if (span && (!BUREAU_POLICY.spanRequiresAdjacency || adjacent(span))) {
      add('spanTriple', partialName(triple.branches, span, '공협'), triple.result, span, triple.peak);
    }
  }

  for (const directional of BRANCH_DIRECTIONAL_COMBINATIONS) {
    const peak = directional.branches.find((branch) => PEAK_BRANCHES.includes(branch));
    if (!peak) continue;

    const full = membersFor(branches, directional.branches);
    if (full) {
      add('directional', directional.ko, directional.result, full, peak);
      continue;
    }

    const half = directional.branches
      .filter((branch) => branch !== peak)
      .map((branch) => membersFor(branches, [peak, branch]))
      .find((members): members is BranchSlot[] => members !== null);

    if (half) {
      add(
        'halfDirectional',
        partialName(directional.branches, half, '반방합'),
        directional.result,
        half,
        peak,
      );
    }
  }

  // 같은 오행에 등급이 여럿이면 가장 무거운 하나만 남긴다 — 세력을 두 번 세지 않는다.
  const heaviest = new Map<Element, Bureau>();
  for (const bureau of found) {
    const standing = heaviest.get(bureau.element);
    if (!standing || bureau.pull > standing.pull) heaviest.set(bureau.element, bureau);
  }

  return [...heaviest.values()];
}
