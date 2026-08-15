import {
  HIDDEN_STEMS,
  STEM_INFO,
  elementRelation,
  principalStem,
  type Branch,
  type ElementRelation,
  type HiddenStemRole,
  type Stem,
} from '../constants';
import type { FourPillars } from '../pillars';

/**
 * 십성(十星) — 일간에서 본 다른 간지의 역할.
 *
 * 도출은 두 축의 곱이다.
 *   1. 오행 관계 5가지 (비겁·식상·재성·관성·인성)
 *   2. 음양이 같은가 다른가
 *
 * 같으면 편(偏) 계열, 다르면 정(正) 계열로 갈린다. 비견/겁재와 식신/상관은
 * 이름만 다를 뿐 같은 규칙을 따른다.
 */

export type TenGod =
  | '比肩' | '劫財'
  | '食神' | '傷官'
  | '偏財' | '正財'
  | '偏官' | '正官'
  | '偏印' | '正印';

export const TEN_GOD_KO: Record<TenGod, string> = {
  比肩: '비견',
  劫財: '겁재',
  食神: '식신',
  傷官: '상관',
  偏財: '편재',
  正財: '정재',
  偏官: '편관',
  正官: '정관',
  偏印: '편인',
  正印: '정인',
};

/** 십성 계열 — 두 짝씩 묶은 다섯 갈래 */
export type TenGodGroup = '比劫' | '食傷' | '財星' | '官星' | '印星';

export const TEN_GOD_GROUP_KO: Record<TenGodGroup, string> = {
  比劫: '비겁',
  食傷: '식상',
  財星: '재성',
  官星: '관성',
  印星: '인성',
};

export const TEN_GOD_GROUP: Record<TenGod, TenGodGroup> = {
  比肩: '比劫', 劫財: '比劫',
  食神: '食傷', 傷官: '食傷',
  偏財: '財星', 正財: '財星',
  偏官: '官星', 正官: '官星',
  偏印: '印星', 正印: '印星',
};

/** 오행 관계 × 음양 동이 → 십성. 음양이 같으면 `same`, 다르면 `different`. */
const TEN_GOD_TABLE: Record<ElementRelation, { same: TenGod; different: TenGod }> = {
  same: { same: '比肩', different: '劫財' },
  generates: { same: '食神', different: '傷官' },
  controls: { same: '偏財', different: '正財' },
  controlledBy: { same: '偏官', different: '正官' },
  generatedBy: { same: '偏印', different: '正印' },
};

/** 일간에서 본 천간의 십성 */
export function tenGodOf(dayMaster: Stem, target: Stem): TenGod {
  const self = STEM_INFO[dayMaster];
  const other = STEM_INFO[target];

  const relation = elementRelation(self.element, other.element);
  const polarity = self.yinYang === other.yinYang ? 'same' : 'different';

  return TEN_GOD_TABLE[relation][polarity];
}

/**
 * 일간에서 본 지지의 십성.
 *
 * 지지는 체(體) 음양이 지장간 정기와 어긋나는 자리가 있으므로(子·亥·巳·午),
 * 반드시 정기 천간을 경유해서 판정한다.
 */
export function tenGodOfBranch(dayMaster: Stem, branch: Branch): TenGod {
  return tenGodOf(dayMaster, principalStem(branch));
}

export type HiddenTenGod = {
  stem: Stem;
  role: HiddenStemRole;
  days: number;
  tenGod: TenGod;
};

export type PillarTenGods = {
  /** 천간의 십성. 일간 자신은 판정 대상이 아니므로 `null` */
  stem: TenGod | null;
  /** 지지의 십성 (정기 기준) */
  branch: TenGod;
  /** 지장간 각각의 십성 */
  hiddenStems: HiddenTenGod[];
};

export type TenGodChart = {
  year: PillarTenGods;
  month: PillarTenGods;
  day: PillarTenGods;
  /** 출생 시각을 모르면 `null` — 시주가 없으니 십성도 없다 */
  hour: PillarTenGods | null;
};

export const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;
export type PillarKey = (typeof PILLAR_KEYS)[number];

export function tenGodChartOf(pillars: FourPillars): TenGodChart {
  const dayMaster = pillars.dayMaster;

  const forPillar = (key: PillarKey): PillarTenGods | null => {
    const pillar = pillars[key];
    if (pillar === null) return null;
    return {
      // 일간은 '나' 자신이라 십성을 매기지 않는다.
      stem: key === 'day' ? null : tenGodOf(dayMaster, pillar.stem),
      branch: tenGodOfBranch(dayMaster, pillar.branch),
      hiddenStems: HIDDEN_STEMS[pillar.branch].map((hidden) => ({
        stem: hidden.stem,
        role: hidden.role,
        days: hidden.days,
        tenGod: tenGodOf(dayMaster, hidden.stem),
      })),
    };
  };

  return {
    // 연·월·일주는 언제나 나오므로 널이 아님을 단언한다.
    year: forPillar('year')!,
    month: forPillar('month')!,
    day: forPillar('day')!,
    hour: forPillar('hour'),
  };
}

/**
 * 십성별 등장 횟수 — 천간 3자(일간 제외) + 지지 4자 기준.
 * 시간 미상이면 시주가 빠져 천간 2자 + 지지 3자가 된다.
 */
export function tenGodCountsOf(chart: TenGodChart): Record<TenGod, number> {
  const counts = Object.fromEntries(
    Object.keys(TEN_GOD_KO).map((god) => [god, 0]),
  ) as Record<TenGod, number>;

  for (const key of PILLAR_KEYS) {
    const pillar = chart[key];
    if (pillar === null) continue;
    if (pillar.stem) counts[pillar.stem] += 1;
    counts[pillar.branch] += 1;
  }
  return counts;
}
