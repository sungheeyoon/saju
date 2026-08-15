import { BRANCH_INFO, type Pillar, type Stem } from '../constants';
import type { Pillars } from '../pillars';
import { monthPillarOf } from '../pillars/month';
import { yearPillarOf } from '../pillars/year';
import { findRelationsAmong, type LabeledPillars, type Relation } from '../relations';
import { getSolarTerms, type SolarTerm } from '../solarTerms';
import { twelveSpiritOf, type SpiritBasis, type TwelveSpirit } from '../sinsal';
import { tenGodOf, tenGodOfBranch, type TenGod } from '../analysis/tenGods';
import { saeunChartId } from '../saeun';
import {
  DEFAULT_YIN_REVERSE,
  twelveStageOf,
  type TwelveStage,
  type TwelveStageOptions,
} from '../stages';

/**
 * 월운(月運) — 한 달의 간지.
 *
 * 세운과 같은 모양이되 경계가 다르다. **세운은 입춘 하나로 갈리고, 월운은
 * 열두 절입마다 갈린다.** 달력 월이 아니다 — 3월 3일은 아직 인월(寅月)이고
 * 경칩이 지나야 묘월(卯月)이 된다.
 *
 * 그래서 새로 셀 것이 없다. 절기 목록은 `getSolarTerms` 가, 월간은 오호둔
 * (`monthPillarOf`)이, 관계는 `findRelationsAmong` 이 이미 한다. 여기서는
 * 그것들을 한 해치로 엮기만 한다. 따로 세면 월주 도출과 어긋난다.
 *
 * 관계는 **원국과 그 해의 세운을 함께** 놓고 본다. 월운을 볼 때 세운을 빼고
 * 보지는 않기 때문이다. 어느 판의 글자인지는 `chartId` 로 갈린다.
 */

/** 월운 한 달 */
export type WolunEntry = {
  /** 이 달이 속한 사주년 */
  year: number;
  /** 사주월 순서 — 인월이 1, 축월이 12 */
  monthOrder: number;
  /** 관계 연산에서 이 달을 가리키는 이름 — 'monthly:2026-01' */
  chartId: string;
  pillar: Pillar;
  /** 이 달이 시작되는 절 */
  startTerm: SolarTerm;
  /** 다음 절 — 이 달의 끝 */
  nextTerm: SolarTerm;
  /** 일간에서 본 월운 천간·지지의 십성 */
  tenGods: { stem: TenGod; branch: TenGod };
  /** 일간이 월운 지지에서 어떤 상태인가 */
  stage: TwelveStage;
  /** 12신살 — 원국의 년지·일지 기준 각각 */
  spirits: Record<SpiritBasis, TwelveSpirit>;
  /**
   * 이 달이 원국·세운과 맺는 관계.
   *
   * 월운이 실제로 낀 것만 담는다. 원국 안에서 닫힌 관계도, 원국과 세운
   * 사이의 관계도 여기 넣지 않는다 — 앞의 것은 늘 같고 뒤의 것은 세운의 몫이다.
   */
  relations: Relation[];
};

export type Wolun = {
  year: number;
  /** 입춘부터 소한까지 열두 달 */
  entries: WolunEntry[];
  yinReverse: boolean;
};

export type WolunOptions = {
  /** 어느 사주년의 열두 달을 볼지. 기본은 세운이 시작하는 해 */
  year?: number;
  stages?: TwelveStageOptions;
};

/** 월운 한 달의 계산판 이름 */
export const wolunChartId = (year: number, monthOrder: number): string =>
  `monthly:${year}-${String(monthOrder).padStart(2, '0')}`;

export class InvalidWolunRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWolunRangeError';
  }
}

type WolunInput = {
  pillars: Pick<Pillars, 'year' | 'month' | 'day' | 'hour' | 'dayMaster'>;
  year: number;
};

/** 한 해의 열두 절과 각 구간의 끝 */
function monthSpansOf(year: number): { startTerm: SolarTerm; nextTerm: SolarTerm }[] {
  const terms = getSolarTerms(year);
  // 마지막 절(소한)의 끝은 다음 사주년의 입춘이다.
  const [nextIpchun] = getSolarTerms(year + 1);

  return terms.map((startTerm, index) => ({
    startTerm,
    nextTerm: terms[index + 1] ?? nextIpchun,
  }));
}

export function computeWolun(input: WolunInput, options: WolunOptions = {}): Wolun {
  const { pillars, year } = input;

  if (!Number.isInteger(year)) {
    throw new InvalidWolunRangeError(`사주년은 정수여야 합니다: ${year}`);
  }

  const dayMaster: Stem = pillars.dayMaster;
  const annualPillar = yearPillarOf(year);

  const natal: LabeledPillars = { chartId: 'natal', pillars };
  const annual: LabeledPillars = {
    chartId: saeunChartId(year),
    pillars: { year: annualPillar, month: null, day: null, hour: null },
  };

  const entries = monthSpansOf(year).map(({ startTerm, nextTerm }) => {
    const monthOrder = BRANCH_INFO[startTerm.branch].monthOrder;
    const pillar = monthPillarOf(annualPillar.stem, startTerm.branch);
    const chartId = wolunChartId(year, monthOrder);

    // 월운도 기둥이 하나뿐이다. 자리는 월주라 'month' 로 적는다.
    const monthly: LabeledPillars = {
      chartId,
      pillars: { year: null, month: pillar, day: null, hour: null },
    };

    return {
      year,
      monthOrder,
      chartId,
      pillar,
      startTerm,
      nextTerm,
      tenGods: {
        stem: tenGodOf(dayMaster, pillar.stem),
        branch: tenGodOfBranch(dayMaster, pillar.branch),
      },
      stage: twelveStageOf(dayMaster, pillar.branch, options.stages),
      spirits: {
        year: twelveSpiritOf(pillars.year.branch, pillar.branch),
        day: twelveSpiritOf(pillars.day.branch, pillar.branch),
      },
      // 월운이 낀 것만. 원국↔세운 관계는 세운의 몫이라 여기서 빼야 한다 —
      // scope 만 보고 거르면 그것까지 딸려 온다.
      relations: findRelationsAmong([natal, annual, monthly]).filter((relation) =>
        relation.participants.some((participant) => participant.chartId === chartId),
      ),
    } satisfies WolunEntry;
  });

  return { year, entries, yinReverse: options.stages?.yinReverse ?? DEFAULT_YIN_REVERSE };
}
