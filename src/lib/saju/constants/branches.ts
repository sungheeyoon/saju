import type { Element, YinYang } from './elements';

/** 지지(地支) 12 */
export type Branch =
  | '子' | '丑' | '寅' | '卯' | '辰' | '巳'
  | '午' | '未' | '申' | '酉' | '戌' | '亥';

/** 자(子)부터의 정순 배열 — 60갑자 계산의 기준 순서 */
export const BRANCHES = [
  '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥',
] as const satisfies readonly Branch[];

/** 계절 — 辰戌丑未(토)는 각 계절의 끝 달에 배속된다. */
export type Season = '春' | '夏' | '秋' | '冬';

export const SEASON_KO: Record<Season, string> = {
  春: '봄',
  夏: '여름',
  秋: '가을',
  冬: '겨울',
};

export type BranchInfo = {
  char: Branch;
  ko: string;
  /** 0-based 지지 순서 (子=0 … 亥=11) */
  index: number;
  /**
   * 체(體) 기준 음양 — 지지 순서의 짝수/홀수로 배정한다.
   *
   * 주의: 용(用) 기준(지장간 정기의 음양)과 巳·午·子·亥에서 어긋난다.
   * 예를 들어 巳는 여기서 陰이지만 정기는 丙(陽火)이다. 십성 도출은
   * 지장간 정기를 경유하므로 이 필드가 아니라 `hiddenStems.ts`를 쓴다.
   */
  yinYang: YinYang;
  element: Element;
  season: Season;
  /** 십이지 동물 */
  zodiac: string;
  /** 사주 월 순서 — 입춘에서 시작하므로 寅=1 … 丑=12 */
  monthOrder: number;
};

export const BRANCH_INFO: Record<Branch, BranchInfo> = {
  子: { char: '子', ko: '자', index: 0,  yinYang: '陽', element: '水', season: '冬', zodiac: '쥐',       monthOrder: 11 },
  丑: { char: '丑', ko: '축', index: 1,  yinYang: '陰', element: '土', season: '冬', zodiac: '소',       monthOrder: 12 },
  寅: { char: '寅', ko: '인', index: 2,  yinYang: '陽', element: '木', season: '春', zodiac: '호랑이',   monthOrder: 1  },
  卯: { char: '卯', ko: '묘', index: 3,  yinYang: '陰', element: '木', season: '春', zodiac: '토끼',     monthOrder: 2  },
  辰: { char: '辰', ko: '진', index: 4,  yinYang: '陽', element: '土', season: '春', zodiac: '용',       monthOrder: 3  },
  巳: { char: '巳', ko: '사', index: 5,  yinYang: '陰', element: '火', season: '夏', zodiac: '뱀',       monthOrder: 4  },
  午: { char: '午', ko: '오', index: 6,  yinYang: '陽', element: '火', season: '夏', zodiac: '말',       monthOrder: 5  },
  未: { char: '未', ko: '미', index: 7,  yinYang: '陰', element: '土', season: '夏', zodiac: '양',       monthOrder: 6  },
  申: { char: '申', ko: '신', index: 8,  yinYang: '陽', element: '金', season: '秋', zodiac: '원숭이',   monthOrder: 7  },
  酉: { char: '酉', ko: '유', index: 9,  yinYang: '陰', element: '金', season: '秋', zodiac: '닭',       monthOrder: 8  },
  戌: { char: '戌', ko: '술', index: 10, yinYang: '陽', element: '土', season: '秋', zodiac: '개',       monthOrder: 9  },
  亥: { char: '亥', ko: '해', index: 11, yinYang: '陰', element: '水', season: '冬', zodiac: '돼지',     monthOrder: 10 },
};

/** 사주 월 순서(寅=1 … 丑=12)로 정렬한 지지 — 월주·절기 계산용 */
export const BRANCHES_BY_MONTH_ORDER = [
  '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑',
] as const satisfies readonly Branch[];

/** 음수·12 이상도 받아 12로 순환시킨 지지를 반환한다. */
export function branchAt(index: number): Branch {
  return BRANCHES[((index % 12) + 12) % 12];
}

export function branchIndex(branch: Branch): number {
  return BRANCH_INFO[branch].index;
}

export function isBranch(value: string): value is Branch {
  return value in BRANCH_INFO;
}
