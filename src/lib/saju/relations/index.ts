import {
  BRANCH_DIRECTIONAL_COMBINATIONS,
  BRANCH_INFO,
  BRANCH_PUNISHMENTS,
  BRANCH_TRIPLE_COMBINATIONS,
  findBranchClash,
  findBranchDestruction,
  findBranchGhostGate,
  findBranchHarm,
  findBranchResentment,
  findBranchSixCombination,
  findStemClash,
  findStemCombination,
  type Branch,
  type BranchPunishment,
  type Element,
  type Pillar,
  type RelationKind,
  type Stem,
} from '../constants';
import type { Pillars } from '../pillars';
import {
  PILLAR_POSITION_INDEX as POSITION_INDEX,
  PILLAR_POSITION_KO,
  type PillarPosition,
} from '../position';

/**
 * 원국(原局) 관계 연산 — 여덟 글자 안에서 성립하는 형충회합을 열거한다.
 *
 * L2 의 1단계다. `constants/relations.ts` 의 표를 소비해 **사실만** 낸다.
 * "그래서 좋다/나쁘다"도, "합이 성사되었다"도 말하지 않는다. 그 판단은
 * 학파마다 갈리므로, 여기서는 근거를 빠짐없이 남기고 취사선택을 쓰는 쪽에
 * 맡긴다. 자연어 문장은 L3 가 이 목록을 조회해 조립한다.
 *
 * 여기서 내린 정책 판단 넷:
 *
 * 1. **거리를 조건으로 걸지 않는다.** 붙은 기둥끼리만 합충을 인정하는 학파가
 *    있지만, 그것을 여기서 걸면 정보가 사라져 되살릴 수 없다. 대신 모든 쌍을
 *    내고 `adjacent`·`distance` 를 남긴다. 인접만 보고 싶으면 걸러 쓰면 된다.
 * 2. **반쪽만 모인 것도 낸다.** 왕지를 낀 반합, 두 글자만 모인 삼형·방합을
 *    `full: false` 로 표시해 함께 낸다. 실제 감명에서 가장 자주 쓰는 정보다.
 *    다만 왕지 없는 두 글자(申辰, 寅辰)는 내지 않는다 — 어느 계통에서도
 *    관계로 치지 않아서, 낸 다음 기본값으로 숨기는 항목이 될 뿐이다.
 *    `full` 은 글자를 다 세었는가일 뿐 유효성 판정이 아니다. 두 글자 삼형을
 *    그 자체로 온전한 형으로 보는 계통은 `full: false` + `direction` 을 읽으면
 *    된다 — 계통을 하나 골라 kind 를 나누는 대신 사실만 남긴다.
 * 3. **쟁합·투합은 검출하되 성사 여부는 판정하지 않는다.** 한 글자를 둘이
 *    다투는 것은 관찰 가능한 사실이라 `contested` 에 남긴다. 그러나 "그래서
 *    합이 깨진다"는 결론은 내지 않는다 — 충이 합을 깨는지, 합이 충을 푸는지는
 *    학파 갈림이 가장 심한 영역이다.
 * 4. **지장간은 보지 않는다.** 드러난 여덟 글자만 다룬다. 암합은 성립 조건
 *    자체가 갈리고, 넣는 순간 관계 수가 폭증해 대조군을 만들 수 없다.
 *
 * 대운·세운은 원국이 아니므로 포함하지 않는다.
 */

/** 천간끼리의 관계인가, 지지끼리의 관계인가 */
export type RelationTier = 'stem' | 'branch';

export const RELATION_KIND_KO: Record<RelationKind, string> = {
  stemCombination: '천간합',
  stemClash: '천간충',
  branchSixCombination: '지지육합',
  branchTripleCombination: '삼합',
  branchDirectionalCombination: '방합',
  branchClash: '지지충',
  branchPunishment: '형',
  branchHarm: '해',
  branchDestruction: '파',
  branchResentment: '원진',
  branchGhostGate: '귀문',
};

/**
 * 이 엔진이 채택한 규칙 묶음.
 *
 * 넷 다 학파 갈림이라 언젠가 바뀐다. 바뀐 뒤에 "결과가 왜 달라졌나"를
 * 되짚으려면 어느 규칙으로 뽑은 값인지가 결과 곁에 남아 있어야 한다.
 * 골든 스냅샷이 이 값을 찍으므로, 정책이 바뀌면 diff 맨 위에 드러난다.
 */
export const RELATION_POLICY = {
  ruleSet: 'visible-relations-v2',
  /** 떨어진 기둥끼리도 전부 검출하고 거리만 기록한다 */
  distantRelations: 'detect-all',
  /** 반쪽은 왕지를 낀 것만 — 삼합·방합 공통. 삼형에는 왕지가 없어 조건이 없다 */
  partialStructures: 'peak-required',
  /** 완전 삼형은 도는 순서를 낸다. 시작점은 고전이 부르는 차례일 뿐 우리가 고른 것이 아니다 */
  triplePunishmentCycle: 'ordered-by-classical-table',
  /**
   * 세 글자가 다 모인 자리 안의 두 글자 조합 — **형만 남기고 합은 버린다.**
   *
   * 합은 모여서 하나를 이루는 것이라 온전한 삼합 위에 반합을 얹으면 틀린 말이
   * 되고, 형은 쌍마다 물림을 따로 세는 계통이 있어 우리가 대신 고르지 않는다.
   */
  absorbedPairs: 'kept-for-punishments-only',
  /** 쟁합·투합만 검출하고 승패는 가리지 않는다 */
  interactionResolution: 'contest-only',
  /** 지장간은 관계 검출에 쓰지 않는다 (데이터는 그대로 있다) */
  hiddenStemRelations: 'disabled',
  /** 귀문은 원진과 합치지 않는다 — 겹치는 네 쌍에서 두 줄이 함께 나온다 */
  ghostGate: 'separate-from-resentment',
  /**
   * 귀문은 네 지지의 **모든 쌍**에서 찾는다 — 자리를 제한하는 계통은 안 쓴다.
   *
   * 일지를 기준으로 나머지 셋만 보거나(현대 일부), 년지와 시지만 보는(소아관살
   * 계통) 읽기가 따로 있다. 그렇게 좁히면 다른 만세력보다 귀문이 적게 나오는데,
   * 거른 것은 되살릴 수 없고 이 엔진은 거르는 대신 자리를 밝히는 쪽을 택했다
   * (`distantRelations: 'detect-all'` 과 같은 판단이다). 좁혀 읽고 싶으면
   * `participants` 의 자리로 걸러 쓰면 된다.
   */
  ghostGateBasis: 'all-branch-pairs',
} as const;

/** 정렬 기준 — 합을 먼저, 그다음 충·형·해·파·원진·귀문 */
const KIND_ORDER: readonly RelationKind[] = [
  'stemCombination',
  'branchSixCombination',
  'branchTripleCombination',
  'branchDirectionalCombination',
  'stemClash',
  'branchClash',
  'branchPunishment',
  'branchHarm',
  'branchDestruction',
  'branchResentment',
  'branchGhostGate',
];

/**
 * 원국의 식별자. 계산판을 하나만 볼 때는 이 값 하나뿐이다.
 *
 * 대운·세운은 `'daeun:3'`·`'annual:2027'` 처럼 자기 이름을 쓴다.
 */
export const NATAL_CHART_ID = 'natal';

/**
 * 관계에 참여한 글자 하나 — **어느 계산판의** 어느 기둥의 무슨 글자인가.
 *
 * `chartId` 없이 `position` 만으로는 글자를 가리킬 수 없다. 원국과 세운을
 * 함께 보면 `position: 'year'` 인 글자가 둘이 되고, `positions: ['year','day']`
 * 가 원국 년주인지 세운 년주인지 알 수 없게 된다.
 *
 * 세운·대운처럼 기둥이 하나뿐인 계산판도 자리는 `'year'` 로 적는다 — 연간지라서다.
 */
export type Participant = {
  chartId: string;
  position: PillarPosition;
  char: Stem | Branch;
};

/** 관계가 몇 개의 계산판에 걸쳐 있는가 */
export type RelationScope =
  /** 한 계산판 안에서 성립한다 */
  | 'withinChart'
  /** 두 계산판의 글자 하나씩이 짝지었다 */
  | 'betweenCharts'
  /**
   * 여러 계산판의 글자가 합쳐져 세 글자 구조(삼합·방합·삼형)를 이뤘다.
   *
   * 이것을 인정할지가 계통 선택이라 쌍 관계와 섞지 않고 따로 표시한다.
   */
  | 'combinedFormation';

export const RELATION_SCOPE_KO: Record<RelationScope, string> = {
  withinChart: '원국 안',
  betweenCharts: '계산판 사이',
  combinedFormation: '합쳐서 이룸',
};

/**
 * 쟁합(爭合)·투합(妬合) — 한 글자를 두 관계가 함께 물고 있는 상태.
 *
 * `over` 가 다툼의 대상이 된 글자, `rivals` 가 그것을 두고 겨루는 나머지
 * 글자들이다. 예를 들어 년간 甲 · 월간 己 · 일간 甲 이면, 甲己합 두 개가
 * 월간 己 를 공유하므로 양쪽 관계 모두 `over: 월간 己` 로 표시된다.
 */
export type Contest = {
  over: Participant;
  rivals: readonly Participant[];
};

/**
 * 형(刑)의 방향 — 삼형은 순환한다. 寅刑巳, 巳刑申, 申刑寅.
 *
 * 두 글자만 모이면 그 순환에서 어느 쪽이 어느 쪽을 형하는지가 정해진다.
 *
 * `null` 은 두 가지 서로 다른 사정을 함께 나타낸다. 섞어 읽으면 안 된다.
 * - **상형(子卯)·자형**: 방향이라는 것이 애초에 없다. 서로 형하거나 자기
 *   자신을 형한다.
 * - **세 글자가 다 모인 삼형**: 방향이 없는 것이 아니라 순환 전체라서
 *   화살표 **하나**로 적을 수 없다. 그쪽은 `cycle` 이 든다.
 */
export type PunishmentDirection = {
  /** `participants` 의 인덱스 — 글자를 복사하지 않아 어긋날 수 없다 */
  from: number;
  to: number;
};

export type Relation = {
  kind: RelationKind;
  tier: RelationTier;
  /** 관계의 한글 이름 (예: '자오충', '신자 반합') */
  ko: string;
  /** 형(刑)의 이름 — 무은지형·지세지형·무례지형·자형. 그 외에는 null */
  name: string | null;
  /** 참여한 글자들 — 년 → 시 순서 */
  participants: readonly Participant[];
  /**
   * 합(合) 계열이 지향하는 오행.
   *
   * `result` 가 아니라 `targetElement` 인 이유가 있다. 글자가 모였다는 사실이
   * 곧 합화(合化)를 뜻하지는 않는다 — 화(化)하려면 월령과 세력이 받쳐줘야
   * 한다는 것이 통설이고, 그 판정은 여기서 하지 않는다. 이 값은 "성사되면
   * 무엇이 되는가"이지 "무엇이 되었다"가 아니다.
   */
  targetElement: Element | null;
  /**
   * 세 글자짜리 관계(삼합·방합·삼형)의 글자가 다 모였는가.
   * 두 글자짜리 관계는 언제나 `true` 다.
   *
   * 이것은 세었다는 사실일 뿐 유효성 판정이 아니다. 두 글자만 모인 삼형을
   * 그 자체로 온전한 형으로 보는 계통도 있는데, 그 해석은 `full: false` 와
   * `direction` 을 함께 읽어 쓰는 쪽에서 하면 된다.
   */
  full: boolean;
  /** 형의 방향. 방향이 없는 관계는 null */
  direction: PunishmentDirection | null;
  /**
   * 세 글자가 다 모인 삼형이 도는 **순서** — `participants` 의 인덱스다.
   *
   * 한동안 저장하지 않았다. `BRANCH_PUNISHMENTS` 의 배열 순서에서 그대로
   * 유도되니 값을 두 벌 들 이유가 없다고 적어 두었는데, **부르는 곳이 없는
   * 동안만 맞는 말이었다.** 이제 관계 표와 L3 행이 둘 다 이 순서를 필요로 하고,
   * 두 곳에서 각자 유도하면 어긋난 쪽을 알 수 없다 — 역마·도화·화개를 두 곳에서
   * 계산하지 않고 옮겨 담기만 한 것과 같은 판단이다.
   *
   * **시작점은 우리가 고른 것이 아니다.** 순환에는 시작이 없고, 여기 적히는
   * 첫 글자는 고전이 그 형을 부르는 차례(丑刑戌·戌刑未·未刑丑)의 첫 글자일 뿐이다.
   * 읽는 쪽은 마지막에서 첫 글자로 되돌아오는 고리로 읽어야 한다.
   *
   * 두 글자만 모인 삼형은 `direction` 이 들고 여기는 `null` 이다. 순환의 한 도막은
   * 고리가 아니라 화살표 하나다.
   */
  cycle: readonly number[] | null;
  /** 몇 개의 계산판에 걸쳐 있는가 */
  scope: RelationScope;
  /**
   * 참여한 기둥들이 연달아 붙어 있는가.
   *
   * **한 계산판 안에서만 뜻이 있다.** 원국의 년주와 세운의 년주 사이에는
   * 기둥의 선형 거리라는 것이 없으므로 `scope` 가 `'withinChart'` 가 아니면
   * `null` 이다. 0 이나 큰 수로 채우면 없는 사실을 지어내는 것이 된다.
   */
  adjacent: boolean | null;
  /** 가장 멀리 떨어진 두 기둥 사이의 칸 수. 계산판이 섞이면 null */
  distance: number | null;
  /** 쟁합·투합. 다툼이 없으면 빈 배열이다 */
  contested: readonly Contest[];
};

/**
 * 관계 연산에 필요한 것은 네 기둥뿐이다.
 *
 * `Pillars` 를 통째로 받지 않는 이유는 절기·보정 메타가 관계와 무관하기
 * 때문이다. 덕분에 테스트에서 간지 넷만으로 원국을 세울 수 있다.
 *
 * 네 자리가 모두 비어 있을 수 있다. 세운·대운처럼 기둥이 하나뿐인 계산판을
 * 같은 연산에 태우기 위해서다 — 없는 자리는 그냥 빠지고, 그만큼 관계도 덜
 * 나온다. 시간 미상 시주와 같은 규칙이다.
 */
export type RelationInput = {
  [K in 'year' | 'month' | 'day' | 'hour']: Pillars[K] | null;
};

type Slot = {
  chartId: string;
  position: PillarPosition;
  stem: Stem;
  branch: Branch;
  /** 여러 계산판을 늘어놓았을 때의 전역 순서 — 결정적 정렬에만 쓴다 */
  order: number;
};

/** 계산판 하나 — 식별자와 기둥들 */
export type LabeledPillars = {
  chartId: string;
  pillars: RelationInput;
};

const SELF_PUNISHMENTS = BRANCH_PUNISHMENTS.filter(
  (p): p is Extract<BranchPunishment, { kind: 'self' }> => p.kind === 'self',
);
const MUTUAL_PUNISHMENTS = BRANCH_PUNISHMENTS.filter(
  (p): p is Extract<BranchPunishment, { kind: 'mutual' }> => p.kind === 'mutual',
);
const TRIPLE_PUNISHMENTS = BRANCH_PUNISHMENTS.filter(
  (p): p is Extract<BranchPunishment, { kind: 'triple' }> => p.kind === 'triple',
);

/** 방합의 왕지(旺支)는 언제나 계절 한가운데 글자 — 寅卯辰의 卯 */
function directionalPeak(branches: readonly [Branch, Branch, Branch]): Branch {
  return branches[1];
}

function slotsOf(charts: readonly LabeledPillars[]): Slot[] {
  let order = 0;

  return charts.flatMap(({ chartId, pillars }) => {
    const entries: readonly (readonly [PillarPosition, Pillar | null])[] = [
      ['year', pillars.year],
      ['month', pillars.month],
      ['day', pillars.day],
      ['hour', pillars.hour],
    ];

    // 시간 미상이면 시주가 없다. 없는 글자로 관계를 만들 수는 없으므로 그냥
    // 빠지고, 그만큼 관계도 덜 나온다 — 시주를 정오로 메우지 않는 것과 같은 이유다.
    return entries.flatMap(([position, pillar]) =>
      pillar
        ? [{ chartId, position, stem: pillar.stem, branch: pillar.branch, order: order++ }]
        : [],
    );
  });
}

function combinationsOf<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];

  const [head, ...rest] = items;
  return [
    ...combinationsOf(rest, size - 1).map((combo) => [head, ...combo]),
    ...combinationsOf(rest, size),
  ];
}

function branchKo(branch: Branch): string {
  return BRANCH_INFO[branch].ko;
}

/** 표의 순서대로 늘어놓은 한글 표기 — '자진'이 아니라 '신자' 가 나오게 한다 */
function orderedKo(slots: readonly Slot[], order: readonly Branch[]): string {
  return [...slots]
    .sort((a, b) => order.indexOf(a.branch) - order.indexOf(b.branch))
    .map((s) => branchKo(s.branch))
    .join('');
}

const participantOf = (slot: Slot, tier: RelationTier): Participant => ({
  chartId: slot.chartId,
  position: slot.position,
  char: tier === 'stem' ? slot.stem : slot.branch,
});

function scopeOf(slots: readonly Slot[]): RelationScope {
  const charts = new Set(slots.map((s) => s.chartId));
  if (charts.size === 1) return 'withinChart';
  return slots.length > 2 ? 'combinedFormation' : 'betweenCharts';
}

function makeRelation(args: {
  kind: RelationKind;
  tier: RelationTier;
  ko: string;
  name?: string;
  targetElement?: Element;
  full?: boolean;
  direction?: { from: Slot; to: Slot };
  /** 완전 삼형이 도는 순서대로 놓은 참가자들 — 인덱스로 바꿔 담는다 */
  cycle?: readonly Slot[];
  slots: readonly Slot[];
}): Relation {
  const ordered = [...args.slots].sort((a, b) => a.order - b.order);
  const scope = scopeOf(ordered);

  // 계산판이 섞이면 기둥 사이의 선형 거리라는 것이 없다.
  const indexes = ordered.map((s) => POSITION_INDEX[s.position]);
  const distance =
    scope === 'withinChart' ? Math.max(...indexes) - Math.min(...indexes) : null;

  return {
    kind: args.kind,
    tier: args.tier,
    ko: args.ko,
    name: args.name ?? null,
    participants: ordered.map((s) => participantOf(s, args.tier)),
    targetElement: args.targetElement ?? null,
    full: args.full ?? true,
    direction: args.direction
      ? { from: ordered.indexOf(args.direction.from), to: ordered.indexOf(args.direction.to) }
      : null,
    cycle: args.cycle ? args.cycle.map((slot) => ordered.indexOf(slot)) : null,
    scope,
    // 세 기둥짜리 관계는 세 자리가 연달아야 붙은 것이다 (거리 2).
    adjacent: distance === null ? null : distance === ordered.length - 1,
    distance,
    contested: [],
  };
}

// ─────────────────────────────────────────────────────────────
// 두 글자 관계 — 천간
// ─────────────────────────────────────────────────────────────

function stemRelations(slots: readonly Slot[]): Relation[] {
  return combinationsOf(slots, 2).flatMap(([a, b]) => {
    const found: Relation[] = [];

    const combination = findStemCombination(a.stem, b.stem);
    if (combination) {
      found.push(
        makeRelation({
          kind: 'stemCombination',
          tier: 'stem',
          ko: combination.ko,
          targetElement: combination.result,
          slots: [a, b],
        }),
      );
    }

    const clash = findStemClash(a.stem, b.stem);
    if (clash) {
      found.push(
        makeRelation({ kind: 'stemClash', tier: 'stem', ko: clash.ko, slots: [a, b] }),
      );
    }

    return found;
  });
}

// ─────────────────────────────────────────────────────────────
// 두 글자 관계 — 지지
// ─────────────────────────────────────────────────────────────

function branchPairRelations(slots: readonly Slot[]): Relation[] {
  return combinationsOf(slots, 2).flatMap(([a, b]) => {
    const found: Relation[] = [];
    const pair = [a, b] as const;

    const six = findBranchSixCombination(a.branch, b.branch);
    if (six) {
      found.push(
        makeRelation({
          kind: 'branchSixCombination',
          tier: 'branch',
          ko: six.ko,
          targetElement: six.result,
          slots: pair,
        }),
      );
    }

    const clash = findBranchClash(a.branch, b.branch);
    if (clash) {
      found.push(
        makeRelation({ kind: 'branchClash', tier: 'branch', ko: clash.ko, slots: pair }),
      );
    }

    // 상형(相刑)과 자형(自刑). 삼형은 세 글자를 함께 봐야 해서 아래에서 따로 센다.
    const mutual = MUTUAL_PUNISHMENTS.find(
      (p) =>
        (p.branches[0] === a.branch && p.branches[1] === b.branch) ||
        (p.branches[0] === b.branch && p.branches[1] === a.branch),
    );
    if (mutual) {
      found.push(
        makeRelation({
          kind: 'branchPunishment',
          tier: 'branch',
          ko: mutual.ko,
          name: mutual.name,
          slots: pair,
        }),
      );
    }

    if (a.branch === b.branch) {
      const self = SELF_PUNISHMENTS.find((p) => p.branch === a.branch);
      if (self) {
        found.push(
          makeRelation({
            kind: 'branchPunishment',
            tier: 'branch',
            ko: self.ko,
            name: self.name,
            slots: pair,
          }),
        );
      }
    }

    const harm = findBranchHarm(a.branch, b.branch);
    if (harm) {
      found.push(
        makeRelation({ kind: 'branchHarm', tier: 'branch', ko: harm.ko, slots: pair }),
      );
    }

    const destruction = findBranchDestruction(a.branch, b.branch);
    if (destruction) {
      found.push(
        makeRelation({
          kind: 'branchDestruction',
          tier: 'branch',
          ko: destruction.ko,
          slots: pair,
        }),
      );
    }

    const resentment = findBranchResentment(a.branch, b.branch);
    if (resentment) {
      found.push(
        makeRelation({
          kind: 'branchResentment',
          tier: 'branch',
          ko: resentment.ko,
          slots: pair,
        }),
      );
    }

    // 귀문은 원진과 네 쌍이 겹친다. 겹치는 자리에서는 두 줄이 함께 나온다 —
    // 어느 표에서 나온 사실인지 목록에서 지워지면 안 되기 때문이다.
    const ghostGate = findBranchGhostGate(a.branch, b.branch);
    if (ghostGate) {
      found.push(
        makeRelation({
          kind: 'branchGhostGate',
          tier: 'branch',
          ko: ghostGate.ko,
          slots: pair,
        }),
      );
    }

    return found;
  });
}

// ─────────────────────────────────────────────────────────────
// 세 글자 관계 — 삼합·방합·삼형
// ─────────────────────────────────────────────────────────────

type GroupMatches = {
  full: Slot[][];
  partial: Slot[][];
};

/**
 * 세 글자 묶음이 원국에서 어떻게 모였는지 센다.
 *
 * `peak` 를 주면 두 글자짜리는 그 글자를 껴야만 인정한다 — 삼합의 반합 규칙이다
 * (申辰은 반합이 아니고 子辰은 반합이다). 방합에도 같은 기준을 적용해 계절
 * 한가운데 글자를 요구한다. 삼형에는 왕지 개념이 없으므로 `null` 을 준다.
 *
 * **자리가 다르면 다른 사실이다** — 申子辰 이 서 있는데 시지에 子 가 하나 더
 * 있으면, 그 子 와 申 의 반합은 따로 성립한다.
 *
 * 세 글자가 다 모인 자리 **안에서** 나오는 두 글자 조합을 어떻게 할지는
 * `absorbed` 가 정한다. 합과 형이 갈리는 자리라 호출부가 고른다 — 아래
 * `AbsorbedPairs` 참조.
 */
function matchGroups(
  slots: readonly Slot[],
  branches: readonly [Branch, Branch, Branch],
  peak: Branch | null,
  absorbed: AbsorbedPairs = 'drop',
): GroupMatches {
  const members = slots.filter((s) => branches.includes(s.branch));

  const full = combinationsOf(members, 3).filter(
    (trio) => new Set(trio.map((s) => s.branch)).size === 3,
  );

  const partial = combinationsOf(members, 2).filter(([a, b]) => {
    if (a.branch === b.branch) return false;
    if (peak !== null && a.branch !== peak && b.branch !== peak) return false;
    if (absorbed === 'keep') return true;
    return !full.some((trio) => trio.includes(a) && trio.includes(b));
  });

  return { full, partial };
}

/**
 * 세 글자가 다 모인 자리 안의 두 글자 조합을 낼 것인가 — **합과 형이 갈린다.**
 *
 * - **합은 버린다**(`drop`). 합은 모여서 하나를 이루는 것이라, 巳酉丑 이 다 선
 *   자리에서 "巳酉 반합도 있습니다"는 대부분의 계통에서 **틀린 말**이다. 반합은
 *   온전한 삼합이 없을 때 부르는 이름이다.
 * - **형은 남긴다**(`keep`). 형은 서로 물리는 것이라 쌍마다 물림이 따로 있다고
 *   보는 계통이 있다. 丑戌未 가 다 서 있어도 丑戌 이 직접 형한다는 읽기가 살아
 *   있고, **그 갈림을 우리가 대신 고르지 않는다.**
 *
 * 삼형 행에 참가자 셋과 `cycle` 이 있으니 두 글자 형은 거기서 유도되기는 한다.
 * 그래도 내는 것은 정보 복원의 문제가 아니라 **어느 층이 계통을 고르는가**의
 * 문제여서다 — 유도할 수 있다는 이유로 버리면, 두 글자 형을 따로 세는 계통에서는
 * 우리가 이미 한 번 판정한 결과를 받게 된다.
 *
 * 한 표 안에서만 하는 이야기다. 같은 두 글자가 **다른 표**에서 각각 나오는 것은
 * 원래 그대로다 — 子丑 은 육합과 방합에서 두 줄이 함께 선다.
 */
type AbsorbedPairs = 'drop' | 'keep';

function tripleCombinationRelations(slots: readonly Slot[]): Relation[] {
  return BRANCH_TRIPLE_COMBINATIONS.flatMap((c) => {
    const { full, partial } = matchGroups(slots, c.branches, c.peak);

    return [
      ...full.map((group) =>
        makeRelation({
          kind: 'branchTripleCombination',
          tier: 'branch',
          ko: c.ko,
          targetElement: c.result,
          slots: group,
        }),
      ),
      ...partial.map((group) =>
        makeRelation({
          kind: 'branchTripleCombination',
          tier: 'branch',
          ko: `${orderedKo(group, c.branches)} 반합`,
          targetElement: c.result,
          full: false,
          slots: group,
        }),
      ),
    ];
  });
}

function directionalCombinationRelations(slots: readonly Slot[]): Relation[] {
  return BRANCH_DIRECTIONAL_COMBINATIONS.flatMap((c) => {
    const { full, partial } = matchGroups(slots, c.branches, directionalPeak(c.branches));

    return [
      ...full.map((group) =>
        makeRelation({
          kind: 'branchDirectionalCombination',
          tier: 'branch',
          ko: c.ko,
          targetElement: c.result,
          slots: group,
        }),
      ),
      ...partial.map((group) =>
        makeRelation({
          kind: 'branchDirectionalCombination',
          tier: 'branch',
          ko: `${orderedKo(group, c.branches)} 반방합`,
          targetElement: c.result,
          full: false,
          slots: group,
        }),
      ),
    ];
  });
}

/**
 * 삼형의 순환에서 두 글자의 방향을 읽는다 — 寅刑巳, 巳刑申, 申刑寅.
 *
 * 표의 배열 순서가 곧 순환 순서라, 뒤 글자가 앞 글자를 형하는 것은
 * 한 바퀴 돌아온 마지막 짝(申→寅) 하나뿐이다. 표 순서대로만 이름을 지으면
 * 그 짝이 '인신형'으로 뒤집혀 나온다.
 */
function punishmentDirectionOf(
  cycle: readonly [Branch, Branch, Branch],
  a: Slot,
  b: Slot,
): { from: Slot; to: Slot } {
  const next = (branch: Branch) => cycle[(cycle.indexOf(branch) + 1) % cycle.length];
  return next(a.branch) === b.branch ? { from: a, to: b } : { from: b, to: a };
}

function triplePunishmentRelations(slots: readonly Slot[]): Relation[] {
  return TRIPLE_PUNISHMENTS.flatMap((p) => {
    // 삼형이 다 서 있어도 두 글자 형을 따로 낸다 — 위 `AbsorbedPairs` 참조.
    const { full, partial } = matchGroups(slots, p.branches, null, 'keep');

    return [
      // 세 글자가 다 모인 삼형은 순환이라 화살표 하나로 못 적는다. 대신 **도는
      // 순서**를 낸다 — 표의 배열 순서가 곧 그 순서이므로 정렬하면 안 되고,
      // 여기서 그 순서대로 참가자를 늘어놓기만 한다.
      ...full.map((group) =>
        makeRelation({
          kind: 'branchPunishment',
          tier: 'branch',
          ko: p.ko,
          name: p.name,
          cycle: [...group].sort(
            (a, b) => p.branches.indexOf(a.branch) - p.branches.indexOf(b.branch),
          ),
          slots: group,
        }),
      ),
      // 두 글자만 모인 삼형. 이름은 어느 삼형에서 온 조각인지 알려주려고 남긴다.
      ...partial.map((group) => {
        const direction = punishmentDirectionOf(p.branches, group[0], group[1]);

        return makeRelation({
          kind: 'branchPunishment',
          tier: 'branch',
          ko: `${branchKo(direction.from.branch)}${branchKo(direction.to.branch)}형`,
          name: p.name,
          full: false,
          direction,
          slots: group,
        });
      }),
    ];
  });
}

// ─────────────────────────────────────────────────────────────
// 쟁합·투합
// ─────────────────────────────────────────────────────────────

/** 쟁합·투합을 따지는 것은 두 글자짜리 합뿐이다 */
const CONTESTABLE_KINDS: readonly RelationKind[] = ['stemCombination', 'branchSixCombination'];

/**
 * 한 글자를 두 관계가 함께 물고 있으면 양쪽에 표시한다.
 *
 * 여기서 멈춘다. 다툼이 있다는 사실만 남기고, 그래서 합이 성립하는지
 * 깨지는지는 판정하지 않는다.
 */
function markContests(relations: readonly Relation[]): Relation[] {
  const key = (kind: RelationKind, p: Participant): string =>
    `${kind}:${p.chartId}:${p.position}`;

  const byParticipant = new Map<string, Relation[]>();
  for (const relation of relations) {
    if (!CONTESTABLE_KINDS.includes(relation.kind)) continue;
    for (const participant of relation.participants) {
      const k = key(relation.kind, participant);
      byParticipant.set(k, [...(byParticipant.get(k) ?? []), relation]);
    }
  }

  return relations.map((relation) => {
    if (!CONTESTABLE_KINDS.includes(relation.kind)) return relation;

    const contested = relation.participants.flatMap<Contest>((shared) => {
      const others = (byParticipant.get(key(relation.kind, shared)) ?? []).filter(
        (other) => other !== relation,
      );
      if (others.length === 0) return [];

      const rivals = others.flatMap((other) =>
        other.participants.filter(
          (p) => p.chartId !== shared.chartId || p.position !== shared.position,
        ),
      );

      return [{ over: shared, rivals }];
    });

    return contested.length === 0 ? relation : { ...relation, contested };
  });
}

// ─────────────────────────────────────────────────────────────
// 입구
// ─────────────────────────────────────────────────────────────

function compareRelations(a: Relation, b: Relation): number {
  const byKind = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
  if (byKind !== 0) return byKind;

  // 온전히 모인 것을 반쪽보다 앞에 둔다.
  if (a.full !== b.full) return a.full ? -1 : 1;

  // participants 는 전역 순서로 정렬돼 있으므로 첫 글자와 끝 글자로 견준다.
  const key = (r: Relation) =>
    r.participants.map((p) => `${p.chartId}:${POSITION_INDEX[p.position]}`).join('|');

  return key(a).localeCompare(key(b)) || a.ko.localeCompare(b.ko);
}

/**
 * 원국 안에서 성립하는 모든 관계를 찾는다.
 *
 * 순서는 결정적이다 — 종류(합 → 충 → 형 → 해 → 파 → 원진 → 귀문), 온전함, 자리 순.
 *
 * **시간 미상이면 시주가 빠진 채로 계산된다.** 실제보다 관계가 적게 나오므로,
 * 없는 관계가 아니라 알 수 없는 관계라는 점을 쓰는 쪽에서 밝혀야 한다.
 */
export function findRelationsAmong(charts: readonly LabeledPillars[]): Relation[] {
  const slots = slotsOf(charts);

  const found = [
    ...stemRelations(slots),
    ...branchPairRelations(slots),
    ...tripleCombinationRelations(slots),
    ...directionalCombinationRelations(slots),
    ...triplePunishmentRelations(slots),
  ];

  return markContests(found).sort(compareRelations);
}

/**
 * 원국 안에서 성립하는 관계 — 계산판 하나짜리 입구.
 *
 * 대운·세운까지 함께 보려면 `findRelationsAmong` 을 쓴다.
 */
export function findRelations(
  pillars: RelationInput,
  chartId: string = NATAL_CHART_ID,
): Relation[] {
  return findRelationsAmong([{ chartId, pillars }]);
}

/**
 * 형의 방향을 참가자로 풀어 준다.
 *
 * 저장은 인덱스로 하고(글자를 복사하지 않아 어긋날 수 없다) 읽을 때만 푼다.
 */
export function directionParticipantsOf(
  relation: Relation,
): { from: Participant; to: Participant } | null {
  const { direction, participants } = relation;
  if (!direction) return null;

  return { from: participants[direction.from], to: participants[direction.to] };
}

/**
 * 참가자를 **읽는 순서**로 — 형만 자리 순서가 아니라 형하는 순서다.
 *
 * 저장은 자리 순서(년→시)로 하고 순서는 인덱스로만 든다(`cycle`·`direction`).
 * 읽을 때 그것을 푸는 곳이 여기 하나다 — 부르는 곳이 셋인데(원국 표 · 궁합 표 ·
 * L3 행) 셋이 각자 풀면 언젠가 한 곳만 고쳐지고 그때 어긋난 쪽을 알 수 없다.
 *
 * **글자 순서가 이름과 맞아야 한다.** '축술형'인데 행이 `戌 · 丑` 으로 서면 읽는
 * 사람이 둘 중 어느 것이 맞는지를 고르게 되고, 그것은 우리가 내리지 않은 판정을
 * 떠넘기는 것이다. 완전 삼형에서 먼저 드러났고 두 글자 형도 같은 자리였다.
 *
 * 방향이 없는 형(상형·자형)과 형이 아닌 관계는 자리 순서 그대로다.
 */
export function orderedParticipants(relation: Relation): readonly Participant[] {
  const { cycle, direction, participants } = relation;

  if (cycle) return cycle.map((index) => participants[index]);
  if (direction) return [participants[direction.from], participants[direction.to]];

  return participants;
}

/**
 * 관계 하나를 한 줄로 — '자오충 (월주·일주)'.
 *
 * 계산판이 섞이면 어느 판의 자리인지 함께 적는다.
 */
export function formatRelation(relation: Relation): string {
  const where = relation.participants
    .map((p) =>
      relation.scope === 'withinChart'
        ? PILLAR_POSITION_KO[p.position]
        : `${p.chartId} ${PILLAR_POSITION_KO[p.position]}`,
    )
    .join('·');

  return `${relation.ko} (${where})`;
}
