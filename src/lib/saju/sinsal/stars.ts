import {
  BRANCHES,
  BRANCH_DIRECTIONAL_COMBINATIONS,
  BRANCH_SIX_COMBINATIONS,
  BRANCH_TRIPLE_COMBINATIONS,
  STEM_INFO,
  type Branch,
  type Pillar,
  type RelationKind,
  type Stem,
} from '../constants';
import type { Pillars } from '../pillars';
import { PILLAR_POSITIONS, type PillarPosition } from '../position';
import { findRelations, type Relation } from '../relations';
import { STEM_PROSPERITY, twelveStageBranchesOf } from '../stages';
import {
  SPIRIT_BASIS_KO,
  TWELVE_SPIRIT_ALIAS,
  TWELVE_SPIRIT_KO,
  findTwelveSpirits,
  type SpiritChart,
  type TwelveSpirit,
} from './twelveSpirits';

/**
 * 신살(神殺) — 출처와 산출법을 고정한 핵심 신살.
 *
 * 신살은 자료마다 수십 개씩 늘어나고 산출법도 갈린다. 여기서는 산출 근거가
 * 분명하고 채택 계통을 설명할 수 있는 것만 고정한다.
 *
 * 자료마다 갈리는 관귀학관·현침살·천문성·태극귀인은 고전 근거가 있는 한
 * 계통으로 좁혀 넣는다. 현대식 확장표와 섞지 않고 `SINSAL_POLICY`에 선택을
 * 명시한다.
 *
 * **귀문관살·원진살도 여기에 함께 적되 규칙은 관계 쪽 하나뿐이다.** 둘 다 두
 * 지지의 쌍이라 계산은 `relations/` 에 있고, 여기서는 걸린 자리만 옮겨 담는다.
 *
 * **역마·도화(연살)·화개는 여기에 함께 적되 규칙을 새로 두지 않는다.** 셋 다
 * 다른 만세력이 신살 자리에 적어 주므로 여기 없으면 빠진 것처럼 보인다. 다만
 * 산출은 `twelveSpirits` 의 결과를 옮겨 담기만 한다 — 같은 것을 두 곳에서
 * 계산하면 언젠가 어긋나고, 어긋난 쪽이 어느 쪽인지 알 수 없게 된다.
 * 기준이 갈리므로 년지 기준과 일지 기준을 각각 한 항목으로 낸다.
 *
 * **문창·금여·양인·암록은 표를 두지 않고 록지(建祿)에서 센다.** 넷 다 록지를
 * 축으로 정해진다.
 *
 *   양인 = 록 + 1   금여 = 록 + 2   문창 = 록 + 3   암록 = 록의 육합
 *
 * 열 천간 모두에서 통설 표와 일치하며, 테스트가 표 전체를 대조한다. 표를
 * 따로 옮겨 적으면 록지 표와 어긋날 수 있어 유도하는 편을 택했다.
 */

export type StarKind =
  | 'cheoneulGwiin'
  | 'cheondeokGwiin'
  | 'woldeokGwiin'
  | 'munchangGwiin'
  | 'hakdangGwiin'
  | 'geumyeo'
  | 'amrok'
  | 'hongyeom'
  | 'yangin'
  | 'goegang'
  | 'baekho'
  | 'gosin'
  | 'gwasuk'
  | 'gwangwiHakgwan'
  | 'hyeonchim'
  | 'cheonmun'
  | 'cheonui'
  | 'taegeukGwiin'
  | 'yeokma'
  | 'dohwa'
  | 'hwagae'
  | 'gwimun'
  | 'wonjin';

/** 전통적 분류. 천문처럼 길흉 어느 한쪽으로 놓기 어려운 별은 중립이다 */
export type StarNature = 'auspicious' | 'inauspicious' | 'neutral';

/** 신살이 어디에 걸렸는가 — 천간, 지지, 아니면 간지 전체 */
export type StarTarget = 'stem' | 'branch' | 'pillar';

export type StarHit = {
  position: PillarPosition;
  target: StarTarget;
  /** 걸린 글자. 간지 전체로 성립하는 괴강·백호는 '庚辰' 처럼 두 글자다 */
  char: string;
};

export type Star = {
  /**
   * 목록에서 이 항목을 가리키는 키.
   *
   * 대개는 `kind` 와 같지만, 역마·도화·화개는 년지 기준과 일지 기준이 각각
   * 한 항목으로 나오므로 `yeokma:year` 처럼 기준이 뒤에 붙는다.
   */
  id: string;
  kind: StarKind;
  ko: string;
  hanja: string;
  /** 길신·흉신·중립의 전통적 분류. 이것만으로 좋고 나쁨을 판정하지 않는다 */
  nature: StarNature;
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
  ruleSet: 'sourced-sinsal-v5',
  /** 천을·문창·금여·양인은 일간 기준 (년간 기준 계통은 채택하지 않는다) */
  stemBasis: 'day-master',
  /** 공망은 일주·년주 기준을 모두 낸다 */
  emptinessBasis: 'day-and-year',
  /** 12신살은 년지·일지 기준을 모두 낸다 */
  spiritBasis: 'year-and-day',
  /** 역마·도화·화개는 신살 목록에도 적되 값은 12신살에서 옮겨 담는다 */
  travelPeachCanopy: 'restated-from-twelve-spirits',
  /** 귀문·원진도 신살 목록에 적되 값은 관계 표에서 옮겨 담는다 */
  ghostGateResentment: 'restated-from-relations',
  /** 양인은 양간만 */
  yangin: 'yang-stems-only',
  /** 괴강은 좁은 넷 — 壬辰·庚辰·庚戌·戊戌 */
  goegang: 'classic-four',
  /** 괴강·백호를 일주에 가두지 않고 네 기둥에서 찾는다 */
  pillarStarScope: 'all-pillars',
  /** 학당귀인은 12운성 장생지에서 가져온다 — 표를 따로 두지 않는다 */
  hakdang: 'from-twelve-stages',
  /** 암록은 건록의 육합 — 표를 따로 두지 않는다 */
  amrok: 'six-combination-of-prosperity',
  /** 홍염은 정통표 한 벌만. 甲乙庚壬에 申을 더하는 계통은 넣지 않는다 */
  hongyeom: 'day-master-classic-table',
  /** 고신·과숙은 년지 기준이고 성별로 가르지 않는다 */
  loneliness: 'year-branch-both-genders',
  /** 관귀학관은 《삼명통회》의 오행 장생표 — 水土가 함께 申에서 장생한다 */
  gwangwiHakgwan: 'day-master-classic-five-element-growth',
  /** 현침은 《오행정기》의 다섯 글자 가운데 세 글자 이상 */
  hyeonchim: 'wuxing-jingji-five-glyphs-minimum-three',
  /** 천문은 당사주 天文이나 천의성 별칭이 아니라 戌亥가 함께 이루는 天門 */
  cheonmun: 'xu-hai-pair-heavenly-gate',
  /** 천의성은 월지의 앞 지지. 지지에 없을 때 천간으로 대신 보는 변형은 안 쓴다 */
  cheonui: 'month-branch-previous-branch-only',
  /** 태극귀인은 《연해자평》 원문대로 년간만 기준으로 삼는다 */
  taegeuk: 'year-stem-yuanhai-ziping',
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
 * 암록(暗祿) — 건록의 육합 상대. 드러나지 않는 도움으로 본다.
 *
 * 여기서도 표를 옮기지 않는다. 정의 자체가 "록지와 육합하는 자리"라서
 * 록지 표와 육합 표에서 곧장 나오고, 유도값이 통설표(甲亥·乙戌·丙申·丁未·
 * 戊申·己未·庚巳·辛辰·壬寅·癸丑)와 열 천간 모두 일치한다.
 */
export const amrokBranchOf = (stem: Stem): Branch => {
  const prosperity = STEM_PROSPERITY[stem];
  const combination = BRANCH_SIX_COMBINATIONS.find((c) => c.branches.includes(prosperity));
  // 육합 여섯 쌍이 열두 지지를 남김없이 덮으므로 여기에 걸릴 록지는 없다.
  if (!combination) throw new Error(`육합 상대가 없는 록지: ${prosperity}`);

  return combination.branches[0] === prosperity
    ? combination.branches[1]
    : combination.branches[0];
};

/**
 * 홍염살(紅艶殺) — 일간이 만나는 지지. 사람을 끌어당기는 매력으로 본다.
 *
 * 도화(연살)와 달리 삼합국에서 유도되지 않아 표를 옮겨 적을 수밖에 없다.
 * 甲乙庚壬에 申을 더하는 계통이 따로 있으나(`SINSAL_POLICY.hongyeom`),
 * 여기서는 널리 쓰이는 정통표 한 벌만 둔다 — 두 계통을 합치면 같은 이름으로
 * 두 자리가 걸려 어느 표에서 나왔는지 알 수 없게 된다.
 *
 * 이름에 살(殺)이 붙지만 길흉으로 가르지 않는다(`neutral`). 도화를 12신살에서
 * 중립으로 두는 것과 같은 이유로, 매력을 복으로 읽을지 화로 읽을지가 계통마다
 * 갈린다.
 */
export const HONGYEOM_BRANCH: Record<Stem, Branch> = {
  甲: '午',
  乙: '午',
  丙: '寅',
  丁: '未',
  戊: '辰',
  己: '辰',
  庚: '戌',
  辛: '酉',
  壬: '子',
  癸: '申',
};

export const hongyeomBranchOf = (stem: Stem): Branch => HONGYEOM_BRANCH[stem];

/**
 * 천의성(天醫星) — 월지의 바로 앞 지지.
 *
 * 이 저장소의 신살 가운데 **월지를 기준으로 삼는 유일한 항목**이다(천덕·월덕도
 * 월지에서 나오지만 그쪽은 표를 조회한다). 규칙이 "한 칸 뒤로"뿐이라 표를
 * 두지 않는다.
 *
 * 이름이 비슷한 천문성(天門星 = 戌亥)과 다른 별이다. 한국 자료가 둘을 섞어
 * 쓰는 일이 잦아 `SINSAL_POLICY` 에 둘의 근거를 따로 적어 둔다.
 *
 * 앞 지지다 — 뒤가 아니다. 월지 丑의 천의는 子, 亥의 천의는 戌이다.
 *
 * **지지에 없으면 천간으로 대신 본다는 변형은 쓰지 않는다**
 * (`SINSAL_POLICY.cheonui`). 월지 丑의 천의는 子인데 子가 없으면 천간 癸를
 * 천의로 본다는 계통이 있다. 그 변형을 켜면 같은 신살이 지지 신살인지 천간
 * 신살인지 흐려지고, 오행이 같다는 이유로 글자를 갈아 끼우는 셈이 된다.
 */
export const cheonuiBranchOf = (monthBranch: Branch): Branch =>
  BRANCHES[(branchIndexOf(monthBranch) + BRANCHES.length - 1) % BRANCHES.length];

/**
 * 학당귀인(學堂貴人) — 일간의 장생지 그 자리.
 *
 * 표가 따로 있는 것이 아니라 12운성의 장생지와 같은 값이다. 그래서 표를
 * 옮기지 않고 `twelveStageBranchesOf` 에서 가져온다. 음간을 역행시키는 기본
 * 계통을 따르므로 乙은 午, 辛은 子가 된다.
 */
export const hakdangBranchOf = (stem: Stem): Branch => twelveStageBranchesOf(stem).長生;

/**
 * 관귀학관(官貴學館) — 일간의 관성 오행이 장생하는 지지.
 *
 * 《三命通會》 「論學堂詞館」은 金長生巳, 水土長生申, 木長生亥,
 * 火長生寅이라 적고 이를 官貴學堂이라 부른다. 여기서의 장생은 음간을
 * 역행시키는 열 천간 12운성이 아니라 **오행 단위 고전 장생**이다. 그래서
 * 壬癸의 관성인 土도 水와 같이 申에서 장생한다.
 */
export const GWANGWI_HAKGWAN_BRANCH: Record<Stem, Branch> = {
  甲: '巳',
  乙: '巳',
  丙: '申',
  丁: '申',
  戊: '亥',
  己: '亥',
  庚: '寅',
  辛: '寅',
  壬: '申',
  癸: '申',
};

export const gwangwiHakgwanBranchOf = (stem: Stem): Branch =>
  GWANGWI_HAKGWAN_BRANCH[stem];

/**
 * 태극귀인(太極貴人) — 년간이 만나는 지지.
 *
 * 《淵海子平》은 표 뒤에 "其法以生年爲主，取別干則非也"라고 못박는다.
 * 현대의 일간 기준표를 기본값에 섞지 않고 년간만 쓴다.
 */
export const TAEGEUK_BRANCHES: Record<Stem, readonly Branch[]> = {
  甲: ['子', '午'],
  乙: ['子', '午'],
  丙: ['卯', '酉'],
  丁: ['卯', '酉'],
  戊: ['辰', '戌', '丑', '未'],
  己: ['辰', '戌', '丑', '未'],
  庚: ['寅', '亥'],
  辛: ['寅', '亥'],
  壬: ['巳', '申'],
  癸: ['巳', '申'],
};

/** 《五行精紀》가 현침으로 꼽은 다섯 글자. 현대 확장표의 未는 넣지 않는다 */
export const HYEONCHIM_GLYPHS = ['甲', '辛', '卯', '午', '申'] as const;

/** 고전은 다섯 글자 중 三四字라 하므로 한두 글자만으로 현침살이라 하지 않는다 */
export const HYEONCHIM_MIN_HITS = 3;

/**
 * 천문(天門) — 서북 乾방의 戌亥 사이.
 *
 * 한국 자료에서 같은 음으로 부르는 당사주 天文=辰, 천의성의 별칭과는 다른
 * 항목이다. 天門은 두 지지 사이의 문이므로 한 글자만으로 완성됐다고 하지 않고
 * 원국에 戌亥가 함께 있을 때만 성립시킨다.
 */
export const CHEONMUN_BRANCHES = ['戌', '亥'] as const satisfies readonly Branch[];

/**
 * 고신살(孤辰殺)·과숙살(寡宿殺) — 년지의 계절에서 나온다.
 *
 * 년지가 속한 방합(계절)을 찾아, **다음 계절의 첫 글자**가 고신이고 **앞
 * 계절의 끝 글자**가 과숙이다. 亥子丑(겨울)년이면 봄의 寅이 고신, 가을의
 * 戌이 과숙이다. 통설 표와 열두 지지 모두에서 일치한다.
 *
 * 고신을 남자에게, 과숙을 여자에게 무겁게 보는 계통이 있으나 그것은 해석이라
 * 여기서 가르지 않는다. 둘 다 검출하고 판단은 쓰는 쪽에 맡긴다.
 */
export function lonelinessBranchesOf(yearBranch: Branch): { gosin: Branch; gwasuk: Branch } {
  const index = BRANCH_DIRECTIONAL_COMBINATIONS.findIndex((c) =>
    c.branches.includes(yearBranch),
  );
  if (index === -1) throw new Error(`방합에 속하지 않는 지지: ${yearBranch}`);

  const seasons = BRANCH_DIRECTIONAL_COMBINATIONS;
  return {
    gosin: seasons[(index + 1) % seasons.length].branches[0],
    gwasuk: seasons[(index + seasons.length - 1) % seasons.length].branches[2],
  };
}

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

/**
 * 12신살에서 신살 목록으로 옮겨 담는 셋 — 역마·도화(연살)·화개.
 *
 * 값은 만들지 않고 `findTwelveSpirits` 가 이미 낸 것을 가져다 쓴다. 이름도
 * 12신살 쪽 표를 그대로 쓰되 연살은 널리 부르는 도화살로 적는다.
 */
const RESTATED_SPIRITS = [
  { kind: 'yeokma', spirit: '驛馬殺' },
  { kind: 'dohwa', spirit: '年殺' },
  { kind: 'hwagae', spirit: '華蓋殺' },
] as const satisfies readonly { kind: StarKind; spirit: TwelveSpirit }[];

/**
 * 관계 표에서 신살 목록으로 옮겨 담는 둘 — 귀문관살·원진살.
 *
 * 둘 다 두 지지의 **쌍**이라 계산은 관계 쪽(`relations/`)에 있다. 다만 다른
 * 만세력이 신살 자리에 적어 주므로 신살 표만 보는 사람에게는 빠진 것처럼
 * 보인다. 그래서 여기에도 적되 값은 `findRelations` 가 낸 것을 옮기기만 한다 —
 * 표를 두 곳에 두면 언젠가 어긋나고 어긋난 쪽을 알 수 없다.
 *
 * 신살 표는 자리별 표라 쌍의 상대나 거리를 담지 못한다. 어느 글자와 어느
 * 글자가 걸렸는지는 관계 표가 그대로 들고 있고, 여기서는 **걸린 자리만**
 * 적는다. 卯申이 두 쌍이면 자리는 월·일·시 셋이 되고 항목은 하나다.
 */
const RESTATED_RELATIONS = [
  { kind: 'gwimun', relation: 'branchGhostGate', ko: '귀문관살', hanja: '鬼門關殺' },
  { kind: 'wonjin', relation: 'branchResentment', ko: '원진살', hanja: '怨嗔殺' },
] as const satisfies readonly {
  kind: StarKind;
  relation: RelationKind;
  ko: string;
  hanja: string;
}[];

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

/** 천간과 지지의 글자꼴 자체를 세는 신살 — 한 기둥에서 둘 다 걸릴 수 있다 */
const glyphHits = (pillars: StarInput, targets: readonly string[]): StarHit[] =>
  PILLAR_POSITIONS.flatMap((position) => {
    const pillar = pillars[position];
    if (!pillar) return [];

    const hits: StarHit[] = [];
    if (targets.includes(pillar.stem)) {
      hits.push({ position, target: 'stem', char: pillar.stem });
    }
    if (targets.includes(pillar.branch)) {
      hits.push({ position, target: 'branch', char: pillar.branch });
    }
    return hits;
  });

/**
 * 12신살 결과를 신살 항목으로 옮긴다.
 *
 * 년지 기준과 일지 기준이 서로 다른 자리를 가리키므로 기준마다 한 항목씩
 * 낸다. 기준을 안 적으면 왜 역마가 두 자리에 걸렸는지 알 수 없다.
 *
 * 길흉은 매기지 않는다(`neutral`). 12신살 전체를 길흉으로 가르지 않는 것과
 * 같은 이유다 — 셋 다 계통마다 읽는 방향이 갈린다.
 */
function restatedSpiritStars(pillars: StarInput, charts: readonly SpiritChart[]): Star[] {
  return charts.flatMap((chart) =>
    RESTATED_SPIRITS.map(
      ({ kind, spirit }): Star => ({
        id: `${kind}:${chart.basis}`,
        kind,
        ko: TWELVE_SPIRIT_ALIAS[spirit] ?? TWELVE_SPIRIT_KO[spirit],
        hanja: spirit,
        nature: 'neutral',
        basis: { label: SPIRIT_BASIS_KO[chart.basis], char: chart.basisBranch },
        hits: eachPillar(pillars, (pillar, position) =>
          chart.byPosition[position] === spirit
            ? { position, target: 'branch', char: pillar.branch }
            : null,
        ),
      }),
    ),
  );
}

/**
 * 관계 표의 귀문·원진을 신살 항목으로 옮긴다.
 *
 * 값을 만들지 않고 `findRelations` 의 결과를 읽기만 한다. 자리는 관계에 참여한
 * 기둥 그대로이고, 같은 자리가 두 쌍에 걸리면 한 번만 적는다.
 *
 * 길흉은 전통적 분류를 따라 흉신에 둔다 — 고신·과숙·백호와 같은 기준이다.
 * 관계 표가 길흉을 말하지 않는 것은 "합이 성사되는가"를 판정하지 않는다는
 * 뜻이지, 전통이 이 살을 어디로 분류했는지를 감추자는 뜻이 아니다.
 */
function restatedRelationStars(pillars: StarInput, relations: readonly Relation[]): Star[] {
  return RESTATED_RELATIONS.map(({ kind, relation, ko, hanja }): Star => {
    const positions = new Set(
      relations
        .filter((found) => found.kind === relation)
        .flatMap((found) => found.participants.map((participant) => participant.position)),
    );

    return {
      id: kind,
      kind,
      ko,
      hanja,
      nature: 'inauspicious',
      // 두 글자가 서로를 성립시키므로 기준 글자가 따로 없다 — 괴강·백호와 같다.
      basis: null,
      hits: eachPillar(pillars, (pillar, position) =>
        positions.has(position) ? { position, target: 'branch', char: pillar.branch } : null,
      ),
    };
  });
}

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

  const yearBranch = pillars.year.branch;
  const yearStem = pillars.year.stem;
  const loneliness = lonelinessBranchesOf(yearBranch);
  const cheondeokTarget = CHEONDEOK_TARGET[monthBranch];
  const woldeokStem = woldeokStemOf(monthBranch);

  const yanginAllowed = yinYangin || STEM_INFO[dayMaster].yinYang === '陽';
  const hyeonchimHits = glyphHits(pillars, HYEONCHIM_GLYPHS);
  const cheonmunHits = branchHits(pillars, CHEONMUN_BRANCHES);
  const cheonmunComplete = new Set(cheonmunHits.map((hit) => hit.char)).size === 2;

  const candidates: Star[] = [
    ...restatedSpiritStars(pillars, findTwelveSpirits(pillars)),
    ...restatedRelationStars(pillars, findRelations(pillars)),
    {
      id: 'cheoneulGwiin',
      kind: 'cheoneulGwiin',
      ko: '천을귀인',
      hanja: '天乙貴人',
      nature: 'auspicious',
      basis: { label: '일간', char: dayMaster },
      hits: branchHits(pillars, CHEONEUL_BRANCHES[dayMaster]),
    },
    {
      id: 'cheondeokGwiin',
      kind: 'cheondeokGwiin',
      ko: '천덕귀인',
      hanja: '天德貴人',
      nature: 'auspicious',
      basis: { label: '월지', char: monthBranch },
      hits: charHits(pillars, cheondeokTarget),
    },
    {
      id: 'woldeokGwiin',
      kind: 'woldeokGwiin',
      ko: '월덕귀인',
      hanja: '月德貴人',
      nature: 'auspicious',
      basis: { label: '월지', char: monthBranch },
      hits: charHits(pillars, woldeokStem),
    },
    {
      id: 'munchangGwiin',
      kind: 'munchangGwiin',
      ko: '문창귀인',
      hanja: '文昌貴人',
      nature: 'auspicious',
      basis: { label: '일간', char: dayMaster },
      hits: branchHits(pillars, [munchangBranchOf(dayMaster)]),
    },
    {
      id: 'hakdangGwiin',
      kind: 'hakdangGwiin',
      ko: '학당귀인',
      hanja: '學堂貴人',
      nature: 'auspicious',
      basis: { label: '일간', char: dayMaster },
      hits: branchHits(pillars, [hakdangBranchOf(dayMaster)]),
    },
    {
      id: 'geumyeo',
      kind: 'geumyeo',
      ko: '금여',
      hanja: '金輿',
      nature: 'auspicious',
      basis: { label: '일간', char: dayMaster },
      hits: branchHits(pillars, [geumyeoBranchOf(dayMaster)]),
    },
    {
      id: 'amrok',
      kind: 'amrok',
      ko: '암록',
      hanja: '暗祿',
      nature: 'auspicious',
      basis: { label: '일간', char: dayMaster },
      hits: branchHits(pillars, [amrokBranchOf(dayMaster)]),
    },
    {
      id: 'hongyeom',
      kind: 'hongyeom',
      ko: '홍염살',
      hanja: '紅艶殺',
      nature: 'neutral',
      basis: { label: '일간', char: dayMaster },
      hits: branchHits(pillars, [hongyeomBranchOf(dayMaster)]),
    },
    {
      id: 'yangin',
      kind: 'yangin',
      ko: '양인',
      hanja: '羊刃',
      nature: 'inauspicious',
      basis: { label: '일간', char: dayMaster },
      hits: yanginAllowed ? branchHits(pillars, [yanginBranchOf(dayMaster)]) : [],
    },
    {
      id: 'goegang',
      kind: 'goegang',
      ko: '괴강',
      hanja: '魁罡',
      nature: 'inauspicious',
      basis: null,
      hits: pillarHits(pillars, GOEGANG_PILLARS),
    },
    {
      id: 'baekho',
      kind: 'baekho',
      ko: '백호대살',
      hanja: '白虎大殺',
      nature: 'inauspicious',
      basis: null,
      hits: pillarHits(pillars, BAEKHO_PILLARS),
    },
    {
      id: 'gosin',
      kind: 'gosin',
      ko: '고신살',
      hanja: '孤辰殺',
      nature: 'inauspicious',
      basis: { label: '년지', char: yearBranch },
      hits: branchHits(pillars, [loneliness.gosin]),
    },
    {
      id: 'gwasuk',
      kind: 'gwasuk',
      ko: '과숙살',
      hanja: '寡宿殺',
      nature: 'inauspicious',
      basis: { label: '년지', char: yearBranch },
      hits: branchHits(pillars, [loneliness.gwasuk]),
    },
    {
      id: 'gwangwiHakgwan',
      kind: 'gwangwiHakgwan',
      ko: '관귀학관',
      hanja: '官貴學館',
      nature: 'auspicious',
      basis: { label: '일간', char: dayMaster },
      hits: branchHits(pillars, [gwangwiHakgwanBranchOf(dayMaster)]),
    },
    {
      id: 'hyeonchim',
      kind: 'hyeonchim',
      ko: '현침살',
      hanja: '懸針殺',
      nature: 'inauspicious',
      basis: null,
      hits: hyeonchimHits.length >= HYEONCHIM_MIN_HITS ? hyeonchimHits : [],
    },
    {
      id: 'cheonmun',
      kind: 'cheonmun',
      ko: '천문성',
      hanja: '天門星',
      nature: 'neutral',
      basis: null,
      hits: cheonmunComplete ? cheonmunHits : [],
    },
    {
      id: 'cheonui',
      kind: 'cheonui',
      ko: '천의성',
      hanja: '天醫星',
      nature: 'auspicious',
      basis: { label: '월지', char: pillars.month.branch },
      hits: branchHits(pillars, [cheonuiBranchOf(pillars.month.branch)]),
    },
    {
      id: 'taegeukGwiin',
      kind: 'taegeukGwiin',
      ko: '태극귀인',
      hanja: '太極貴人',
      nature: 'auspicious',
      basis: { label: '년간', char: yearStem },
      hits: branchHits(pillars, TAEGEUK_BRANCHES[yearStem]),
    },
  ];

  return candidates.filter((star) => star.hits.length > 0);
}
