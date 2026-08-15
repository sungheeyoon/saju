import { analyzePillars, type Analysis, type AnalysisOptions } from './analysis';
import type { CivilDateTime } from './civilTime';
import { computeDaeun, type Daeun, type DaeunOptions } from './daeun';
import { normalizeSajuInput, type Gender, type SajuInput } from './input';
import {
  getFourPillars,
  getPillarsWithoutHour,
  type LateNightRule,
  type PillarOptions,
  type Pillars,
} from './pillars';
import { findRelations, type Relation } from './relations';
import { computeSaeun, type Saeun, type SaeunOptions } from './saeun';
import { computeWolun, type Wolun, type WolunOptions } from './wolun';
import { analyzeSinsal, type Sinsal, type SinsalOptions } from './sinsal';
import { twelveStagesOf, type Stages, type TwelveStageOptions } from './stages';
import {
  correctTime,
  type Correction,
  type CorrectedTime,
  type TimeCorrectionOptions,
} from './timeCorrection';

export * from './analysis';
export * from './civilTime';
export * from './constants';
export * from './daeun';
export * from './input';
export * from './position';
export * from './relations';
export * from './saeun';
export * from './wolun';
export * from './sinsal';
export * from './solarTerms';
export * from './stages';
export * from './timeCorrection';

// 간지 도출 원시 함수들은 그대로 열어둔다 — 계약이랄 것이 없는 순수 표 조회다.
export * from './pillars/day';
export * from './pillars/hour';
export * from './pillars/month';
export * from './pillars/year';

/**
 * 4주 도출 함수(`getFourPillars`·`getPillarsWithoutHour`)는 **일부러 빼둔다.**
 *
 * 둘 다 "이미 보정된 절대 시각"을 요구하는데, 그 시각을 만드는 일이 이 엔진의
 * 절반이다(표준시 이력·서머타임·경도). 보정 없이 부르면 조용히 다른 사주가
 * 나오므로, 밖으로는 `computeSaju` 하나만 낸다.
 */
export {
  DEFAULT_LATE_NIGHT_RULE,
  UNKNOWN_PILLAR_MARK,
  formatPillars,
  type FourPillars,
  type LateNightRule,
  type PillarOptions,
  type Pillars,
} from './pillars';

/**
 * 만세력 엔진의 입구 — 입력 검증, 시간 보정, 4주 도출을 이어 붙인다.
 *
 * 파이프라인은 세 단계다.
 *   0. 입력 검증 → 존재하는 날짜·지원 범위인가        (input)
 *   1. 벽시계 + 출생지 → 절대 시각 + 지방시 보정      (timeCorrection)
 *   2. 절대 시각 + 보정 → 4주                        (pillars)
 *
 * 세 단계 모두 순수 함수라 서버 없이 브라우저에서 그대로 돈다.
 */

export type SajuOptions = TimeCorrectionOptions & {
  lateNightRule?: LateNightRule;
  analysis?: AnalysisOptions;
  daeun?: DaeunOptions;
  stages?: TwelveStageOptions;
  sinsal?: SinsalOptions;
  saeun?: SaeunOptions;
  wolun?: WolunOptions;
};

export type Saju = {
  /** 시간 미상 입력이면 `pillars.hour` 가 `null` 이다 */
  pillars: Pillars;
  /** 오행 분포·십성·신강신약 — L2 관계 연산이 먹고 들어가는 재료 */
  analysis: Analysis;
  /**
   * 원국 안에서 성립하는 형충회합.
   *
   * 사실만 담는다 — 길흉도, 합의 성사 여부도 판정하지 않는다.
   * 시간 미상이면 시주가 빠진 채로 계산되므로 실제보다 적게 나온다.
   */
  relations: Relation[];
  /**
   * 12운성 — 일간 기준과 좌하 기준.
   *
   * 음간을 역행시킬지가 계통 선택이라 `stages.yinReverse` 를 함께 남긴다.
   */
  stages: Stages;
  /** 공망 · 12신살 · 출처와 산출법을 고정한 핵심 신살 */
  sinsal: Sinsal;
  /**
   * 세운 — 해마다의 간지와 그것이 원국과 무엇을 하는지.
   *
   * 기본은 출생한 사주년부터 열 해다. `saeun.fromYear`·`saeun.count` 로 옮긴다.
   */
  saeun: Saeun;
  /**
   * 월운 — 한 해의 열두 달.
   *
   * 경계는 절입이다. 기본은 세운이 시작하는 해이고 `wolun.year` 로 옮긴다.
   */
  wolun: Wolun;
  /**
   * 10년 단위 대운.
   *
   * 성별이 필수 입력이라 언제나 나온다. 여덟 글자와 달리 이것만은 성별에
   * 따라 방향이 갈린다.
   */
  daeun: Daeun;
  meta: {
    /** 입력한 벽시계 시각 그대로. `hour: null` 이면 시간 미상 입력이다 */
    inputTime: SajuInput;
    /** 계산에 실제로 쓴 시각 — 시간 미상이면 정오로 채워진다 */
    resolvedTime: CivilDateTime;
    /**
     * 입력받은 성별.
     *
     * **여덟 글자는 성별로 달라지지 않는다.** 갈리는 것은 대운의 방향뿐이다
     * (양남음녀 순행 / 음남양녀 역행).
     */
    gender: Gender;
    /** 시각을 알고 계산했는가 — `false` 면 `pillars.hour` 가 `null` 이다 */
    hourKnown: boolean;
    /** 그 벽시계가 가리키는 실제 절대 시각 */
    instant: Date;
    /** 적용된 보정 내역 — 다른 만세력과 결과가 다른 이유가 여기 남는다 */
    corrections: Correction[];
    /** 보정 총합(분) */
    totalCorrectionMinutes: number;
    warnings: string[];
  };
};

/**
 * @throws {InvalidSajuInputError} 존재하지 않는 날짜이거나 지원 범위(1900~2100) 밖일 때
 * @throws {InvalidLocalTimeError} `dstTransitionPolicy: 'throw'` 이고 서머타임 전환에 걸릴 때
 */
export function computeSaju(inputTime: SajuInput, options: SajuOptions = {}): Saju {
  const {
    lateNightRule,
    analysis: analysisOptions,
    daeun: daeunOptions,
    stages: stageOptions,
    sinsal: sinsalOptions,
    saeun: saeunOptions,
    wolun: wolunOptions,
    ...correctionOptions
  } = options;

  // 계산 코어는 아무 숫자나 받으면 아무 답이나 낸다. 2월 30일이 3월 2일로
  // 조용히 흘러가기 전에 여기서 막는다.
  const { civil: resolvedTime, hourKnown, gender } = normalizeSajuInput(inputTime);

  const corrected: CorrectedTime = correctTime(resolvedTime, correctionOptions);

  const pillarOptions: PillarOptions = {
    lateNightRule,
    zoneOffsetMinutes: corrected.zoneOffsetMinutes,
    solarTimeOffsetMinutes: corrected.solarTimeOffsetMinutes,
  };

  // 시간 미상이면 `resolvedTime` 이 정오로 채워져 있고, 그 시각을 보정한
  // `instant` 가 그대로 넘어간다 — 시주 없는 계산이 요구하는 조건이 여기서
  // 지켜진다. 두 줄이 나란히 있어야 하는 이유이기도 하다.
  const pillars: Pillars = hourKnown
    ? getFourPillars(corrected.instant, pillarOptions)
    : getPillarsWithoutHour(corrected.instant, pillarOptions);

  const totalCorrectionMinutes = corrected.corrections.reduce(
    (sum, correction) => sum + correction.minutes,
    0,
  );

  const saeun = computeSaeun(
    {
      pillars,
      birthSajuYear: pillars.meta.sajuYear,
      birthDate: {
        year: resolvedTime.year,
        month: resolvedTime.month,
        day: resolvedTime.day,
      },
    },
    { stages: stageOptions, ...saeunOptions },
  );

  const daeun = computeDaeun(
    {
      yearStem: pillars.year.stem,
      monthPillar: pillars.month,
      monthTerm: pillars.meta.monthTerm,
      nextTerm: pillars.meta.nextTerm,
      instant: corrected.instant,
      birthYear: resolvedTime.year,
      gender,
      approximate: !hourKnown,
    },
    daeunOptions,
  );

  return {
    pillars,
    analysis: analyzePillars(pillars, analysisOptions),
    relations: findRelations(pillars),
    stages: twelveStagesOf(pillars, stageOptions),
    sinsal: analyzeSinsal(pillars, sinsalOptions),
    saeun,
    wolun: computeWolun(
      { pillars, year: wolunOptions?.year ?? saeun.entries[0].year },
      { stages: stageOptions, ...wolunOptions },
    ),
    daeun,
    meta: {
      inputTime,
      resolvedTime,
      hourKnown,
      gender,
      instant: corrected.instant,
      corrections: corrected.corrections,
      totalCorrectionMinutes,
      // 보정 단계의 경고가 먼저, 4주 도출의 경계 경고가 뒤에 온다.
      warnings: [...corrected.warnings, ...pillars.meta.warnings],
    },
  };
}
