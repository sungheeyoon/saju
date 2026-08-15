import { BRANCHES, STEM_INFO, type Branch, type Pillar, type Stem } from '../constants';
import type { Pillars } from '../pillars';
import { PILLAR_POSITIONS, type PillarPosition } from '../position';

/**
 * 12운성(十二運星) — 천간이 지지에서 어떤 상태인가.
 *
 * 사람이 태어나 자라고 늙어 죽고 다시 잉태되는 열두 마디에 빗대 천간의
 * 왕쇠(旺衰)를 나타낸다. 포태법(胞胎法)이라고도 한다.
 *
 * **정책 두 가지를 고정한다.**
 *
 * 1. **음간은 역행한다**(음양순역, 기본값). 甲은 亥에서 장생해 순행하고
 *    乙은 午에서 장생해 역행한다. 연해자평 이래의 정통이고 한국 만세력
 *    대부분이 이렇게 낸다. 뒤집는 계통(양포태 — 음간도 양간과 같이 본다)이
 *    있어 `yinReverse: false` 로 바꿀 수 있게 두되, 기본값은 역행이다.
 *
 *    이 선택은 검증으로 정할 수 없다. 역법 자료가 답을 주지 않고 명리
 *    계통의 채택 기준이라, 자시 규칙과 같은 종류의 결정이다.
 *
 * 2. **일간 기준과 좌하(坐下) 기준을 모두 낸다.** 일간이 네 지지에서 어떤
 *    상태인지가 가장 널리 쓰이지만, 각 기둥의 천간이 제 지지에서 어떤
 *    상태인지(좌하 운성)도 기둥별 강약을 볼 때 쓴다. 하나를 고르면 다른
 *    계통의 화면을 만들 수 없으므로 둘 다 내고 고르는 것은 쓰는 쪽에 맡긴다.
 *
 * 장생지는 표로 박지 않고 천간의 록지(建祿)에서 유도한다 — 열두 자리가
 * 록지를 축으로 맞물려 있어서, 표를 따로 두면 둘이 어긋날 수 있다.
 */

/** 12운성 — 장생에서 시작해 양으로 끝난다 */
export type TwelveStage =
  | '長生'
  | '沐浴'
  | '冠帶'
  | '建祿'
  | '帝旺'
  | '衰'
  | '病'
  | '死'
  | '墓'
  | '絶'
  | '胎'
  | '養';

export const TWELVE_STAGES = [
  '長生',
  '沐浴',
  '冠帶',
  '建祿',
  '帝旺',
  '衰',
  '病',
  '死',
  '墓',
  '絶',
  '胎',
  '養',
] as const satisfies readonly TwelveStage[];

export const TWELVE_STAGE_KO: Record<TwelveStage, string> = {
  長生: '장생',
  沐浴: '목욕',
  冠帶: '관대',
  建祿: '건록',
  帝旺: '제왕',
  衰: '쇠',
  病: '병',
  死: '사',
  墓: '묘',
  絶: '절',
  胎: '태',
  養: '양',
};

/**
 * 천간의 록지(建祿) — 그 천간이 가장 제자리인 지지.
 *
 * 甲은 寅, 乙은 卯… 오행이 같고 음양이 맞는 자리다. 12운성 전체가 이
 * 자리에서 유도되고, 양인·금여·문창도 같은 축을 쓴다.
 */
export const STEM_PROSPERITY: Record<Stem, Branch> = {
  甲: '寅',
  乙: '卯',
  丙: '巳',
  丁: '午',
  戊: '巳',
  己: '午',
  庚: '申',
  辛: '酉',
  壬: '亥',
  癸: '子',
};

export type TwelveStageOptions = {
  /**
   * 음간을 역행시킬 것인가. 기본 `true`(음양순역).
   *
   * `false` 로 두면 음간도 같은 오행 양간의 운성을 그대로 쓴다(양포태) —
   * 乙은 甲과, 丁己는 丙戊와, 辛은 庚과, 癸는 壬과 같아진다.
   */
  yinReverse?: boolean;
};

export const DEFAULT_YIN_REVERSE = true;

const branchIndexOf = (branch: Branch): number => BRANCHES.indexOf(branch);

/** 같은 오행의 양간 — 양포태에서 음간이 빌려 쓰는 천간 */
const YANG_TWIN: Record<Stem, Stem> = {
  甲: '甲',
  乙: '甲',
  丙: '丙',
  丁: '丙',
  戊: '戊',
  己: '戊',
  庚: '庚',
  辛: '庚',
  壬: '壬',
  癸: '壬',
};

/**
 * 그 천간의 장생지와 진행 방향.
 *
 * 건록에서 세 자리 앞이 장생이다 — 순행하는 천간이면 록에서 3을 빼고,
 * 역행하는 천간이면 3을 더한다. 甲(록 寅)은 亥, 乙(록 卯)은 午가 된다.
 */
function originOf(stem: Stem, yinReverse: boolean): { start: number; step: 1 | -1 } {
  const effective = yinReverse ? stem : YANG_TWIN[stem];
  const forward = STEM_INFO[effective].yinYang === '陽';
  const prosperity = branchIndexOf(STEM_PROSPERITY[effective]);

  return forward
    ? { start: (prosperity - 3 + 12) % 12, step: 1 }
    : { start: (prosperity + 3) % 12, step: -1 };
}

/** 천간 하나가 지지 하나에서 어떤 상태인가 */
export function twelveStageOf(
  stem: Stem,
  branch: Branch,
  options: TwelveStageOptions = {},
): TwelveStage {
  const { start, step } = originOf(stem, options.yinReverse ?? DEFAULT_YIN_REVERSE);
  const offset = (branchIndexOf(branch) - start) * step;

  return TWELVE_STAGES[((offset % 12) + 12) % 12];
}

/** 그 천간이 12운성 각 자리에서 만나는 지지 — 검산과 화면 설명에 쓴다 */
export function twelveStageBranchesOf(
  stem: Stem,
  options: TwelveStageOptions = {},
): Record<TwelveStage, Branch> {
  const { start, step } = originOf(stem, options.yinReverse ?? DEFAULT_YIN_REVERSE);

  return Object.fromEntries(
    TWELVE_STAGES.map((stage, index) => [
      stage,
      BRANCHES[(((start + index * step) % 12) + 12) % 12],
    ]),
  ) as Record<TwelveStage, Branch>;
}

export type StageChart = Record<PillarPosition, TwelveStage | null>;

export type Stages = {
  /** 일간이 네 지지에서 어떤 상태인가 — 가장 널리 쓰는 방식 */
  byDayMaster: StageChart;
  /** 각 기둥의 천간이 제 지지에서 어떤 상태인가 — 좌하(坐下) 운성 */
  bySelf: StageChart;
  /** 음간을 역행시켰는가. 결과가 왜 이런지 되짚을 때 필요하다 */
  yinReverse: boolean;
};

type StageInput = Pick<Pillars, 'year' | 'month' | 'day' | 'hour' | 'dayMaster'>;

function chartOf(
  pillars: StageInput,
  stemOf: (pillar: Pillar) => Stem,
  options: TwelveStageOptions,
): StageChart {
  return Object.fromEntries(
    PILLAR_POSITIONS.map((position) => {
      const pillar = pillars[position];
      // 시간 미상이면 시주가 없다. 없는 글자의 상태를 지어내지 않는다.
      return [position, pillar ? twelveStageOf(stemOf(pillar), pillar.branch, options) : null];
    }),
  ) as StageChart;
}

export function twelveStagesOf(pillars: StageInput, options: TwelveStageOptions = {}): Stages {
  return {
    byDayMaster: chartOf(pillars, () => pillars.dayMaster, options),
    bySelf: chartOf(pillars, (pillar) => pillar.stem, options),
    yinReverse: options.yinReverse ?? DEFAULT_YIN_REVERSE,
  };
}
