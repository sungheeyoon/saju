import type { Pillar, Stem } from '../constants';
import type { Pillars } from '../pillars';
import { yearPillarOf } from '../pillars/year';
import { findRelationsAmong, type LabeledPillars, type Relation } from '../relations';
import { getSolarTerms, type SolarTerm } from '../solarTerms';
import { twelveSpiritOf, type SpiritBasis, type TwelveSpirit } from '../sinsal';
import { tenGodOf, tenGodOfBranch, type TenGod } from '../analysis/tenGods';
import {
  DEFAULT_YIN_REVERSE,
  twelveStageOf,
  type TwelveStage,
  type TwelveStageOptions,
} from '../stages';

/**
 * 세운(歲運) — 한 해의 간지.
 *
 * 대운이 십 년마다 갈아입는 옷이라면 세운은 한 해짜리다. 대운과 달리 성별로
 * 갈리지 않고 방향도 없다 — 그냥 그 해의 연주이므로 누구에게나 같다.
 * 갈리는 것은 그것이 **내 원국과 무엇을 하는가**뿐이다.
 *
 * **해의 경계는 입춘이다.** 1월 1일도 설날도 아니다. 2027년 1월에 태어난
 * 사람의 세운은 2026년(丙午)이지 2027년(丁未)이 아니다. 이미 연주 도출이
 * 그렇게 하고 있으므로(`yearPillarOf`) 같은 함수를 그대로 쓴다. 세운만
 * 따로 세면 언젠가 연주와 어긋난다.
 *
 * 세운은 기둥이 하나뿐이라 자리를 `'year'` 로 적는다 — 연간지라서다.
 * 원국의 년주와 구별되는 것은 `chartId`(`'annual:2027'`)다.
 */

/** 세운 한 해 */
export type SaeunEntry = {
  /** 입춘으로 판정한 사주년 */
  year: number;
  /** 관계 연산에서 이 해를 가리키는 이름 — 'annual:2027' */
  chartId: string;
  pillar: Pillar;
  /** 그 해에 몇 살인가 (만 나이). 출생 전 해라면 음수다 */
  age: number;
  /** 이 해가 시작되는 입춘 */
  startTerm: SolarTerm;
  /** 일간에서 본 세운 천간·지지의 십성 */
  tenGods: { stem: TenGod; branch: TenGod };
  /** 일간이 세운 지지에서 어떤 상태인가 */
  stage: TwelveStage;
  /** 12신살 — 원국의 년지·일지 기준 각각 */
  spirits: Record<SpiritBasis, TwelveSpirit>;
  /**
   * 세운과 원국 사이에 성립하는 관계.
   *
   * 원국 안에서만 성립하는 관계는 빼고, 세운이 실제로 끼어든 것만 담는다 —
   * 원국 내부 관계는 `Saju.relations` 에 이미 있고 해마다 같다.
   */
  relations: Relation[];
};

export type Saeun = {
  entries: SaeunEntry[];
  /** 음간을 역행시켰는가 — 12운성이 어느 계통으로 나왔는지 */
  yinReverse: boolean;
};

export type SaeunOptions = {
  /** 몇 해부터. 기본은 출생한 사주년 */
  fromYear?: number;
  /** 몇 해치. 기본 10 */
  count?: number;
  stages?: TwelveStageOptions;
};

export const DEFAULT_SAEUN_COUNT = 10;

/** 세운 한 해의 계산판 이름 */
export const saeunChartId = (year: number): string => `annual:${year}`;

export class InvalidSaeunRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSaeunRangeError';
  }
}

type SaeunInput = {
  pillars: Pick<Pillars, 'year' | 'month' | 'day' | 'hour' | 'dayMaster'>;
  /** 출생한 사주년 — 나이를 세는 기준 */
  birthSajuYear: number;
};

/**
 * 그 사주년이 시작되는 입춘.
 *
 * 간지는 `yearPillarOf` 가 사주년 번호에서 곧장 낸다. 입춘 시각은 "이 세운이
 * 언제부터인가"를 화면에 적기 위해 따로 구한다 — 1월 20일에 일어난 일은
 * 아직 전 해의 세운이라는 것이 세운에서 가장 자주 틀리는 지점이다.
 */
function startTermOf(year: number): SolarTerm {
  const found = getSolarTerms(year).find((term) => term.name === '입춘');
  if (!found) {
    throw new InvalidSaeunRangeError(`${year}년의 입춘을 구할 수 없습니다`);
  }
  return found;
}

export function computeSaeun(input: SaeunInput, options: SaeunOptions = {}): Saeun {
  const { pillars, birthSajuYear } = input;
  const from = options.fromYear ?? birthSajuYear;
  const count = options.count ?? DEFAULT_SAEUN_COUNT;

  if (!Number.isInteger(count) || count < 1) {
    throw new InvalidSaeunRangeError(`세운 개수는 1 이상의 정수여야 합니다: ${count}`);
  }
  if (!Number.isInteger(from)) {
    throw new InvalidSaeunRangeError(`시작 연도는 정수여야 합니다: ${from}`);
  }

  const dayMaster: Stem = pillars.dayMaster;
  const natal: LabeledPillars = { chartId: 'natal', pillars };

  const entries = Array.from({ length: count }, (_, index) => {
    const year = from + index;
    const pillar = yearPillarOf(year);
    const startTerm = startTermOf(year);
    const chartId = saeunChartId(year);

    // 세운은 기둥이 하나뿐이다. 나머지 세 자리는 비워 둔다 — 없는 글자로
    // 관계를 만들지 않는 것은 시간 미상 시주와 같은 규칙이다.
    const annual: LabeledPillars = {
      chartId,
      pillars: { year: pillar, month: null, day: null, hour: null },
    };

    return {
      year,
      chartId,
      pillar,
      age: year - birthSajuYear,
      startTerm,
      tenGods: {
        stem: tenGodOf(dayMaster, pillar.stem),
        branch: tenGodOfBranch(dayMaster, pillar.branch),
      },
      stage: twelveStageOf(dayMaster, pillar.branch, options.stages),
      spirits: {
        year: twelveSpiritOf(pillars.year.branch, pillar.branch),
        day: twelveSpiritOf(pillars.day.branch, pillar.branch),
      },
      // 원국 안에서만 닫힌 관계는 해마다 같으므로 뺀다.
      relations: findRelationsAmong([natal, annual]).filter(
        (relation) => relation.scope !== 'withinChart',
      ),
    } satisfies SaeunEntry;
  });

  return { entries, yinReverse: options.stages?.yinReverse ?? DEFAULT_YIN_REVERSE };
}
