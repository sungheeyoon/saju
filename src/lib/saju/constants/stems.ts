import type { Element, YinYang } from './elements';

/** 천간(天干) 10 */
export type Stem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';

/** 갑(甲)부터의 정순 배열 — 인덱스가 곧 천간 순서 */
export const STEMS = [
  '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸',
] as const satisfies readonly Stem[];

export type StemInfo = {
  char: Stem;
  ko: string;
  /** 0-based 천간 순서 (甲=0 … 癸=9) */
  index: number;
  yinYang: YinYang;
  element: Element;
};

/**
 * 천간은 오행 하나당 양·음 한 쌍씩(甲乙木, 丙丁火, 戊己土, 庚辛金, 壬癸水),
 * 짝수 인덱스가 양간, 홀수 인덱스가 음간이다.
 */
export const STEM_INFO: Record<Stem, StemInfo> = {
  甲: { char: '甲', ko: '갑', index: 0, yinYang: '陽', element: '木' },
  乙: { char: '乙', ko: '을', index: 1, yinYang: '陰', element: '木' },
  丙: { char: '丙', ko: '병', index: 2, yinYang: '陽', element: '火' },
  丁: { char: '丁', ko: '정', index: 3, yinYang: '陰', element: '火' },
  戊: { char: '戊', ko: '무', index: 4, yinYang: '陽', element: '土' },
  己: { char: '己', ko: '기', index: 5, yinYang: '陰', element: '土' },
  庚: { char: '庚', ko: '경', index: 6, yinYang: '陽', element: '金' },
  辛: { char: '辛', ko: '신', index: 7, yinYang: '陰', element: '金' },
  壬: { char: '壬', ko: '임', index: 8, yinYang: '陽', element: '水' },
  癸: { char: '癸', ko: '계', index: 9, yinYang: '陰', element: '水' },
};

/** 음수·60 이상도 받아 10으로 순환시킨 천간을 반환한다. */
export function stemAt(index: number): Stem {
  return STEMS[((index % 10) + 10) % 10];
}

export function stemIndex(stem: Stem): number {
  return STEM_INFO[stem].index;
}

export function isStem(value: string): value is Stem {
  return value in STEM_INFO;
}
