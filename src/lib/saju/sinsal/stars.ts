import {
  BRANCHES,
  BRANCH_TRIPLE_COMBINATIONS,
  STEM_INFO,
  type Branch,
  type Pillar,
  type Stem,
} from '../constants';
import type { Pillars } from '../pillars';
import { PILLAR_POSITIONS, type PillarPosition } from '../position';
import { STEM_PROSPERITY } from '../stages';

/**
 * 신살(神殺) — 핵심 여덟.
 *
 * 신살은 자료마다 수십 개씩 늘어나고 산출법도 갈린다. 여기서는 산출 근거가
 * 분명하고 대부분의 만세력이 공통으로 내는 여덟만 고정한다.
 *
 *   길신 다섯 — 천을귀인 · 천덕귀인 · 월덕귀인 · 문창귀인 · 금여
 *   흉신 셋   — 양인 · 괴강 · 백호대살
 *
 * **역마·도화(연살)·화개는 여기서 뽑지 않는다.** 셋 다 12신살에 이미 들어
 * 있으므로 `twelveSpirits` 의 결과를 그대로 쓴다. 같은 것을 두 곳에서 계산하면
 * 언젠가 어긋나고, 어긋난 쪽이 어느 쪽인지 알 수 없게 된다.
 *
 * **문창·금여·양인은 표를 두지 않고 록지(建祿)에서 센다.** 셋 다 록지를 축으로
 * 한 칸·두 칸·세 칸 떨어진 자리다.
 *
 *   양인 = 록 + 1   금여 = 록 + 2   문창 = 록 + 3
 *
 * 열 천간 모두에서 통설 표와 일치하며, 테스트가 표 전체를 대조한다. 표를
 * 따로 옮겨 적으면 록지 표와 어긋날 수 있어 유도하는 편을 택했다.
 */

export type StarKind =
  | 'cheoneulGwiin'
  | 'cheondeokGwiin'
  | 'woldeokGwiin'
  | 'munchangGwiin'
  | 'geumyeo'
  | 'yangin'
  | 'goegang'
  | 'baekho';

/** 신살이 어디에 걸렸는가 — 천간, 지지, 아니면 간지 전체 */
export type StarTarget = 'stem' | 'branch' | 'pillar';

export type StarHit = {
  position: PillarPosition;
  target: StarTarget;
  /** 걸린 글자. 간지 전체로 성립하는 괴강·백호는 '庚辰' 처럼 두 글자다 */
  char: string;
};

export type Star = {
  kind: StarKind;
  ko: string;
  hanja: string;
  /** 길신인가. 흉신이라고 나쁘다는 뜻은 아니고 전통적 분류다 */
  auspicious: boolean;
  /** 무엇을 기준으로 뽑았는가. 간지 자체로 정해지는 괴강·백호는 null */
  basis: { label: string; char: Stem | Branch } | null;
  /** 걸린 자리들. 한 신살이 여러 자리에 걸릴 수 있다 */
  hits: readonly StarHit[];
};

export type StarOptions = {
  /**
   * 음간에도 양인을 인정할 것인가. 기본 `false`.
   *
   * 양인(陽刃)은 이름 그대로 양간의 것이라는 통설을 따른다. 음간에도
   * 두는 계통이 있어 열어두되, 기본값은 양간 다섯(甲丙戊庚壬)뿐이다.
   */
  yinYangin?: boolean;
};

export const DEFAULT_YIN_YANGIN = false;

/**
 * 채택한 규칙 묶음. 관계 연산의 `RELATION_POLICY` 와 같은 구실을 한다 —
 * 정책이 바뀌면 골든 스냅샷 맨 위에서 먼저 드러난다.
 */
export const SINSAL_POLICY = {
  ruleSet: 'core-sinsal-v1',
  /** 천을·문창·금여·양인은 일간 기준 (년간 기준 계통은 채택하지 않는다) */
  stemBasis: 'day-master',
  /** 공망은 일주·년주 기준을 모두 낸다 */
  emptinessBasis: 'day-and-year',
  /** 12신살은 년지·일지 기준을 모두 낸다 */
  spiritBasis: 'year-and-day',
  /** 역마·도화·화개는 12신살 결과를 그대로 쓴다 */
  travelPeachCanopy: 'from-twelve-spirits',
  /** 양인은 양간만 */
  yangin: 'yang-stems-only',
  /** 괴강은 좁은 넷 — 壬辰·庚辰·庚戌·戊戌 */
  goegang: 'classic-four',
  /** 괴강·백호를 일주에 가두지 않고 네 기둥에서 찾는다 */
  pillarStarScope: 'all-pillars',
} as const;

const branchIndexOf = (branch: Branch): number => BRANCHES.indexOf(branch);

/** 록지에서 n 칸 뒤의 지지 */
const fromProsperity = (stem: Stem, step: number): Branch =>
  BRANCHES[(branchIndexOf(STEM_PROSPERITY[stem]) + step) % BRANCHES.length];

/** 양인(羊刃) — 록의 바로 다음 자리. 넘치는 기운이다 */
export const yanginBranchOf = (stem: Stem): Branch => fromProsperity(stem, 1);

/** 금여(金輿) — 록에서 두 칸. 배우자 복과 뒷심으로 본다 */
export const geumyeoBranchOf = (stem: Stem): Branch => fromProsperity(stem, 2);

/** 문창귀인(文昌貴人) — 록에서 세 칸. 글재주로 본다 */
export const munchangBranchOf = (stem: Stem): Branch => fromProsperity(stem, 3);

/**
 * 천을귀인(天乙貴人) — 일간이 만나는 두 지지.
 *
 * 甲戊庚牛羊, 乙己鼠猴鄉, 丙丁猪鷄位, 壬癸兔蛇藏, 六辛逢馬虎.
 * 소·양은 丑未, 쥐·원숭이는 子申, 돼지·닭은 亥酉, 토끼·뱀은 卯巳,
 * 말·호랑이는 午寅이다. 규칙성이 없어 표로 둔다.
 */
export const CHEONEUL_BRANCHES: Record<Stem, readonly [Branch, Branch]> = {
  甲: ['丑', '未'],
  戊: ['丑', '未'],
  庚: ['丑', '未'],
  乙: ['子', '申'],
  己: ['子', '申'],
  丙: ['亥', '酉'],
  丁: ['亥', '酉'],
  辛: ['寅', '午'],
  壬: ['卯', '巳'],
  癸: ['卯', '巳'],
};

/**
 * 천덕귀인(天德貴人) — 월지가 정하는 한 글자.
 *
 * 대상이 천간인 달과 지지인 달이 섞여 있다(卯·酉·午·子월만 지지다).
 * 유도할 규칙이 없어 표 그대로 둔다.
 */
export const CHEONDEOK_TARGET: Record<Branch, Stem | Branch> = {
  寅: '丁',
  卯: '申',
  辰: '壬',
  巳: '辛',
  午: '亥',
  未: '甲',
  申: '癸',
  酉: '寅',
  戌: '丙',
  亥: '乙',
  子: '巳',
  丑: '庚',
};

/**
 * 월덕귀인(月德貴人) — 월지의 삼합국이 정하는 천간.
 *
 * 화국이면 丙, 수국이면 壬, 목국이면 甲, 금국이면 庚. 국의 오행을 대표하는
 * 양간이라 표 없이 삼합 표에서 유도한다.
 */
const LOCALE_YANG_STEM = { 木: '甲', 火: '丙', 金: '庚', 水: '壬' } as const;

export function woldeokStemOf(monthBranch: Branch): Stem {
  const locale = BRANCH_TRIPLE_COMBINATIONS.find((c) => c.branches.includes(monthBranch));
  if (!locale) throw new Error(`삼합국에 속하지 않는 지지: ${monthBranch}`);

  // 삼합의 결과는 언제나 木火金水 넷 중 하나다 — 土국은 없다.
  return LOCALE_YANG_STEM[locale.result as keyof typeof LOCALE_YANG_STEM];
}

/**
 * 괴강(魁罡) — 간지 넷.
 *
 * 연해자평이 꼽는 壬辰·庚辰·庚戌·戊戌 넷으로 고정한다. 壬戌을 넣어 다섯·여섯으로
 * 세는 계통이 있으나, 넓히면 자료마다 갈라져 대조군을 만들 수 없다.
 */
export const GOEGANG_PILLARS: readonly string[] = ['壬辰', '庚辰', '庚戌', '戊戌'];

/** 백호대살(白虎大殺) — 간지 일곱. 자료 간 이견이 거의 없다 */
export const BAEKHO_PILLARS: readonly string[] = [
  '甲辰',
  '乙未',
  '丙戌',
  '丁丑',
  '戊辰',
  '壬戌',
  '癸丑',
];

type StarInput = Pick<Pillars, 'year' | 'month' | 'day' | 'hour' | 'dayMaster'>;

function eachPillar(
  pillars: StarInput,
  visit: (pillar: Pillar, position: PillarPosition) => StarHit | null,
): StarHit[] {
  return PILLAR_POSITIONS.flatMap((position) => {
    const pillar = pillars[position];
    // 시간 미상이면 시주가 없다. 없는 글자에 신살을 붙이지 않는다.
    if (!pillar) return [];

    const hit = visit(pillar, position);
    return hit ? [hit] : [];
  });
}

const branchHits = (pillars: StarInput, targets: readonly Branch[]): StarHit[] =>
  eachPillar(pillars, (pillar, position) =>
    targets.includes(pillar.branch)
      ? { position, target: 'branch', char: pillar.branch }
      : null,
  );

/** 천간에서도 지지에서도 걸릴 수 있는 신살 — 천덕귀인이 여기 해당한다 */
const charHits = (pillars: StarInput, target: Stem | Branch): StarHit[] =>
  eachPillar(pillars, (pillar, position) => {
    if (pillar.stem === target) return { position, target: 'stem', char: pillar.stem };
    if (pillar.branch === target) return { position, target: 'branch', char: pillar.branch };
    return null;
  });

const pillarHits = (pillars: StarInput, names: readonly string[]): StarHit[] =>
  eachPillar(pillars, (pillar, position) =>
    names.includes(pillar.name) ? { position, target: 'pillar', char: pillar.name } : null,
  );

/**
 * 원국에서 성립하는 신살을 찾는다.
 *
 * 하나도 걸리지 않은 신살은 결과에 넣지 않는다 — 관계 연산과 같은 규칙이다.
 * "없다"를 여덟 줄 적는 것보다 있는 것만 세는 편이 읽기 쉽다.
 */
export function findStars(pillars: StarInput, options: StarOptions = {}): Star[] {
  const { dayMaster } = pillars;
  const monthBranch = pillars.month.branch;
  const yinYangin = options.yinYangin ?? DEFAULT_YIN_YANGIN;

  const cheondeokTarget = CHEONDEOK_TARGET[monthBranch];
  const woldeokStem = woldeokStemOf(monthBranch);

  const yanginAllowed = yinYangin || STEM_INFO[dayMaster].yinYang === '陽';

  const candidates: Star[] = [
    {
      kind: 'cheoneulGwiin',
      ko: '천을귀인',
      hanja: '天乙貴人',
      auspicious: true,
      basis: { label: '일간', char: dayMaster },
      hits: branchHits(pillars, CHEONEUL_BRANCHES[dayMaster]),
    },
    {
      kind: 'cheondeokGwiin',
      ko: '천덕귀인',
      hanja: '天德貴人',
      auspicious: true,
      basis: { label: '월지', char: monthBranch },
      hits: charHits(pillars, cheondeokTarget),
    },
    {
      kind: 'woldeokGwiin',
      ko: '월덕귀인',
      hanja: '月德貴人',
      auspicious: true,
      basis: { label: '월지', char: monthBranch },
      hits: charHits(pillars, woldeokStem),
    },
    {
      kind: 'munchangGwiin',
      ko: '문창귀인',
      hanja: '文昌貴人',
      auspicious: true,
      basis: { label: '일간', char: dayMaster },
      hits: branchHits(pillars, [munchangBranchOf(dayMaster)]),
    },
    {
      kind: 'geumyeo',
      ko: '금여',
      hanja: '金輿',
      auspicious: true,
      basis: { label: '일간', char: dayMaster },
      hits: branchHits(pillars, [geumyeoBranchOf(dayMaster)]),
    },
    {
      kind: 'yangin',
      ko: '양인',
      hanja: '羊刃',
      auspicious: false,
      basis: { label: '일간', char: dayMaster },
      hits: yanginAllowed ? branchHits(pillars, [yanginBranchOf(dayMaster)]) : [],
    },
    {
      kind: 'goegang',
      ko: '괴강',
      hanja: '魁罡',
      auspicious: false,
      basis: null,
      hits: pillarHits(pillars, GOEGANG_PILLARS),
    },
    {
      kind: 'baekho',
      ko: '백호대살',
      hanja: '白虎大殺',
      auspicious: false,
      basis: null,
      hits: pillarHits(pillars, BAEKHO_PILLARS),
    },
  ];

  return candidates.filter((star) => star.hits.length > 0);
}
